# Cloudflare deployment (OURS)

Runs the app on Cloudflare Containers at `https://app.kanosena.com`. The plan and costs are in `deployment-plan.md` in the project files.

```
visitor ─▶ Worker (src/index.ts) ─▶ Durable Object "app" ─▶ container :5000
                                                         nginx ─▶ frontend :4200
                                                               └▶ backend  :3000 (/api)
                                                         orchestrator (Temporal worker)
                                                         redis (cache only, in memory)
container ─▶ PlanetScale Postgres (London)   container ─▶ Temporal Cloud (London)
container ─▶ R2 bucket tidepost-media-eu (media.kanosena.com for new uploads; media.steadylamp.com stays attached for older links)
```

- **One container, on 24/7.** A cron trigger calls the Durable Object every minute. It starts the container if it isn't running (first deploy, crash, Cloudflare host restart). After a deploy, it replaces the container when the image or any var or secret has changed, so a rotated key takes effect within a minute or two.
- **Nothing important lives on the container's disk.** The disk is wiped on every restart. Data lives in Postgres, scheduled posts in Temporal Cloud, and media in R2.
- **Cold start:** about 2 to 5 minutes, covering the schema push and three Node apps. Until it's ready, visitors see a "Just a moment" page that refreshes itself.
- **Size:** 1 vCPU, 4 GiB memory, 16 GB disk (`INSTANCE` in `src/index.ts`).
- **Redis** holds a cache and short-lived upload sessions in memory. A restart only interrupts uploads that are in progress.
- **Upstream sync:** the Dockerfile copies a fixed list of root files rather than everything, so a stray `.env` can never reach the image. When an upstream release changes `Dockerfile.dev` or adds a root file its build needs, update `Dockerfile` here to match.
- **Upstream files:** none changed. `Dockerfile` here is our own copy of upstream's `Dockerfile.dev` steps. It adds Redis, copies only the folders the build needs, and rewrites one header in the copied `nginx.conf` at build time.

## Settings

Plain settings are in `wrangler.jsonc` under `vars`. Secrets are set on the Worker and never committed. `wrangler deploy` refuses to run if one is missing.

| Secret | What |
|---|---|
| `JWT_SECRET` | `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32`. **Keep a copy in the password manager.** Losing it means every channel has to be reconnected |
| `DATABASE_URL` | PlanetScale Postgres connection string (`?sslmode=require`) |
| `TEMPORAL_ADDRESS` | Temporal Cloud gRPC endpoint, `host:7233` |
| `TEMPORAL_NAMESPACE` | Full namespace name, e.g. `tidepost.abc12` |
| `TEMPORAL_API_KEY` | Temporal Cloud API key |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (used for the R2 endpoint) |
| `CLOUDFLARE_ACCESS_KEY` / `CLOUDFLARE_SECRET_ACCESS_KEY` | R2 API token, Object Read & Write on `tidepost-media-eu` only |
| `OURS_STRIPE_SECRET_KEY` / `OURS_STRIPE_WEBHOOK_SECRET` / `OURS_STRIPE_PORTAL_CONFIGURATION` | Stripe sandbox key, signing secret of the webhook at `https://app.kanosena.com/api/ours/stripe/webhook`, and the portal configuration id. Optional: see `ours/README.md` (Payments with Stripe) |

Every string var and secret on the Worker is passed to the container as an environment variable, so a new app setting only needs `vars` or a new secret. No code change is needed.

This environment is a **demo for platform app reviews**: `SANDBOX_CHANNEL_ENABLED=true` (always labelled), `OURS_BILLING_MODE=stripe` with a Stripe sandbox key (test cards only, labelled "Test payments"), `DISABLE_REGISTRATION=true`. There are no Facebook, Instagram or LinkedIn keys until approvals land, and AI uses the `ANTHROPIC_API_KEY` sent by the GitHub deploy (see below). Without it, AI features use their demo fallbacks.

## One-time Temporal Cloud setup

With `TEMPORAL_TLS=true`, upstream skips creating its search attributes (`temporal.register.ts`), and Temporal Cloud rejects post workflows without them. Add them once to the namespace, as Keyword attributes:

```bash
brew install temporalio/brew/tcld
tcld --api-key "$TEMPORAL_API_KEY" namespace search-attributes add \
  -n "$TEMPORAL_NAMESPACE" --sa "organizationId=Keyword" --sa "postId=Keyword"
```

Or add them in the Temporal Cloud web UI (Namespace → Search Attributes).

## Deploy

Needs Docker running and a Wrangler login (`pnpm exec wrangler login`) on an account that has the Workers Paid plan.

```bash
cd ours/deploy/cloudflare
pnpm install                                 # uses this folder's own pnpm-workspace.yaml (pnpm 11 build approvals)
pnpm exec wrangler secret put JWT_SECRET   # repeat for each secret above (first time only)
pnpm run deploy                             # builds the image (needs about 4 GB RAM for Docker), pushes, deploys
```

Deploys attach the `app.kanosena.com` and `app.steadylamp.com` custom domains (the Worker redirects the old one to `FRONTEND_URL`). After deploying, the cron replaces the running container within a minute or two, then the cold start runs.

- Logs: `pnpm run logs` for the Worker. Container logs are in the Cloudflare dashboard under Workers → Containers.
- Type check after changing `wrangler.jsonc`: `pnpm run types && pnpm run check`

## Costs (estimate)

About $34 a month for the container on 24/7, plus about $5–7 for PlanetScale and a few dollars for Temporal Cloud. See `deployment-plan.md`.

## Deploy from GitHub (no local Docker)

`.github/workflows/ours-deploy-cloudflare.yml` runs the same deploy on GitHub's machines. Start it from the repo's **Actions** tab ("Deploy to Cloudflare (ours)", Run workflow). It is manual only.

It needs two repository secrets (Settings → Secrets and variables → Actions):
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`: an account API token created from the "Edit Cloudflare Workers" template, plus **Containers: Edit** if it's listed separately, scoped to this account and the `kanosena.com` and `steadylamp.com` zones.

The app's secrets stay on the Worker. The workflow never sees them, with two exceptions: if the repository secret `ANTHROPIC_API_KEY` is set, the workflow sends it with the deploy (`wrangler deploy --secrets-file`), and if `EMAIL_SMTP_TOKEN` is set, it is sent as the app's `EMAIL_PASS`. Other Worker secrets are left as they are. To rotate either, update the repository secret and run the workflow again.

### App email

Password resets, account activation and notifications are sent from `no-reply@kanosena.com` through Cloudflare Email Sending, over SMTP with upstream's `nodemailer` provider (settings in `wrangler.jsonc`, no code changes). `kanosena.com` is onboarded under Email Service → Email Sending; its records live on `cf-bounce.kanosena.com`, `cf-bounce._domainkey.kanosena.com` and `_dmarc.kanosena.com` (`p=none`, so iCloud mail for `support@` is never rejected). The iCloud MX and SPF records on the root are untouched. `EMAIL_SMTP_TOKEN` is a Cloudflare account API token with only **Email Sending: Edit**. Included in Workers Paid: 3,000 emails a month, then $0.35 per 1,000. Sending logs: dashboard → Email Service → Email Sending. Never change Worker settings in the dashboard or through the settings API: on 20/11/2026 that dropped the container and took the site down.
