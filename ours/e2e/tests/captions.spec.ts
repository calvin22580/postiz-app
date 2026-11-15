// OURS: business profile → a week of captions waiting for approval → one is
// approved and scheduled on the Sandbox channel, the rest stay unscheduled.
// Needs the stack running with SANDBOX_CHANNEL_ENABLED=true,
// OURS_CRAWLER_ALLOW_PRIVATE=true and no ANTHROPIC_API_KEY (demo writer, no
// AI cost). See ours/README.md.
import { expect, test } from '@playwright/test';
import { BACKEND, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

test('writes a week of captions from the profile and schedules only the approved one', async ({ page }) => {
  const site = await startTestSite();
  try {
    await signUp(page);

    // the Sandbox channel, from the onboarding channel list
    await page.getByText('Sandbox (test only, never publishes)').first().click();
    await page.fill('input[name="name"]', 'Captions Cafe');
    await page.getByRole('button', { name: 'Connect' }).click();
    await page.waitForURL(/added=sandbox/);

    // without a profile, the captions screen sends the owner to set one up
    await expect(page.locator('a[href="/captions"]').first()).toBeAttached();
    await page.goto('/captions');
    await page.getByTestId('captions-profile-link').click();
    await page.waitForURL(/\/business-profile/);

    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });

    // write next week's captions
    await page.goto('/captions');
    await expect(page.getByText('We’ll write a post for each weekday')).toBeVisible();
    await page.getByRole('button', { name: 'Write next week’s posts' }).click();
    await expect(page.getByTestId('captions-summary')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('captions-heading')).toHaveText(
      /^Your posts for the week of Monday \d{2}\/\d{2}\/\d{4}$/
    );
    await expect(page.getByTestId('captions-demo-notice')).toBeVisible();
    await expect(page.getByTestId('captions-short-week-notice')).toContainText('enough for 4 of 5 weekdays');

    // four weekdays have enough facts in this small profile, each for three platforms
    const cards = page.getByTestId('caption-card');
    await expect(cards).toHaveCount(12);
    await expect(page.getByTestId('caption-day')).toHaveCount(4);
    await expect(page.getByTestId('caption-day').first()).toContainText(/Monday \d{2}\/\d{2}\/\d{4}/);
    for (const platform of ['facebook', 'instagram', 'linkedin']) {
      await expect(page.locator(`[data-testid="caption-card"][data-platform="${platform}"]`)).toHaveCount(4);
    }
    await expect(page.getByTestId('captions-summary')).toContainText('12 of 12 posts are waiting for your approval');
    await expect(page.getByTestId('caption-status').filter({ hasText: 'Waiting for your approval' })).toHaveCount(12);

    // only profile facts: real details are used, hidden or invented ones never
    await expect(page.locator('main, body').first()).toContainText('Harbour Lane Bakery');
    await expect(page.locator('body')).toContainText('01632 960123');
    await expect(page.locator('body')).not.toContainText('Best Bakery 2024');
    for (const text of await page.getByTestId('caption-text').allTextContents()) {
      expect(text).not.toMatch(/[£%]/);
    }

    // nothing is scheduled before approval
    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
    const week = async () =>
      (await (await page.request.get(`${BACKEND}/ours/captions`, { headers: { auth } })).json()).week;
    expect((await week()).captions.every((c: any) => c.postId === null)).toBe(true);

    // approve the first caption on the Sandbox channel
    await expect(page.getByTestId('captions-channel-note')).toContainText('Sandbox · Captions Cafe');
    await page.screenshot({ path: 'test-results/captions-pending.png', fullPage: true });
    const first = cards.first();
    await first.getByRole('button', { name: /Approve and schedule on Sandbox · Captions Cafe/ }).click();
    await expect(first.getByTestId('caption-status')).toHaveText('Approved and scheduled');
    await expect(first).toContainText('Sandbox channel (test only)');
    await expect(page.getByTestId('captions-summary')).toContainText('11 of 12 posts are waiting');

    // exactly one post exists, queued on the Sandbox channel at the planned time
    const after = await week();
    const approved = after.captions.filter((c: any) => c.status === 'APPROVED');
    expect(approved).toHaveLength(1);
    expect(after.captions.filter((c: any) => c.postId)).toHaveLength(1);
    const res = await page.request.get(`${BACKEND}/posts/${approved[0].postId}`, { headers: { auth } });
    const post = (await res.json()).posts[0];
    expect(post.integration.providerIdentifier).toBe('sandbox');
    expect(post.state).toBe('QUEUE');
    expect(new Date(post.publishDate).toISOString()).toBe(new Date(approved[0].scheduledFor).toISOString());

    // approving twice is refused
    const again = await page.request.post(`${BACKEND}/ours/captions/${approved[0].id}/approve`, {
      headers: { auth, 'content-type': 'application/json' },
      data: { integrationId: approved[0].channelId },
    });
    expect(again.status()).toBe(400);

    // the approval survives a reload, and next week can't be written twice
    await page.reload();
    await expect(page.getByTestId('caption-status').filter({ hasText: 'Approved and scheduled' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Write next week’s posts' })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/captions-approved.png', fullPage: true });
  } finally {
    await site.close();
  }
});
