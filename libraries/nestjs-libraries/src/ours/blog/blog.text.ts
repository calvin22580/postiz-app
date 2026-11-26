// OURS: blog posts B1. How a blog post's words are stored and turned into
// something an owner can paste into their website. The body is plain text
// with three simple marks, so the owner can edit it in a text box:
// paragraphs separated by a blank line, "## " for a heading and "- " for a
// list item. Everything else is text: nothing the writer or the owner types
// becomes HTML. Used by the backend and the review screen alike.

export type BlogBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

// One blank line between blocks at most, no trailing spaces.
export const cleanBlogText = (s: string) =>
  s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export const blogBlocks = (body: string): BlogBlock[] => {
  const blocks: BlogBlock[] = [];
  for (const chunk of cleanBlogText(body).split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    };
    for (const line of lines) {
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const item = line.match(/^[-*•]\s+(.*)$/);
      if (heading) {
        flush();
        blocks.push({ type: 'heading', text: heading[1].trim() });
      } else if (item) {
        flush();
        const last = blocks[blocks.length - 1];
        if (last?.type === 'list') last.items.push(item[1].trim());
        else blocks.push({ type: 'list', items: [item[1].trim()] });
      } else {
        paragraph.push(line);
      }
    }
    flush();
  }
  return blocks;
};

// The writer answers in sections; this is how they are stored.
export const bodyFromSections = (
  sections: { heading?: string; paragraphs?: string[]; bullets?: string[] }[]
) =>
  cleanBlogText(
    (sections || [])
      .map((s) =>
        [
          s?.heading?.trim() ? `## ${s.heading.trim().replace(/^#+\s*/, '')}` : '',
          ...(s?.paragraphs || []).map((p) => String(p || '').trim()).filter(Boolean),
          (s?.bullets || []).map((b) => String(b || '').trim()).filter(Boolean).map((b) => `- ${b}`).join('\n'),
        ]
          .filter(Boolean)
          .join('\n\n')
      )
      .join('\n\n')
  );

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The body as HTML for a website editor: headings, paragraphs and lists only.
// The title goes in the website's own title box, so it isn't included.
export const blogHtml = (body: string) =>
  blogBlocks(body)
    .map((b) =>
      b.type === 'heading'
        ? `<h2>${escapeHtml(b.text)}</h2>`
        : b.type === 'paragraph'
        ? `<p>${escapeHtml(b.text)}</p>`
        : `<ul>\n${b.items.map((i) => `  <li>${escapeHtml(i)}</li>`).join('\n')}\n</ul>`
    )
    .join('\n');

// The body as plain text, for editors that only take text.
export const blogPlainText = (body: string) =>
  blogBlocks(body)
    .map((b) => (b.type === 'list' ? b.items.map((i) => `• ${i}`).join('\n') : b.text))
    .join('\n\n');

export const wordCount = (body: string) =>
  blogBlocks(body)
    .flatMap((b) => (b.type === 'list' ? b.items : [b.text]))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
