// OURS: plans and usage (Milestone 7). A new account starts on the free
// trial; in test mode the owner switches to Starter with no payment; each
// piece of work is counted on the plan screen; a used-up allowance and the
// channel limit stop the owner with a plain reason and a link to the plan.
// Needs the stack running with OURS_BILLING_MODE=test,
// SANDBOX_CHANNEL_ENABLED=true, OURS_CRAWLER_ALLOW_PRIVATE=true and no
// ANTHROPIC_API_KEY. See ours/README.md.
import { expect, Page, test } from '@playwright/test';
import { BACKEND, setUkDates, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

const meter = (page: Page, key: string) => page.getByTestId(`plan-meter-${key}`);
const expectUsed = async (page: Page, key: string, used: number, limit: number) => {
  await expect(meter(page, key)).toHaveAttribute('data-used', String(used));
  await expect(meter(page, key)).toHaveAttribute('data-limit', String(limit));
};

const connectSandbox = async (page: Page, name: string, fromOnboarding: boolean) => {
  if (!fromOnboarding) {
    await page.goto('/launches');
    await page.getByRole('button', { name: /add channel/i }).first().click();
  }
  await page.getByText('Sandbox (test only, never publishes)').first().click();
  await page.fill('input[name="name"]', name);
  await page.getByRole('button', { name: 'Connect' }).click();
  await page.waitForURL(/added=sandbox/);
};

test('trial, switching plan, counting usage and stopping at a limit', async ({ page }) => {
  const site = await startTestSite();
  try {
    await signUp(page);
    await setUkDates(page, { enabled: false });
    await connectSandbox(page, 'Plan Cafe', true);

    // 1. a new account is on the free trial
    await page.goto('/plan');
    await expect(page.getByTestId('plan-heading')).toBeVisible();
    await expect(page.getByTestId('plan-current-name')).toHaveText('Free trial');
    await expect(page.getByTestId('plan-trial')).toContainText(/ends on \d{2}\/\d{2}\/\d{4} \(14 days left\)/);
    await expect(page.getByTestId('plan-test-mode')).toContainText('no payment is taken');
    await expectUsed(page, 'postsScheduled', 0, 15);
    await expectUsed(page, 'channels', 1, 3);

    // 2. three plans in pounds, before any VAT
    const options = page.getByTestId('plan-option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toContainText('Starter');
    await expect(options.nth(0)).toContainText('£79 a month');
    await expect(options.nth(1)).toContainText('£149 a month');
    await expect(options.nth(2)).toContainText('£299 a month');
    await expect(page.getByTestId('plan-vat')).toHaveText('Prices are per month. No VAT is added.');

    // 3. switch to Starter (test mode, nothing charged)
    await page.locator('[data-testid="plan-option"][data-plan="starter"]').getByTestId('plan-option-choose').click();
    await expect(page.getByTestId('plan-current-name')).toHaveText('Starter');
    await expect(page.locator('[data-plan="starter"]').getByTestId('plan-option-current')).toBeVisible();
    await expect(page.getByTestId('plan-resets')).toContainText(/next resets on 01\/\d{2}\/\d{4}/);
    await expectUsed(page, 'profileBuilds', 0, 2);
    await expectUsed(page, 'channels', 1, 2);

    // 4. reading the website counts, twice is Starter's allowance
    await page.goto('/business-profile');
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Read my website again' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('button', { name: 'Read my website again' })).toBeEnabled({ timeout: 90_000 });

    // a third read is refused, with the reason and a link to the plan
    await page.getByRole('button', { name: 'Read my website again' }).click();
    const refusal = page.getByRole('alert').filter({ hasText: 'website reads' });
    await expect(refusal).toContainText(
      /You’ve used all 2 website reads included in your Starter plan this month\. It resets on 01\/\d{2}\/\d{4}\. Growth includes 4 a month: see Plan and usage\./
    );
    await expect(refusal.getByTestId('plan-link')).toHaveAttribute('href', '/plan');

    // 5. a week of posts, one approved
    await page.goto('/captions');
    await page.getByRole('button', { name: 'Write next week’s posts' }).click();
    await expect(page.getByTestId('captions-summary')).toBeVisible({ timeout: 90_000 });
    const first = page.getByTestId('caption-card').first();
    await first.getByRole('button', { name: /Approve and schedule on Sandbox · Plan Cafe/ }).click();
    await expect(first.getByTestId('caption-status')).toHaveText('Approved and scheduled');

    // 6. the plan screen shows what was used
    await page.goto('/plan');
    await expectUsed(page, 'profileBuilds', 2, 2);
    await expect(meter(page, 'profileBuilds')).toContainText('2 of 2, all used');
    await expectUsed(page, 'captionWeeks', 1, 5);
    await expectUsed(page, 'postsScheduled', 1, 25);
    await expectUsed(page, 'rewrites', 0, 20);
    await page.screenshot({ path: 'test-results/plan-usage.png', fullPage: true });

    // 7. channel limit: Starter allows 2
    await connectSandbox(page, 'Plan Cafe Two', false);
    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
    const res = await page.request.get(`${BACKEND}/integrations/social/sandbox`, { headers: { auth } });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe(
      'Your Starter plan includes 2 connected channels, and you’re using 2. Remove one to connect another, or move to Growth (4 channels) on Plan and usage.'
    );
    await page.goto('/plan');
    await expectUsed(page, 'channels', 2, 2);

    // 8. readable on a phone, no sideways scrolling
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/plan');
    await expect(page.getByTestId('plan-current-name')).toHaveText('Starter');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/plan-phone.png', fullPage: true });
  } finally {
    await site.close();
  }
});
