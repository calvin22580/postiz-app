import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { rebrand } = require('./rebrand.cjs');

describe('frontend build-time rebrand', () => {
  it('replaces the product name as a whole word', () => {
    expect(rebrand("title: 'Postiz Calendar'", '/x/page.tsx', 'Tidepost')).toBe(
      "title: 'Tidepost Calendar'"
    );
    expect(rebrand('"Welcome to Postiz"', '/x/en/translation.json', 'Tidepost')).toBe(
      '"Welcome to Tidepost"'
    );
  });

  it('leaves code, URLs and package names alone', () => {
    for (const s of ['PostizApi', 'MyPostizAgent', 'postiz.com', '@postiz/node', 'gitroomhq/postiz-app']) {
      expect(rebrand(s, '/x/a.tsx', 'Tidepost')).toBe(s);
    }
  });

  it('never rewrites third-party testimonials', () => {
    const src = 'I just found out about Postiz';
    expect(
      rebrand(src, '/r/libraries/react-shared-libraries/src/helpers/testomonials.tsx', 'Tidepost')
    ).toBe(src);
  });

  it('points upstream legal links at ours', () => {
    const src = "href={`https://postiz.com/terms`} href={`https://postiz.com/privacy`}";
    expect(rebrand(src, '/x/register.tsx', 'Tidepost')).toBe(
      'href={`/auth/legal/terms.html`} href={`/auth/legal/privacy.html`}'
    );
    expect(
      rebrand('https://postiz.com/terms', '/x/a.tsx', 'Tidepost', {
        'https://postiz.com/terms': 'https://example.co.uk/terms',
      })
    ).toBe('https://example.co.uk/terms');
  });
});
