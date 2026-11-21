// Main journey: sign up -> add the Sandbox channel -> schedule a post ->
// the scheduler sends it -> it is shown as a sandbox post, recorded as sent.
// Needs SANDBOX_CHANNEL_ENABLED=true for the backend and orchestrator.
import { test, expect } from '@playwright/test';
import { BACKEND, signUp } from './helpers';

const londonNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { day: get('day'), hour: get('hour'), minute: get('minute') };
};

test('sandbox post is scheduled, sent by the scheduler and shown as a sandbox post', async ({ page }) => {
  await signUp(page);

  // Add the Sandbox channel from the onboarding channel list.
  await page.getByText('Sandbox (test only, never publishes)').first().click();
  await page.fill('input[name="name"]', 'E2E Cafe');
  await page.getByRole('button', { name: 'Connect' }).click();
  await page.waitForURL(/added=sandbox/);

  // The onboarding list shows it straight away, without a page refresh
  // (found in the persona test: it still offered "Continue without channels").
  await expect(page.getByText(/Connected Channels \(1\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue without channels' })).toHaveCount(0);

  // The channel is listed, labelled as a sandbox.
  await page.goto('/launches');
  await expect(page.getByText('Sandbox · E2E Cafe').filter({ visible: true }).first()).toBeVisible();

  // Open the post editor.
  await page.getByText('Create Post').first().click();
  const avatar = page.locator('img[src*="/icons/platforms/sandbox.png"]').first();
  await expect(avatar).toBeAttached();
  await page.waitForTimeout(1500);
  await avatar.click({ force: true });
  await page.locator('[contenteditable=true]').first().click();
  const message = `Sandbox e2e ${Date.now()}`;
  await page.keyboard.type(message);

  // Selecting the channel enables scheduling.
  await expect(page.getByText('Add to Calendar').first()).toBeVisible();

  // Schedule it two minutes from now (today, UK time).
  // Skip the minute boundary near midnight to keep "today" unambiguous.
  let { hour, minute } = londonNow();
  test.skip(hour === 23 && minute >= 55, 'too close to midnight');
  minute += 2;
  if (minute >= 60) {
    minute -= 60;
    hour += 1;
  }
  await page.getByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/).filter({ visible: true }).first().click();
  // Pick today in the calendar. Days from the neighbouring months repeat at
  // the start (23+) and end (1-6) of the grid, so take the in-month one.
  const day = londonNow().day;
  const dayButtons = page.getByRole('button', { name: String(day), exact: true });
  await (day <= 15 ? dayButtons.first() : dayButtons.last()).click();
  const hours = page.getByRole('textbox', { name: 'Pick time' });
  await hours.fill(String(hour).padStart(2, '0'));
  const minutes = page.getByRole('textbox', { name: '--' }).last();
  await minutes.fill(String(minute).padStart(2, '0'));
  await minutes.blur();
  const expected = new RegExp(`\\d{2}/\\d{2}/\\d{4} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  await page.getByRole('button', { name: 'Close', exact: true }).filter({ hasText: 'Close' }).click();
  await expect(page.getByText(expected).filter({ visible: true }).first()).toBeVisible();

  const saved = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/posts'
  );
  await page.locator('button.btnSub').filter({ hasText: 'Add to Calendar' }).click({ position: { x: 40, y: 22 } });
  const saveResponse = await saved;
  expect(saveResponse.status(), await saveResponse.text()).toBeLessThan(300);
  const [{ postId }] = await saveResponse.json();
  // The editor closes once the post is saved.
  await expect(page.getByText('Post Preview')).toBeHidden({ timeout: 30_000 });

  // Wait for the scheduler to fire and the post to be recorded as sent.
  const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
  let post: any;
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`${BACKEND}/posts/${postId}`, { headers: { auth } });
        post = (await res.json())?.posts?.[0];
        return post?.state;
      },
      { timeout: 5 * 60 * 1000, intervals: [10_000] }
    )
    .toBe('PUBLISHED');

  expect(post.integration.providerIdentifier).toBe('sandbox');
  expect(post.releaseURL).toContain(`/sandbox/${postId}`);

  // The release link opens our sandbox page, never a real platform.
  await page.goto(`/sandbox/${postId}`);
  await expect(page.getByRole('heading', { name: 'Sandbox post' })).toBeVisible();
  await expect(page.getByText('never sent to any real social media platform')).toBeVisible();
  const card = page.getByTestId('sandbox-post');
  await expect(card).toContainText('Recorded as sent');
  await expect(card).toContainText('Sandbox · E2E Cafe');
  await expect(card).toContainText(message);
  await page.screenshot({ path: 'test-results/sandbox-post.png' });

  // The post preview (and its shared view) keeps the Sandbox label.
  await page.goto(`/p/${postId}?share=true`);
  await expect(page.getByTestId('sandbox-preview-marker')).toContainText('never sent to any real social media platform');
  await page.screenshot({ path: 'test-results/sandbox-preview.png' });

  // So does its row in the calendar's list view.
  await page.goto('/launches?display=list');
  await page.getByText('Published', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('sandbox-calendar-marker').first()).toContainText('Test only, never publishes');
  await page.screenshot({ path: 'test-results/sandbox-list-row.png' });
});
