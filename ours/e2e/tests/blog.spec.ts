// OURS: blog posts (B1). The owner says what's new, a blog post is written
// from the profile and their news, then edited, rewritten, rejected, brought
// back and approved, and copied for their website. Nothing is published.
// Needs the stack running with OURS_BLOG_POSTS=true,
// OURS_CRAWLER_ALLOW_PRIVATE=true and no ANTHROPIC_API_KEY (demo writer, no
// AI cost). With OURS_BLOG_POSTS off the card is hidden and the test is
// skipped. See ours/README.md.
import { expect, test } from '@playwright/test';
import { BACKEND, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

test('writes a blog post from the profile and the owner’s news, and copies it once approved', async ({ page, context }) => {
  const site = await startTestSite();
  try {
    await signUp(page);
    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
    const overview = async () => (await (await page.request.get(`${BACKEND}/ours/blog-posts`, { headers: { auth } })).json());
    test.skip(!(await overview()).on, 'OURS_BLOG_POSTS is off');

    // writing needs a finished business profile
    const early = await page.request.post(`${BACKEND}/ours/blog-posts/write`, { headers: { auth, 'content-type': 'application/json' }, data: {} });
    expect(early.status()).toBe(400);

    await page.goto('/business-profile');
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });

    // the card on the weekly posts screen; the trial includes one post
    await page.goto('/captions');
    const panel = page.getByTestId('blog-panel');
    await expect(panel).toContainText('Blog post for your website');
    await expect(page.getByTestId('blog-allowance')).toHaveText('0 of 1 written in your free trial');
    await page.screenshot({ path: 'test-results/blog-empty.png', fullPage: true });

    await page.getByTestId('blog-news').fill('We now bake sourdough on Saturdays.');
    await page.getByTestId('blog-write-go').click();
    const post = page.getByTestId('blog-post');
    await expect(post).toHaveAttribute('data-status', 'PENDING_APPROVAL', { timeout: 90_000 });
    await expect(page.getByTestId('blog-allowance')).toHaveText('1 of 1 written in your free trial');
    await expect(page.getByTestId('blog-status')).toHaveText('Waiting for your approval');
    await expect(page.getByTestId('blog-demo-notice')).toBeVisible();
    await expect(page.getByTestId('blog-title')).toHaveText('News from Harbour Lane Bakery');
    await expect(page.getByTestId('blog-description')).toContainText('Search description');
    await page.getByTestId('blog-expand').click();
    const body = page.getByTestId('blog-body');
    await expect(body).toContainText('We now bake sourdough on Saturdays.');
    await expect(body).toContainText('01632 960123');
    // only profile facts: hidden or invented details never
    await expect(panel).not.toContainText('Best Bakery 2024');
    await expect(body.locator('h4').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/blog-waiting.png', fullPage: true });

    // rewrite: in demo mode the other prepared version
    await page.getByTestId('blog-rewrite').click();
    await expect(page.getByTestId('blog-rewrite-panel')).toContainText('3 new versions left');
    await page.getByTestId('blog-rewrite-go').click();
    await expect(page.getByTestId('blog-title')).toHaveText('A guide to what Harbour Lane Bakery offers');
    await expect(page.getByTestId('blog-rewrite-panel')).toHaveCount(0);

    // an owner edit is kept, and a detail that isn't in the profile is pointed out
    await page.getByTestId('blog-edit').click();
    await page.getByTestId('blog-edit-title').fill('Sourdough Saturdays at Harbour Lane Bakery');
    const edited = (await page.getByTestId('blog-edit-body').inputValue()) + '\n\nWe have been baking since 1998.';
    await page.getByTestId('blog-edit-body').fill(edited);
    await page.getByTestId('blog-edit-save').click();
    await expect(page.getByTestId('blog-title')).toHaveText('Sourdough Saturdays at Harbour Lane Bakery');
    await expect(post).toContainText('Edited by you');
    await expect(page.getByTestId('blog-check-note')).toContainText('“1998”');

    // a broken edit is turned away with a plain reason
    await page.getByTestId('blog-edit').click();
    await page.getByTestId('blog-edit-body').fill('Too short.');
    await page.getByTestId('blog-edit-save').click();
    await expect(page.getByTestId('blog-error')).toContainText('at least 80 words');
    await page.getByRole('button', { name: 'Cancel' }).click();

    // rejected with a reason, then brought back
    await page.getByTestId('blog-reject').click();
    await expect(page.getByTestId('blog-status')).toHaveText('Rejected');
    await page.getByTestId('blog-reject-reason-topic').click();
    await expect(page.getByTestId('blog-reject-reason-topic')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('blog-none-left')).toContainText('all the blog posts included this trial');
    await page.getByTestId('blog-restore').click();
    await expect(page.getByTestId('blog-status')).toHaveText('Waiting for your approval');

    // nothing to copy until it is approved
    await expect(page.getByTestId('blog-copy')).toHaveCount(0);
    await page.getByTestId('blog-approve').click();
    await expect(page.getByTestId('blog-status')).toHaveText('Approved');
    await expect(post).toContainText(/Approved on \d{2}\/\d{2}\/\d{4}/);

    // copied for the website: HTML has headings and paragraphs, plain text none
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('blog-copy-html').click();
    await expect(page.getByTestId('blog-copy-html')).toHaveText('Copied');
    const html = await page.evaluate(() => navigator.clipboard.readText());
    expect(html).toContain('<h2>');
    expect(html).toContain('<p>');
    expect(html).not.toContain('<script');
    await page.getByTestId('blog-copy-text').click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Harbour Lane Bakery');
    expect(text).not.toMatch(/<\/?[a-z]/);
    expect(text).not.toContain('## ');
    await page.getByTestId('blog-copy-title').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Sourdough Saturdays at Harbour Lane Bakery');
    await page.screenshot({ path: 'test-results/blog-approved.png', fullPage: true });

    // the trial's one post is used; approving twice and other organisations' ids get nowhere
    await expect(page.getByTestId('blog-none-left')).toBeVisible();
    const { posts } = await overview();
    expect(posts).toHaveLength(1);
    expect(posts[0].status).toBe('APPROVED');
    const again = await page.request.post(`${BACKEND}/ours/blog-posts/${posts[0].id}/approve`, { headers: { auth } });
    expect(again.status()).toBe(400);
    const other = await page.request.post(`${BACKEND}/ours/blog-posts/not-a-real-id/approve`, { headers: { auth } });
    expect(other.status()).toBe(404);
    const more = await page.request.post(`${BACKEND}/ours/blog-posts/write`, { headers: { auth, 'content-type': 'application/json' }, data: {} });
    expect(more.status()).toBe(403);
  } finally {
    await site.close();
  }
});
