// OURS: "What worked" (Milestone 8). Approved Sandbox posts report simulated
// results, labelled as such everywhere; with only a few posts the screen says
// there isn't enough to go on and changes nothing. Also checks that the
// public API can no longer schedule a post without the owner's approval.
// Needs the stack running with SANDBOX_CHANNEL_ENABLED=true,
// OURS_BILLING_MODE=test, OURS_CRAWLER_ALLOW_PRIVATE=true and no
// ANTHROPIC_API_KEY. See ours/README.md.
import { expect, test } from '@playwright/test';
import { BACKEND, setUkDates, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

test('simulated results are labelled, small samples change nothing, and the API cannot skip approval', async ({ page }) => {
  const site = await startTestSite();
  try {
    await signUp(page);
    await setUkDates(page, { enabled: false });
    await page.getByText('Sandbox (test only, never publishes)').first().click();
    await page.fill('input[name="name"]', 'Results Cafe');
    await page.getByRole('button', { name: 'Connect' }).click();
    await page.waitForURL(/added=sandbox/);
    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
    const headers = { auth, 'content-type': 'application/json' };

    // nothing approved yet: the empty state
    await page.goto('/results');
    await expect(page.getByTestId('results-heading')).toHaveText('What worked');
    await expect(page.getByTestId('results-empty')).toContainText('Nothing to look at yet');

    await page.goto('/business-profile');
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });
    await page.goto('/captions');
    await page.getByRole('button', { name: 'Write next week’s posts' }).click();
    await expect(page.getByTestId('captions-summary')).toBeVisible({ timeout: 90_000 });
    // no results yet, so the week isn't steered by anything
    await expect(page.getByTestId('captions-learning-notice')).toHaveCount(0);

    // approve three posts on the Sandbox channel
    const week = (await (await page.request.get(`${BACKEND}/ours/captions`, { headers })).json()).week;
    const { channels } = await (await page.request.get(`${BACKEND}/ours/captions/channels`, { headers })).json();
    const approved = week.captions.slice(0, 3);
    for (const c of approved) {
      const res = await page.request.post(`${BACKEND}/ours/captions/${c.id}/approve`, {
        headers,
        data: { integrationId: channels[0].id },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    const after = (await (await page.request.get(`${BACKEND}/ours/captions`, { headers })).json()).week;
    const postIds = after.captions.filter((c: any) => c.status === 'APPROVED').map((c: any) => c.postId);
    expect(postIds).toHaveLength(3);

    // Two of them go out now: the owner moves them to now in the calendar
    // (upstream's own route) and the scheduler sends them through the
    // Sandbox. The third stays next week.
    for (const postId of postIds.slice(0, 2)) {
      const res = await page.request.put(`${BACKEND}/posts/${postId}/date`, {
        headers,
        data: { date: new Date(Date.now() + 5_000).toISOString().slice(0, 19), action: 'schedule' },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    for (const postId of postIds.slice(0, 2)) {
      await expect
        .poll(
          async () =>
            (await (await page.request.get(`${BACKEND}/posts/${postId}`, { headers })).json())?.posts?.[0]?.state,
          { timeout: 5 * 60 * 1000, intervals: [5_000] }
        )
        .toBe('PUBLISHED');
    }

    await page.goto('/results');
    await expect(page.getByTestId('results-simulated')).toContainText('Simulated results');
    await expect(page.getByTestId('results-simulated')).toContainText('No real people saw these posts');
    await expect(page.getByTestId('results-not-enough')).toContainText('We have results for 2 posts');
    await expect(page.getByTestId('results-not-enough')).toContainText('we won’t change anything');
    await expect(page.getByTestId('results-next-week')).toContainText('Nothing changes yet');
    const posts = page.getByTestId('results-post');
    await expect(posts).toHaveCount(2);
    await expect(posts.first()).toContainText('Simulated');
    await expect(posts.first().getByTestId('results-post-numbers')).toContainText(/\d+ interactions · seen by \d+/);
    // no conclusions drawn from two posts
    await expect(page.getByTestId('results-findings')).toHaveCount(0);
    await expect(page.getByTestId('results-breakdown')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/results-simulated.png', fullPage: true });

    // the same numbers on a second visit (simulated results are repeatable)
    const first = await (await page.request.get(`${BACKEND}/ours/performance`, { headers })).json();
    expect(first).toMatchObject({ source: 'simulated', approvedPosts: 3, measuredPosts: 2, enough: false, preferences: null });
    const second = await (await page.request.get(`${BACKEND}/ours/performance`, { headers })).json();
    expect(second.recent).toEqual(first.recent);

    // phone width: no sideways scrolling
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId('results-not-enough')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/results-phone.png', fullPage: true });

    // the public API can save a draft, but can't schedule without approval
    const self = await (await page.request.get(`${BACKEND}/user/self`, { headers })).json();
    expect(self.publicApi).toBeTruthy();
    const apiHeaders = { Authorization: self.publicApi, 'content-type': 'application/json' };
    const post = (type: string) => ({
      type,
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: channels[0].id },
          value: [{ content: '<p>From the public API</p>', image: [] }],
          settings: { __type: 'sandbox' },
        },
      ],
    });
    const scheduled = await page.request.post(`${BACKEND}/public/v1/posts`, { headers: apiHeaders, data: post('schedule') });
    expect(scheduled.status(), await scheduled.text()).toBe(403);
    expect(await scheduled.text()).toContain('Posting from outside the app is switched off');
    const draft = await page.request.post(`${BACKEND}/public/v1/posts`, { headers: apiHeaders, data: post('draft') });
    expect(draft.ok(), await draft.text()).toBeTruthy();
    const [{ postId: draftId }] = await draft.json();
    // and the draft can't be switched to scheduled through the API either
    const status = await page.request.put(`${BACKEND}/public/v1/posts/${draftId}/status`, {
      headers: apiHeaders,
      data: { status: 'schedule' },
    });
    expect(status.status(), await status.text()).toBe(403);
  } finally {
    await site.close();
  }
});
