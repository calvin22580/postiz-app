// OURS: the plain-text part of every app email (password reset, activation,
// notifications). Upstream's nodemailer provider sent the raw HTML as the
// "plain text" part, so text-only mail clients and previews showed tags, and
// spam filters mark down a text part that does not match the HTML.
// Called from one marked line in emails/node.mailer.provider.ts.
//
// Uses parse5, which upstream already uses to read HTML (helpers/utils/strip.html.validation.ts).
import { parse } from 'parse5';

type Node = {
  nodeName: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
  content?: Node;
};

// never shown to the reader
const SKIP = new Set(['head', 'style', 'script', 'title', 'template', 'noscript']);
// start on a new line
const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'footer', 'header',
  'hr', 'li', 'ol', 'p', 'section', 'table', 'tbody', 'td', 'th', 'thead', 'tfoot', 'tr', 'ul',
]);
// headings and paragraphs get a blank line around them
const SPACED = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'table', 'ul', 'ol']);

// markers for block edges; neighbouring edges merge into one break
const LINE = '\u0001';
const PARAGRAPH = '\u0002';
const BREAKS = /\s*[\u0001\u0002][\s\u0001\u0002]*/g;

const textOf = (node: Node): string =>
  node.nodeName === '#text' ? node.value || '' : (node.childNodes || []).map(textOf).join('');

const walk = (node: Node, out: string[]) => {
  const name = node.nodeName;
  if (name === '#comment' || SKIP.has(name)) {
    return;
  }
  if (name === '#text') {
    out.push((node.value || '').replace(/\s+/g, ' '));
    return;
  }
  if (name === 'br') {
    out.push('\n');
    return;
  }
  if (name === 'img') {
    const alt = node.attrs?.find((a) => a.name === 'alt')?.value?.trim();
    if (alt) out.push(alt);
    return;
  }

  const spaced = SPACED.has(name);
  const block = spaced || BLOCK.has(name);
  if (block) out.push(spaced ? PARAGRAPH : LINE);
  if (name === 'li') out.push('- ');

  if (name === 'a') {
    const href = (node.attrs?.find((a) => a.name === 'href')?.value || '').trim();
    const label = textOf(node).replace(/\s+/g, ' ').trim();
    const shown = href.replace(/^mailto:/i, '');
    // a link without a real address keeps its words only
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) {
      out.push(label);
    } else if (!label || label === shown || label === href) {
      out.push(shown);
    } else {
      out.push(`${label} (${shown})`);
    }
    return;
  }

  for (const child of node.childNodes || []) {
    walk(child, out);
  }
  if (block) out.push(spaced ? PARAGRAPH : LINE);
};

export const emailPlainText = (html: string): string => {
  if (!html) {
    return '';
  }
  const out: string[] = [];
  walk(parse(html) as unknown as Node, out);
  return out
    .join('')
    .replace(BREAKS, (run) => (run.includes(PARAGRAPH) ? '\n\n' : '\n'))
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
