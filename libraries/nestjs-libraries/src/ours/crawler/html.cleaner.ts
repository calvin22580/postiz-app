// OURS: turns a fetched web page into plain, visible text for the AI.
// Everything fetched is untrusted: scripts, hidden text and comments are
// removed, and lines that read like instructions to an AI are replaced, so a
// page cannot smuggle commands into the extraction prompt.
import { JSDOM } from 'jsdom';

export const MAX_PAGE_CHARS = 15000;

export const REMOVED_INSTRUCTION =
  '[removed: text that looked like instructions to an AI]';

const STRIP = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'svg',
  'canvas',
  'video',
  'audio',
  'link',
  'meta',
  'head',
  'nav',
  'input',
  'select',
  'textarea',
  'button',
  'dialog',
  '[hidden]',
  '[aria-hidden="true"]',
  '.sr-only',
  '.visually-hidden',
  '.screen-reader-text',
].join(',');

const HIDDEN_STYLE =
  /(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(\.0+)?\s*(;|$)|font-size\s*:\s*0(px|em|rem)?\s*(;|$)|(height|width)\s*:\s*0(px)?\s*;[^"]*overflow\s*:\s*hidden|left\s*:\s*-\d{3,}px|text-indent\s*:\s*-\d{3,}px)/i;

const BLOCKS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BR', 'DD', 'DIV', 'DL', 'DT',
  'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER', 'HR', 'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TD',
  'TH', 'TR', 'UL',
]);

const SOCIAL_HOSTS =
  /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|tiktok\.com|youtube\.com|pinterest\.(com|co\.uk)|threads\.net|bsky\.app)$/i;

// Phrases that try to steer an AI rather than describe a business.
const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|all|any|system|your)\b.{0,40}\b(instructions?|rules?|prompts?|directions?|guidelines?)\b/i,
  /\b(new|updated|real|hidden|secret)\s+(system\s+)?instructions?\b/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+are\s+(now\s+)?(an?\s+)?(ai|assistant|chatbot|language model|llm|gpt|claude)\b/i,
  /\b(as an?|dear|attention|note to( the)?)\s+(ai|assistant|language model|llm|chatbot)\b/i,
  /\b(ai|assistant|llm|model|chatbot)s?\s*(must|should|shall)\b/i,
  /<\/?\s*(system|assistant|user|instructions?|untrusted_page)\b/i,
];

export const looksLikeInstruction = (line: string) =>
  INJECTION_PATTERNS.some((p) => p.test(line));

export interface CleanedPage {
  title: string;
  text: string;
  links: string[];
  truncated: boolean;
  removedInstructions: number;
}

const tidy = (s: string) =>
  s
    .replace(/[​-‍﻿­]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Cloudflare's "email address obfuscation" (on by default for many small
// business sites) hides addresses as hex: the first byte is a key that every
// other byte is XORed with. Returns '' if it does not decode to an address.
export const decodeCfEmail = (hex: string) => {
  if (!/^(?:[0-9a-f]{2}){2,}$/i.test(hex || '')) return '';
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out) ? out : '';
};

const CF_EMAIL_LINK = /\/cdn-cgi\/l\/email-protection#([0-9a-f]+)$/i;

export const cleanHtml = (html: string, pageUrl: string): CleanedPage => {
  const dom = new JSDOM(html, { url: pageUrl });
  const doc = dom.window.document;

  // links first: menus are removed below, but they point to the pages we want
  const links: string[] = [];
  doc.querySelectorAll('a[href]').forEach((a) => {
    try {
      links.push(new URL(a.getAttribute('href')!, pageUrl).toString());
    } catch {
      // ignore broken links
    }
  });

  const title = tidy(doc.title || '');
  const description = tidy(
    doc.querySelector('meta[name="description"]')?.getAttribute('content') || ''
  );

  doc.querySelectorAll(STRIP).forEach((el) => el.remove());
  doc.querySelectorAll('[style]').forEach((el) => {
    if (HIDDEN_STYLE.test(el.getAttribute('style') || '')) el.remove();
  });

  doc.querySelectorAll('[data-cfemail]').forEach((el) => {
    const email = decodeCfEmail(el.getAttribute('data-cfemail') || '');
    if (email) el.textContent = email;
  });

  // contact details and social profiles often live only in the link target
  doc.querySelectorAll('a[href]').forEach((a) => {
    const cf = (a.getAttribute('href') || '').match(CF_EMAIL_LINK);
    const cfEmail = cf ? decodeCfEmail(cf[1]) : '';
    const href = cfEmail ? `mailto:${cfEmail}` : a.getAttribute('href') || '';
    const text = tidy(a.textContent || '');
    let extra = '';
    if (/^mailto:/i.test(href)) {
      extra = decodeURIComponent(href.replace(/^mailto:/i, '').split('?')[0]);
    } else if (/^tel:/i.test(href)) {
      extra = decodeURIComponent(href.replace(/^tel:/i, ''));
    } else {
      try {
        const u = new URL(href, pageUrl);
        if (SOCIAL_HOSTS.test(u.hostname)) extra = u.toString();
      } catch {
        // ignore
      }
    }
    if (extra && !text.includes(extra)) {
      a.textContent = text ? `${text} (${extra})` : extra;
    }
  });

  const body = doc.body;
  if (body) {
    body.querySelectorAll('*').forEach((el) => {
      if (!BLOCKS.has(el.tagName)) return;
      const prefix = /^H[1-6]$/.test(el.tagName)
        ? '\n## '
        : el.tagName === 'LI'
        ? '\n- '
        : '\n';
      el.insertBefore(doc.createTextNode(prefix), el.firstChild);
      el.appendChild(doc.createTextNode('\n'));
    });
  }

  let removedInstructions = 0;
  const lines: string[] = [];
  const raw = [
    ...(description ? [`Page description: ${description}`] : []),
    ...(body?.textContent || '').split('\n'),
  ];
  for (const rawLine of raw) {
    const line = tidy(rawLine)
      .replace(/^(##|-)\s*$/, '')
      .replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›'));
    if (!line) continue;
    if (looksLikeInstruction(line)) {
      removedInstructions++;
      if (lines[lines.length - 1] !== REMOVED_INSTRUCTION) {
        lines.push(REMOVED_INSTRUCTION);
      }
      continue;
    }
    if (lines[lines.length - 1] === line) continue;
    lines.push(line);
  }

  let text = lines.join('\n');
  const truncated = text.length > MAX_PAGE_CHARS;
  if (truncated) {
    text = text.slice(0, MAX_PAGE_CHARS);
  }
  dom.window.close();

  return { title, text, links, truncated, removedInstructions };
};
