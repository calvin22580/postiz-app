import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { brandColour, COMPANY, companyLine, oursEmailLayout } from '@gitroom/nestjs-libraries/ours/email/email.layout';

const email = { subject: 'Your posts are ready', html: '<p>Hello</p>', settingsUrl: 'https://app.example/settings' };

describe('email layout', () => {
  it('frames the email with our brand, the subject and the body', () => {
    const html = oursEmailLayout(email, {})!;
    expect(html).toContain('Kanosena');
    expect(html).toContain('#6B3BFF');
    expect(html).toContain('>Your posts are ready</h1>');
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('href="https://app.example/settings"');
    expect(html).toContain('company number 17533499');
  });

  it('has no decorative gradient', () => {
    expect(oursEmailLayout(email, {})).not.toMatch(/gradient/i);
  });

  it('escapes the subject but keeps the body as HTML', () => {
    const html = oursEmailLayout({ ...email, subject: 'A <b>bold</b> & "quoted" subject' }, {})!;
    expect(html).toContain('A &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot; subject');
  });

  it('follows the brand settings and can hand back to upstream', () => {
    const env = { NEXT_PUBLIC_BRAND_NAME: 'Acme', NEXT_PUBLIC_BRAND_COLOUR: '#112233' };
    const html = oursEmailLayout(email, env)!;
    expect(html).toContain('Acme');
    expect(html).toContain('#112233');
    expect(brandColour({ NEXT_PUBLIC_BRAND_COLOUR: 'red' })).toBe('#6B3BFF');
    expect(oursEmailLayout(email, { OURS_EMAIL_LAYOUT: 'upstream' })).toBeNull();
  });

  it('uses the same company details as the legal pages', () => {
    const legal = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, '../../../../../apps/frontend/src/ours/legal/legal.defaults.json'), 'utf8')
    );
    for (const key of Object.keys(COMPANY) as (keyof typeof COMPANY)[]) {
      expect(COMPANY[key]).toBe(legal[key]);
    }
    expect(companyLine()).toBe(
      'Steady Lamp Ltd. Registered in England and Wales, company number 17533499. Registered office: 128 City Road, London, EC1V 2NX.'
    );
  });
});
