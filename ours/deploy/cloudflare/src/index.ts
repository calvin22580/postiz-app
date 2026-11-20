// OURS: Cloudflare Worker that fronts the app container.
//
// - Every request goes to one container instance (named "app") through its
//   Durable Object.
// - Requests to any host other than FRONTEND_URL's are redirected to it.
// - A cron trigger runs every minute and calls keepAlive(), so the container
//   stays on 24/7 (the background worker and cron jobs live inside it), is
//   restarted if it crashed, and is replaced when a new image is deployed or
//   a var or secret changes (for example after rotating a key).
// - All string vars and secrets on this Worker are passed to the container as
//   environment variables. Secrets are set with `wrangler secret put`, never in
//   the repo. See README.md in this folder.

import { DurableObject } from 'cloudflare:workers';

// Changed from 'app' on 20/11/2026: a settings-API edit left the 'app'
// instance without a container (ctx.container undefined) even after
// redeploys, so the app now runs in a fresh instance.
const INSTANCE_NAME = 'app-2';
const PORT = 5000;
// Longer than the 1-minute cron, so the container never idles out between ticks.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
// How long a visitor's request waits for a cold start before seeing the holding page.
const REQUEST_WAIT_MS = 20 * 1000;
// Install, schema push and three Node apps can take a few minutes on first boot.
const READY_TIMEOUT_MS = 10 * 60 * 1000;
const INSTANCE = { vcpu: 1, memoryMib: 4096, diskMb: 16000 };

type Env = {
  APP: DurableObjectNamespace<AppContainer>;
} & Record<string, unknown>;

export class AppContainer extends DurableObject<Env> {
  private starting?: Promise<void>;
  private ready = false;
  // Bumped when a container is replaced, so a start-up check for the old one stops.
  private generation = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      // A restarted Durable Object loses the timeout and the exit watch; set them again.
      void ctx.blockConcurrencyWhile(() =>
        container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS)
      );
      this.watch();
    }
  }

  async fetch(request: Request): Promise<Response> {
    const startup = this.ensureReady();
    if (!this.ready) {
      const outcome = await Promise.race([
        startup.then(() => 'ready' as const),
        scheduler.wait(REQUEST_WAIT_MS).then(() => 'waiting' as const),
      ]).catch(() => 'failed' as const);
      if (outcome !== 'ready') {
        return holdingPage(outcome === 'failed');
      }
    }

    const incoming = new URL(request.url);
    const headers = new Headers(request.headers);
    // Keep the public host so the app builds correct links and redirects.
    headers.set('Host', incoming.host);
    headers.set('X-Forwarded-Proto', 'https');
    headers.set('X-Forwarded-Host', incoming.host);
    const target = new URL(incoming.pathname + incoming.search, `http://${incoming.host}`);
    try {
      return await this.ctx.container!
        .getTcpPort(PORT)
        .fetch(new Request(target, { method: request.method, headers, body: request.body, redirect: 'manual' }));
    } catch (err) {
      console.error('Proxy to container failed', err);
      this.ready = false;
      return holdingPage(false);
    }
  }

  // Called every minute by the cron trigger.
  async keepAlive(): Promise<void> {
    const container = this.ctx.container;
    if (!container) {
      throw new Error('No container is attached to this Durable Object instance');
    }
    const current = await fingerprint(container.images.base, containerEnv(this.env));
    const startedWith = await this.ctx.storage.get<string>('fingerprint');
    if (container.running && startedWith !== current) {
      console.log('New image or settings deployed, replacing the running container');
      this.ready = false;
      this.generation++;
      this.starting = undefined;
      await container.destroy();
    }
    // Start (or confirm) in the background, so the cron call returns quickly.
    this.ctx.waitUntil(
      this.ensureReady().catch((err: unknown) => console.error('Keep-alive start failed', err))
    );
  }

  private ensureReady(): Promise<void> {
    const container = this.ctx.container!;
    if (this.ready && container.running) {
      return Promise.resolve();
    }
    if (!this.starting) {
      const generation = this.generation;
      const starting: Promise<void> = this.startAndWait(generation).finally(() => {
        if (this.starting === starting) {
          this.starting = undefined;
        }
      });
      this.starting = starting;
    }
    return this.starting;
  }

  private async startAndWait(generation: number): Promise<void> {
    const container = this.ctx.container!;
    this.ready = false;
    if (!container.running) {
      const image = container.images.base;
      const env = containerEnv(this.env);
      container.start({
        image,
        instance: INSTANCE,
        enableInternet: true,
        env,
      });
      await this.ctx.storage.put('fingerprint', await fingerprint(image, env));
      this.watch();
    }
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

    // Ready once nginx reaches both the frontend and the API (no 502/503/504).
    const port = container.getTcpPort(PORT);
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (generation !== this.generation) {
        throw new Error('Container was replaced during start-up');
      }
      if ((await answers(port, '/')) && (await answers(port, '/api/'))) {
        this.ready = true;
        return;
      }
      await scheduler.wait(2000);
    }
    throw new Error(`App did not become ready on port ${PORT}`);
  }

  private watch(): void {
    const generation = this.generation;
    this.ctx.waitUntil(
      this.ctx.container!
        .monitor()
        .then(() => console.log('Container exited'))
        .catch((err: unknown) => console.error('Container stopped with an error', err))
        .finally(() => {
          if (generation === this.generation) {
            this.ready = false;
          }
        })
    );
  }
}

async function answers(port: Fetcher, path: string): Promise<boolean> {
  try {
    const res = await port.fetch(`http://container${path}`, {
      signal: AbortSignal.timeout(5000),
      redirect: 'manual',
    });
    await res.body?.cancel();
    return res.status < 502;
  } catch {
    return false;
  }
}

function containerEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

// A hash of the image and every value passed to the container, so a changed
// secret restarts the container without the secret itself being stored.
async function fingerprint(image: string, env: Record<string, string>): Promise<string> {
  const sorted = Object.keys(env).sort().map((key) => [key, env[key]]);
  const data = new TextEncoder().encode(JSON.stringify([image, sorted]));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function holdingPage(failed: boolean): Response {
  const message = failed
    ? 'The app is having trouble starting. Please try again in a few minutes.'
    : 'The app is starting up. This page will refresh by itself.';
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="15"><title>Starting up</title>
<style>body{font-family:system-ui,sans-serif;background:#f7f7f5;color:#1d2322;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:28rem;padding:2rem;text-align:center}h1{font-size:1.25rem;font-weight:600;margin:0 0 .5rem}p{margin:0;line-height:1.5;color:#4a5452}</style>
</head><body><main><h1>Just a moment</h1><p>${message}</p></main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '15', 'cache-control': 'no-store' },
  });
}

// Any other host on this Worker (the old app.steadylamp.com address) gets a
// permanent redirect to the same path on FRONTEND_URL. 308 keeps the method.
function redirectToCanonical(request: Request, env: Env): Response | undefined {
  if (typeof env.FRONTEND_URL !== 'string' || !env.FRONTEND_URL) return undefined;
  const canonical = new URL(env.FRONTEND_URL);
  const url = new URL(request.url);
  if (url.host === canonical.host) return undefined;
  url.protocol = canonical.protocol;
  url.host = canonical.host;
  return Response.redirect(url.toString(), 308);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return redirectToCanonical(request, env) ?? env.APP.getByName(INSTANCE_NAME).fetch(request);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(env.APP.getByName(INSTANCE_NAME).keepAlive());
  },
} satisfies ExportedHandler<Env>;
