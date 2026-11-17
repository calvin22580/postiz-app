// OURS: reads a small business website: the homepage plus up to 10 pages on
// the same site, respecting robots.txt. Pages come back as cleaned text.
import { Injectable, Logger } from '@nestjs/common';
import { cleanHtml } from '@gitroom/nestjs-libraries/ours/crawler/html.cleaner';
import { parseRobots, Robots } from '@gitroom/nestjs-libraries/ours/crawler/robots';
import {
  assertPublicUrl,
  crawlerAllowsPrivate,
  UnsafeUrlError,
} from '@gitroom/nestjs-libraries/ours/crawler/url.safety';

export const MAX_EXTRA_PAGES = 10;
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
  removedInstructions: number;
}

export interface CrawlProgress {
  stage: 'checking' | 'reading';
  done: number;
  total: number;
}

export interface CrawlResult {
  pages: CrawledPage[];
  skipped: { url: string; reason: string }[];
}

export class CrawlError extends Error {}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface CrawlOptions {
  maxExtraPages?: number;
  allowPrivate?: boolean;
  fetchImpl?: FetchLike;
  onProgress?: (p: CrawlProgress) => void | Promise<void>;
}

export const crawlerUserAgent = () => {
  const brand = (process.env.NEXT_PUBLIC_BRAND_NAME || 'Kanosena').replace(
    /[^a-z0-9]/gi,
    ''
  );
  return `${brand}Bot/1.0 (+${
    process.env.NEXT_PUBLIC_SOURCE_CODE_URL ||
    'https://github.com/calvin22580/postiz-app'
  })`;
};

const PRIORITY = [
  /about|our-story|who-we-are|story|history/,
  /service|what-we-do|treatment|offer|solution/,
  /product|menu|shop|range|price|pricing/,
  /contact|find-us|location|visit|area|where/,
  /team|people|meet/,
  /faq|review|testimonial/,
];

const SKIP_PATH =
  /(login|log-in|signin|sign-in|register|account|basket|cart|checkout|wp-admin|wp-login|privacy|cookie|terms|legal|feed|\/tag\/|\/author\/|search)/;
const SKIP_EXT =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|docx?|xlsx?|pptx?|mp4|mp3|xml|json|css|js|txt)$/;

const siteKey = (host: string) => host.toLowerCase().replace(/^www\./, '');

const canonical = (u: URL) => {
  const c = new URL(u.toString());
  c.hash = '';
  if (c.pathname.length > 1) c.pathname = c.pathname.replace(/\/+$/, '');
  return c.toString();
};

export const pickPages = (home: URL, links: string[], max: number) => {
  const seen = new Set<string>([canonical(home)]);
  const candidates: { url: string; score: number; depth: number; order: number }[] = [];
  links.forEach((link, order) => {
    let u: URL;
    try {
      u = new URL(link);
    } catch {
      return;
    }
    if (!['http:', 'https:'].includes(u.protocol)) return;
    if (siteKey(u.hostname) !== siteKey(home.hostname)) return;
    const path = u.pathname.toLowerCase();
    if (SKIP_EXT.test(path) || SKIP_PATH.test(path)) return;
    u.search = '';
    const key = canonical(u);
    if (seen.has(key)) return;
    seen.add(key);
    const hit = PRIORITY.findIndex((p) => p.test(path));
    candidates.push({
      url: key,
      score: hit === -1 ? 0 : PRIORITY.length - hit,
      depth: path.split('/').filter(Boolean).length,
      order,
    });
  });
  return candidates
    .sort((a, b) => b.score - a.score || a.depth - b.depth || a.order - b.order)
    .slice(0, max)
    .map((c) => c.url);
};

@Injectable()
export class WebsiteCrawler {
  private _logger = new Logger(WebsiteCrawler.name);

