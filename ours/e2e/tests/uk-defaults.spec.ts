// UK date defaults and hidden developer screens, seen from a browser set to
// US English in New York, so nothing here can come from the browser itself.
// Needs the stack running without NEXT_PUBLIC_DEFAULT_LOCALE,
// NEXT_PUBLIC_DEFAULT_TIMEZONE or NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS set.
import { test, expect } from '@playwright/test';
import { signUp } from './helpers';

test.use({ locale: 'en-US', timezoneId: 'America/New_York' });

const londonDate = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

test('onboarding skips the Connect Agents step', async ({ page }) => {
  await signUp(page);
  await expect(page.getByText('Connect Your Channels')).toBeVisible();
  await expect(page.getByText('Watch Tutorial').first()).toBeVisible();
  await expect(page.getByText('Connect Agents')).toHaveCount(0);

  // Continue goes straight to the tutorial, and Back returns to channels.
  await page.getByText('Continue without channels').click();
  await expect(page.getByText(/^Learn How to Use/)).toBeVisible();
  await expect(page.getByText('Connect Your AI Agent')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Connect Your Channels')).toBeVisible();
});

test('calendar shows DD/MM/YYYY in Europe/London with a 24-hour clock', async ({ page }) => {
  await signUp(page);
  await page.goto('/launches');

  // Week view: the date range and the day headers use DD/MM/YYYY.
  await expect(
    page.getByText(/^\d{2}\/\d{2}\/\d{4} - \d{2}\/\d{2}\/\d{4}$/).first()
  ).toBeVisible();
  // Today is today in London, not New York.
  await expect(page.getByText(londonDate(), { exact: true }).first()).toBeVisible();
  // 24-hour clock in the hour column.
  await expect(page.getByText('13:00', { exact: true }).first()).toBeAttached();
  await expect(page.getByText(/^1:00 PM$/)).toHaveCount(0);

  // Settings show the London default and the 24-hour clock.
  await page.goto('/settings');
  await expect(page.locator('select[name="timezone"] option[value=""]')).toHaveText(
    'Automatic (Europe/London)'
  );
  await expect(page.locator('select[name="metric"]')).toHaveValue('GLOBAL');
});

test('settings hide the developer screens', async ({ page }) => {
  await signUp(page);
  await page.goto('/settings');
  await expect(page.getByText('Global Settings').first()).toBeVisible();
  await expect(page.getByText('Teams', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Agents / Dev')).toHaveCount(0);
  // Apps stays, showing only Approved Apps (where customers revoke access).
  await page.getByText('Apps', { exact: true }).first().click();
  await expect(page.getByText('Approved Apps').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approved Apps' })).toHaveCount(0);
  await expect(page.locator('a[href*="docs.postiz.com"]')).toHaveCount(0);

  // A direct link to the tab falls back to Global Settings.
  await page.goto('/settings?tab=agents');
  await expect(page.getByText('Global Settings').first()).toBeVisible();
  await expect(page.getByText('docs.postiz.com')).toHaveCount(0);
  await expect(page.locator('a[href*="docs.postiz.com"]')).toHaveCount(0);
});
