// OURS: the review screen (Milestone 5). The owner edits one post, rewrites
// another (demo mode, no AI cost), rejects one, brings it back, rejects
// another for good, then approves everything that's left. Only the approved
// posts are scheduled, on the Sandbox channel, with the owner's own wording.
// Needs the stack running with SANDBOX_CHANNEL_ENABLED=true,
// OURS_CRAWLER_ALLOW_PRIVATE=true and no ANTHROPIC_API_KEY. See ours/README.md.
import { expect, test } from '@playwright/test';
import { BACKEND, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

test('edit, rewrite, reject and approve all on the review screen', async ({ page }) => {
  const site = await startTestSite();
  try {
    await signUp(page);
    await page.getByText('Sandbox (test only, never publishes)').first().click();
    await page.fill('input[name="name"]', 'Review Cafe');
    await page.getByRole('button', { name: 'Connect' }).click();
    await page.waitForURL(/added=sandbox/);

    await page.goto('/business-profile');
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });

    await page.goto('/captions');
    await page.getByRole('button', { name: 'Write next week’s posts' }).click();
    await expect(page.getByTestId('captions-summary')).toBeVisible({ timeout: 90_000 });
    const cards = page.getByTestId('caption-card');
    await expect(cards).toHaveCount(12);
    await expect(page.getByTestId('captions-filter-PENDING_APPROVAL')).toContainText('12');

    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
    const week = async () =>
      (await (await page.request.get(`${BACKEND}/ours/captions`, { headers: { auth } })).json()).week;

    // 1. edit: the owner's own wording, with a detail that isn't in the profile
    const edited = cards.nth(0);
    const editedId = (await week()).captions[0].id;
    await edited.getByTestId('caption-edit').click();
    const ownWords = 'Fresh sourdough at Harbour Lane Bakery.\nTry our new rye loaf, £4 this week.';
    await edited.getByTestId('caption-edit-text').fill(ownWords);
    await edited.getByTestId('caption-edit-save').click();
    await expect(edited.getByTestId('caption-text')).toHaveText(ownWords);
    await expect(edited.getByTestId('caption-edited')).toBeVisible();
    // pointed out, never removed
    await expect(edited.getByTestId('caption-check-note')).toContainText('“4” and a price or percentage aren’t in your business profile');

    // an empty edit can't be saved
    const second = cards.nth(1);
    await second.getByTestId('caption-edit').click();
    await second.getByTestId('caption-edit-text').fill('   ');
    await expect(second.getByTestId('caption-edit-save')).toBeDisabled();
    await second.getByRole('button', { name: 'Cancel' }).click();

    // 2. rewrite: another prepared version in demo mode, still only profile facts
    const before = (await second.getByTestId('caption-text').textContent())!;
    await second.getByTestId('caption-rewrite').click();
    await expect(second.getByTestId('caption-rewrite-panel')).toContainText('Demo mode');
    await expect(second.getByTestId('caption-rewrite-panel')).toContainText('5 new versions left');
    await second.getByTestId('caption-rewrite-go').click();
    await expect(second.getByTestId('caption-text')).not.toHaveText(before);
    const rewritten = (await second.getByTestId('caption-text').textContent())!;
    expect(rewritten).not.toMatch(/[£%]/);
    await second.getByTestId('caption-rewrite').click();
    await expect(second.getByTestId('caption-rewrite-panel')).toContainText('4 new versions left');
    await second.getByRole('button', { name: 'Cancel' }).click();

    // 3. reject one and bring it back, then reject another for good
    const third = cards.nth(2);
    await third.getByTestId('caption-reject').click();
    await expect(third).toHaveAttribute('data-status', 'REJECTED');
    await expect(third).toContainText('This post won’t be scheduled.');
    await third.getByTestId('caption-restore').click();
    await expect(third).toHaveAttribute('data-status', 'PENDING_APPROVAL');
    const rejectedCard = cards.nth(3);
    const rejectedId = (await week()).captions[3].id;
    await rejectedCard.getByTestId('caption-reject').click();
    await expect(rejectedCard).toHaveAttribute('data-status', 'REJECTED');
    await expect(page.getByTestId('captions-filter-REJECTED')).toContainText('1');

    // the filters show only matching posts
    await page.getByTestId('captions-filter-REJECTED').click();
    await expect(cards).toHaveCount(1);
    await page.getByTestId('captions-filter-APPROVED').click();
    await expect(page.getByTestId('captions-filter-empty')).toHaveText('You haven’t approved any posts yet.');
    await page.getByTestId('captions-filter-all').click();
    await expect(cards).toHaveCount(12);

    // a rejected post can't be approved, even by calling the API directly
    const sneaky = await page.request.post(`${BACKEND}/ours/captions/${rejectedId}/approve`, {
      headers: { auth, 'content-type': 'application/json' },
      data: { integrationId: (await week()).captions[0].channelId || 'x' },
    });
    expect(sneaky.status()).toBe(400);
    await page.screenshot({ path: 'test-results/review-before-approve.png', fullPage: true });

    // 4. approve everything that's waiting, after a confirmation
    expect((await week()).captions.every((c: any) => c.postId === null)).toBe(true);
    await page.getByTestId('captions-approve-all').click();
    await expect(page.getByTestId('captions-approve-all-confirm')).toContainText('Schedule 11 posts on Sandbox · Review Cafe?');
    await page.getByTestId('captions-approve-all-yes').click();
    await expect(page.getByTestId('captions-approve-all-result')).toContainText('Approved and scheduled 11 posts.', { timeout: 120_000 });
    await expect(page.getByTestId('captions-summary')).toContainText('Nothing is waiting for you. 11 of 12 posts are approved.');

    // exactly 11 posts, all on Sandbox; the rejected one has none; the edited
    // one carries the owner's wording
    const after = await week();
    expect(after.captions.filter((c: any) => c.postId)).toHaveLength(11);
    expect(after.captions.find((c: any) => c.id === rejectedId).postId).toBeNull();
    expect(after.captions.find((c: any) => c.id === rejectedId).status).toBe('REJECTED');
    const editedPostId = after.captions.find((c: any) => c.id === editedId).postId;
    const post = (await (await page.request.get(`${BACKEND}/posts/${editedPostId}`, { headers: { auth } })).json()).posts[0];
    expect(post.integration.providerIdentifier).toBe('sandbox');
    expect(post.state).toBe('QUEUE');
    expect(post.content).toBe('<p>Fresh sourdough at Harbour Lane Bakery.</p><p>Try our new rye loaf, £4 this week.</p>');

    // approved posts can no longer be edited, rewritten or rejected
    for (const [path, method, data] of [
      ['text', 'put', { text: 'Changed' }],
      ['rewrite', 'post', {}],
      ['reject', 'post', {}],
    ] as const) {
      const res = await page.request[method](`${BACKEND}/ours/captions/${editedId}/${path}`, {
        headers: { auth, 'content-type': 'application/json' },
        data,
      });
      expect(res.status()).toBe(400);
    }

    await page.reload();
    await expect(page.getByTestId('caption-status').filter({ hasText: 'Approved and scheduled' })).toHaveCount(11);
    await expect(page.getByTestId('captions-approve-all')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/review-after-approve.png', fullPage: true });

    // phone width: no sideways scrolling
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('captions-filter-REJECTED').click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/review-phone.png', fullPage: true });
  } finally {
    await site.close();
  }
});
