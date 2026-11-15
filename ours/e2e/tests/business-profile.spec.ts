// OURS: website URL → business profile → edit → save, in the real app.
// Needs the stack running with OURS_CRAWLER_ALLOW_PRIVATE=true (so the
// backend may read the local test site) and no ANTHROPIC_API_KEY (demo
// extractor, no AI cost). See ours/README.md.
import { expect, test } from '@playwright/test';
import { signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

test('builds a sourced profile from a website, then saves an owner edit', async ({ page }) => {
  const site = await startTestSite();
  try {
    await signUp(page);

    // the menu has our entry; the page opens on the empty state
    await expect(page.locator('a[href="/business-profile"]').first()).toBeAttached();
    await page.goto('/business-profile');
    await expect(page.getByText('Let’s get to know your business')).toBeVisible();

    // a bad address is refused with a readable message
    await page.getByLabel('Your website address').fill('ftp://nope');
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-error')).toContainText('Only web addresses');

    // URL → progress → profile
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('profile-summary')).toContainText('Built from 4 pages');
    await expect(page.getByTestId('profile-demo-notice')).toBeVisible();

    // every shown claim has a source link to a page we read
    const name = page.getByTestId('profile-field-businessName');
    await expect(name).toContainText('Harbour Lane Bakery');
    await expect(name.getByRole('link', { name: 'Source: Homepage' })).toHaveAttribute('href', site.url);
    const services = page.getByTestId('profile-field-services');
    await expect(services).toContainText('Sourdough loaves');
    await expect(services.getByTestId('claim-source').first()).toContainText('Source:');
    await expect(page.getByTestId('profile-field-email')).toContainText('hello@harbourlane.example');

    // nothing invented: hidden text and robots-blocked pages are not used
    await expect(page.locator('body')).not.toContainText('Best Bakery 2024');
    await expect(page.locator('body')).not.toContainText('Staff only');
    await expect(page.getByTestId('profile-field-audience').getByTestId('not-found')).toBeVisible();

    // edit → save → marked as owner-entered, and it survives a reload
    const audience = page.getByTestId('profile-field-audience');
    await audience.getByRole('button', { name: 'Add' }).click();
    await audience.getByLabel('Who your customers are').fill('Local families and cafés in Exampletown');
    await audience.getByRole('button', { name: 'Save' }).click();
    await expect(audience).toContainText('Local families and cafés in Exampletown');
    await expect(audience.getByTestId('owner-entered')).toHaveText('Added by you');

    await page.reload();
    const reloaded = page.getByTestId('profile-field-audience');
    await expect(reloaded).toContainText('Local families and cafés in Exampletown');
    await expect(reloaded.getByTestId('owner-entered')).toBeVisible();
    await expect(page.getByTestId('profile-field-businessName').getByTestId('claim-source')).toBeVisible();
  } finally {
    await site.close();
  }
});