  async crawl(start: URL, options: CrawlOptions = {}): Promise<CrawlResult> {
    const maxExtra = options.maxExtraPages ?? MAX_EXTRA_PAGES;
    const allowPrivate = options.allowPrivate ?? crawlerAllowsPrivate();
    const fetchImpl: FetchLike = options.fetchImpl || ((u, i) => fetch(u, i));
    const progress = async (p: CrawlProgress) => {
      await options.onProgress?.(p);
    };

    await progress({ stage: 'checking', done: 0, total: 1 });
    await assertPublicUrl(start, allowPrivate);

    const robots = await this.robots(start, fetchImpl, allowPrivate);
    const skipped: CrawlResult['skipped'] = [];
    if (!robots.isAllowed(start.pathname + start.search)) {
      throw new CrawlError(
        'This website asks automated readers like ours not to read its homepage (robots.txt), so we have left it alone.'
      );
    }

    const home = await this.fetchPage(start, fetchImpl, allowPrivate).catch(
      (e) => {
        throw e instanceof UnsafeUrlError || e instanceof CrawlError
          ? e
          : new CrawlError('We could not open your homepage. Please check the address and try again.');
      }
    );
    const homeUrl = new URL(home.finalUrl);
    const homeClean = cleanHtml(home.html, home.finalUrl);
    const pages: CrawledPage[] = [
      {
        url: canonical(homeUrl),
        title: homeClean.title,
        text: homeClean.text,
        truncated: homeClean.truncated,
        removedInstructions: homeClean.removedInstructions,
      },
    ];

    const targets = pickPages(homeUrl, homeClean.links, maxExtra * 2).filter(
      (u) => {
        const parsed = new URL(u);
        if (robots.isAllowed(parsed.pathname + parsed.search)) return true;
        skipped.push({ url: u, reason: 'robots.txt' });
        return false;
      }
    );
    const total = 1 + Math.min(maxExtra, targets.length);
    await progress({ stage: 'reading', done: 1, total });

    for (const target of targets) {
      if (pages.length >= 1 + maxExtra) break;
      try {
        const page = await this.fetchPage(new URL(target), fetchImpl, allowPrivate);
        const finalUrl = new URL(page.finalUrl);
        if (siteKey(finalUrl.hostname) !== siteKey(homeUrl.hostname)) {
          skipped.push({ url: target, reason: 'left the site' });
          continue;
        }
        const key = canonical(finalUrl);
        if (pages.some((p) => p.url === key)) continue;
        const clean = cleanHtml(page.html, page.finalUrl);
        pages.push({
          url: key,
          title: clean.title,
          text: clean.text,
          truncated: clean.truncated,
          removedInstructions: clean.removedInstructions,
        });
      } catch (e) {
        skipped.push({ url: target, reason: (e as Error).message });
      }
      await progress({ stage: 'reading', done: pages.length, total });
    }

    this._logger.log(
      `Crawled ${pages.length} pages from ${homeUrl.hostname}, skipped ${skipped.length}`
    );
    return { pages, skipped };
  }

  private async robots(
    start: URL,
    fetchImpl: FetchLike,
    allowPrivate: boolean
  ): Promise<Robots> {
    try {
      const res = await this.request(
        new URL('/robots.txt', start),
        fetchImpl,
        allowPrivate,
        'text/plain'
      );
      if (res.status >= 400 && res.status < 500) {
        return parseRobots('', crawlerUserAgent());
      }
      if (!res.ok) {
        // a server error on robots.txt means "do not crawl" by convention
        return parseRobots('User-agent: *\nDisallow: /', crawlerUserAgent());
      }
      return parseRobots(await this.readBody(res), crawlerUserAgent());
    } catch {
      return parseRobots('', crawlerUserAgent());
    }
  }

  private async fetchPage(url: URL, fetchImpl: FetchLike, allowPrivate: boolean) {
    const res = await this.request(url, fetchImpl, allowPrivate, 'text/html');
    if (!res.ok) {
      throw new CrawlError(`HTTP ${res.status}`);
    }
    const type = res.headers.get('content-type') || '';
    if (type && !/html|xml/i.test(type)) {
      throw new CrawlError('not a web page');
    }
    return { finalUrl: res.url || url.toString(), html: await this.readBody(res) };
  }

  // follows redirects by hand so every hop is checked for safety
  private async request(
    url: URL,
    fetchImpl: FetchLike,
    allowPrivate: boolean,
    accept: string
  ) {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(current, allowPrivate);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetchImpl(current.toString(), {
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': crawlerUserAgent(),
            accept,
            'accept-language': 'en-GB,en;q=0.8',
          },
        });
        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
          current = new URL(location, current);
          if (!['http:', 'https:'].includes(current.protocol)) {
            throw new CrawlError('redirected away from the web');
          }
          continue;
        }
        Object.defineProperty(res, 'url', { value: current.toString() });
        return res;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new CrawlError('too many redirects');
  }

  private async readBody(res: Response) {
    if (!res.body) return '';
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
  }
}
