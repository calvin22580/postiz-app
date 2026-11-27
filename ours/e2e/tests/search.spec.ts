// OURS: "How people find you" D1. From a business profile, searches are
// suggested with simulated figures (labelled), the owner chooses which ones we
// watch, adds one of their own and stops watching one.
// Needs the stack running with OURS_SEARCH_REPORT=true,
// OURS_CRAWLER_ALLOW_PRIVATE=true and no OURS_DATAFORSEO_LOGIN (Simulated
// figures, no cost). Skipped when OURS_SEARCH_REPORT is off.
import { expect, test } from '@playwright/test';
import { BACKEND, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

test('suggests searches from the profile and watches only the ones the owner chooses', async ({ page }) => {
  const site = await startTestSite();
  try {
    await signUp(page);
    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')?.value;
    const headers = { auth: auth!, 'content-type': 'application/json' };
    const overview = await (await page.request.get(`${BACKEND}/ours/search`, { headers })).json();
    test.skip(!overview.enabled, 'OURS_SEARCH_REPORT is off');

    // without a profile, the section asks for one first
    await page.goto('/results');
    await expect(page.getByTestId('search-section')).toBeVisible();
    await expect(page.getByTestId('search-simulated')).toBeVisible();
    await expect(page.getByTestId('search-no-profile')).toBeVisible();

    await page.goto('/business-profile');
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });
    // the demo extractor doesn't read a town; the owner adds it, as they can
    const res = await page.request.put(`${BACKEND}/ours/business-profile/fields/location`, {
      headers,
      data: { values: ['Exampletown'] },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto('/results');
    await expect(page.getByTestId('search-none-tracked')).toBeVisible();
    await expect(page.getByTestId('search-suggest-start')).toContainText('2 services');
    await expect(page.getByTestId('search-suggest-start')).toContainText('in and around Exampletown');
    await page.getByTestId('search-suggest').click();

    const suggestions = page.getByTestId('search-suggestions');
    await expect(suggestions).toBeVisible();
    await expect(suggestions.locator('[data-keyword="sourdough loaves exampletown"]')).toBeVisible();
    await expect(suggestions.locator('[data-keyword="celebration cakes to order near me"]')).toBeVisible();

    // the four local searches start ticked; untick one, tick a topic
    await expect(suggestions.getByTestId('search-pick').and(page.locator(':checked'))).toHaveCount(4);
    await suggestions.locator('[data-keyword="sourdough loaves near me"]').getByTestId('search-pick').uncheck();
    await suggestions.getByTestId('search-row').nth(4).getByTestId('search-pick').check();
    await page.getByTestId('search-track').click();

    const tracked = page.getByTestId('search-tracked');
    await expect(tracked).toContainText('Watching 4 of 10');
    await expect(tracked.locator('[data-keyword="sourdough loaves exampletown"]')).toBeVisible();
    await expect(tracked.locator('[data-keyword="sourdough loaves near me"]')).toHaveCount(0);

    // turn down a suggestion: it goes and isn't suggested again
    await suggestions.locator('[data-keyword="sourdough loaves near me"]').getByTestId('search-remove').click();
    await expect(page.locator('[data-keyword="sourdough loaves near me"]')).toHaveCount(0);

    // the owner's own search, tidied
    await page.getByLabel('Add a search of your own').fill('  Bakery, EXAMPLETOWN ');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(tracked.locator('[data-keyword="bakery exampletown"]')).toContainText('Monthly searches not checked yet');
    await expect(tracked).toContainText('Watching 5 of 10');

    // stop watching one
    await tracked.locator('[data-keyword="bakery exampletown"]').getByTestId('search-remove').click();
    await expect(tracked).toContainText('Watching 4 of 10');

    // the plan's limit holds on the server too
    const ids = (await (await page.request.get(`${BACKEND}/ours/search`, { headers })).json()).suggestions.map(
      (s: { id: string }) => s.id
    );
    if (ids.length > 6) {
      const over = await page.request.post(`${BACKEND}/ours/search/track`, { headers, data: { ids } });
      expect(over.status()).toBe(403);
      expect((await over.json()).message).toContain('watches up to 10 searches');
    }
  } finally {
    await site.close();
  }
});
