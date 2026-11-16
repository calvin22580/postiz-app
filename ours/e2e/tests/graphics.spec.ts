// OURS: every weekly post gets a graphic in the business's own colour and
// logo, at the right size for its platform. The owner can change the layout or
// leave the graphic off, and only an approved post carries its graphic, on the
// Sandbox channel. Needs the stack running with SANDBOX_CHANNEL_ENABLED=true,
// OURS_CRAWLER_ALLOW_PRIVATE=true and no ANTHROPIC_API_KEY (demo writer, no
// AI cost). See ours/README.md.
import { expect, test } from '@playwright/test';
import zlib from 'node:zlib';
import { BACKEND, setUkDates, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

// width and height from a PNG's header
const pngSize = (buf: Buffer) => {
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

const SIZES: Record<string, { width: number; height: number }> = {
  facebook: { width: 1080, height: 1350 },
  instagram: { width: 1080, height: 1350 },
  linkedin: { width: 1200, height: 1200 },
};

// a small solid red logo, made here so the test needs no image files
const solidPng = (width: number, height: number, rgb: [number, number, number]) => {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const LOGO = solidPng(120, 60, [192, 57, 43]);

test('weekly posts come with branded graphics, attached only when approved', async ({ page }) => {
  const site = await startTestSite();
  try {
    await signUp(page);
    await setUkDates(page, { enabled: false });
    await page.getByText('Sandbox (test only, never publishes)').first().click();
    await page.fill('input[name="name"]', 'Graphics Cafe');
    await page.getByRole('button', { name: 'Connect' }).click();
    await page.waitForURL(/added=sandbox/);

    await page.goto('/business-profile');
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });

    await page.goto('/captions');
    await page.getByRole('button', { name: 'Write next week’s posts' }).click();
    await expect(page.getByTestId('captions-summary')).toBeVisible({ timeout: 90_000 });

    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
    const api = (path: string) => page.request.get(`${BACKEND}${path}`, { headers: { auth } });
    const week = async () => (await (await api('/ours/captions')).json()).week;

    // the brand kit starts neutral and asks for the owner's colour
    const kit = page.getByTestId('brand-kit');
    await expect(kit).toContainText('Pick your brand colour');
    await expect(kit).toContainText('No logo');

    // every caption has a graphic preview, drawn at its platform's size
    const cards = page.getByTestId('caption-card');
    await expect(cards).toHaveCount(12);
    await expect(page.getByTestId('caption-graphic-image')).toHaveCount(12, { timeout: 60_000 });
    const captions = (await week()).captions as any[];
    for (const c of captions) {
      expect(c.graphic.size).toEqual(SIZES[c.platform]);
      expect(c.graphic.choice).toBe('auto');
    }
    for (const platform of ['facebook', 'instagram', 'linkedin']) {
      const c = captions.find((x) => x.platform === platform);
      const res = await api(`/ours/captions/${c.id}/graphic`);
      expect(res.headers()['content-type']).toBe('image/png');
      expect(pngSize(await res.body())).toEqual(SIZES[platform]);
    }
    // one layout a day, rotating: Monday is a statement, Tuesday a card
    await expect(cards.first().getByTestId('caption-graphic-info')).toHaveText(/^Statement, 1200 × 1200 px$/);

    // the owner sets their colour and logo; previews redraw
    await kit.getByLabel('Brand colour', { exact: true }).fill('#7A2E8E');
    await kit.getByRole('button', { name: 'Save colour' }).click();
    await expect(kit.getByRole('button', { name: 'Save colour' })).toHaveCount(0);
    await expect(kit).not.toContainText('Pick your brand colour');
    await kit.getByTestId('brand-logo-input').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: LOGO });
    await expect(kit.getByTestId('brand-logo')).toBeVisible();
    const saved = await (await api('/ours/brand-kit')).json();
    expect(saved).toMatchObject({ colour: '#7A2E8E', chosen: true, hasLogo: true });
    await expect(page.getByTestId('caption-graphic-image')).toHaveCount(12, { timeout: 60_000 });

    // a file that isn't an image is refused with a plain message
    await kit.getByTestId('brand-logo-input').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('<svg><script>alert(1)</script></svg>') });
    await expect(kit.getByRole('alert')).toContainText('PNG, JPEG or WebP');

    // the first post: no graphic, then the card layout
    const first = cards.first();
    const firstId = captions[0].id;
    await first.getByTestId('caption-graphic-layout').selectOption('none');
    await expect(first).toContainText('No graphic');
    await expect(first.getByTestId('caption-graphic-image')).toHaveCount(0);
    expect((await api(`/ours/captions/${firstId}/graphic`)).status()).toBe(404);
    await first.getByTestId('caption-graphic-layout').selectOption('card');
    await expect(first.getByTestId('caption-graphic-image')).toBeVisible();
    expect((await week()).captions[0].graphic).toMatchObject({ choice: 'card', layout: 'card', path: null });
    await page.screenshot({ path: 'test-results/graphics-pending.png', fullPage: true });

    // nothing has been saved to the media library or scheduled yet
    expect((await week()).captions.every((c: any) => c.postId === null && c.graphic.path === null)).toBe(true);

    // approve it: the post carries exactly one image, the drawn graphic
    await first.getByRole('button', { name: /Approve and schedule on Sandbox · Graphics Cafe/ }).click();
    await expect(first.getByTestId('caption-status')).toHaveText('Approved and scheduled');
    await expect(first).toContainText('Attached to the post');
    const approved = (await week()).captions.find((c: any) => c.id === firstId);
    expect(approved.graphic.path).toMatch(/\/uploads\/.+\.png$/);
    const post = (await (await api(`/posts/${approved.postId}`)).json()).posts[0];
    expect(post.integration.providerIdentifier).toBe('sandbox');
    const images = typeof post.image === 'string' ? JSON.parse(post.image) : post.image;
    expect(images).toHaveLength(1);
    expect(images[0].path).toBe(approved.graphic.path);
    const file = await page.request.get(approved.graphic.path);
    expect(file.ok()).toBe(true);
    expect(pngSize(await file.body())).toEqual(SIZES[approved.platform]);
    // other posts still have no image saved
    expect((await week()).captions.filter((c: any) => c.graphic.path)).toHaveLength(1);

    // an approved post's graphic can't be changed any more
    const change = await page.request.put(`${BACKEND}/ours/captions/${firstId}/graphic`, {
      headers: { auth, 'content-type': 'application/json' },
      data: { layout: 'statement' },
    });
    expect(change.status()).toBe(400);

    // the Sandbox page shows the recorded image, labelled as a sandbox post
    await page.goto(`/sandbox/${approved.postId}`);
    await expect(page.getByTestId('sandbox-post')).toBeVisible();
    await expect(page.getByTestId('sandbox-post-image')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/graphics-sandbox-post.png', fullPage: true });

    // phone width: previews stack above the text, nothing spills sideways
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/captions');
    await expect(page.getByTestId('caption-graphic-image').first()).toBeVisible({ timeout: 60_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: 'test-results/graphics-phone.png' });
  } finally {
    await site.close();
  }
});
