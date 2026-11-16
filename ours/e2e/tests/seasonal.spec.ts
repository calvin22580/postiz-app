// OURS: UK dates in posts (Milestone 6). The owner sees the dates coming up,
// each with a source link, picks their nation, skips one date, and the week
// written next only uses dates they kept, shown on the post with the source.
// Dates depend on today, so the exact names are only checked for the week of
// 23/11/2026; the rules are checked whatever the date.
// Needs the stack running with SANDBOX_CHANNEL_ENABLED=true,
// OURS_CRAWLER_ALLOW_PRIVATE=true and no ANTHROPIC_API_KEY. See ours/README.md.
import { expect, test } from '@playwright/test';
import { BACKEND, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

test('UK dates: pick a nation, skip a date, and see sourced dates on posts', async ({ page }) => {
  const site = await startTestSite();
  try {
    await signUp(page);
    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
    const api = async (path: string) =>
      (await (await page.request.get(`${BACKEND}${path}`, { headers: { auth } })).json());

    await page.goto('/business-profile');
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });

    // before any week is written, the panel is there with England assumed
    await page.goto('/captions');
    const panel = page.getByTestId('uk-dates');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('uk-dates-default-note')).toBeVisible();
    await expect(page.getByTestId('uk-dates-nation')).toHaveValue('england');

    // Scotland: saved, and the "assumed England" note goes
    await page.getByTestId('uk-dates-nation').selectOption('scotland');
    await expect(page.getByTestId('uk-dates-default-note')).toHaveCount(0);
    let overview = await api('/ours/seasonal');
    expect(overview).toMatchObject({ nation: 'scotland', enabled: true, chosen: true });

    // every date listed links to its source
    const rows = panel.getByTestId('uk-date');
    const listed = overview.upcoming.length;
    if (listed) {
      await expect(rows.first()).toBeVisible();
      for (const href of await panel.getByTestId('uk-date-source').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
        expect(href).toMatch(/^https:\/\//);
      }
    }

    // skip the first date that can be used in posts
    const first = overview.upcoming.find((d: any) => d.usedInPosts);
    if (first) {
      const row = panel.locator(`[data-testid="uk-date"][data-key="${first.key}"]`).first();
      await row.getByTestId('uk-date-toggle').click();
      await expect(row).toHaveAttribute('data-skipped', 'true');
      await expect(row.getByTestId('uk-date-toggle')).toHaveText('Use this date');
      overview = await api('/ours/seasonal');
      expect(overview.upcoming.find((d: any) => d.key === first.key).skipped).toBe(true);
    }
    await page.screenshot({ path: 'test-results/uk-dates-panel.png', fullPage: true });

    // write the week: any date used is one the owner kept, with its source
    await page.getByRole('button', { name: 'Write next week’s posts' }).click();
    await expect(page.getByTestId('captions-summary')).toBeVisible({ timeout: 90_000 });
    const week = (await api('/ours/captions')).week;
    const dated = week.captions.filter((c: any) => c.facts.some((f: any) => f.field === 'seasonal'));
    for (const c of dated) {
      const date = c.facts.find((f: any) => f.field === 'seasonal');
      expect(date.source.url).toMatch(/^https:\/\//);
      expect(date.id).not.toContain(first?.key || 'nothing-skipped');
      // a date never stands alone: the post also uses the profile
      expect(c.facts.some((f: any) => f.field !== 'seasonal')).toBe(true);
    }
    if (week.weekStart === '2026-11-23') {
      // Black Friday was skipped, so the nearest kept date in Scotland is
      // St Andrew's Day (Monday 30/11/2026, a bank holiday there)
      expect(first.key).toBe('black-friday');
      expect(dated.map((c: any) => c.theme)).toEqual(Array(3).fill('Coming up: St Andrew’s Day'));
    }
    if (dated.length) {
      const note = page.getByTestId('caption-uk-date').first();
      await expect(note).toBeVisible();
      await expect(note.getByRole('link')).toHaveAttribute('href', /^https:\/\//);
    }
    await page.screenshot({ path: 'test-results/uk-dates-week.png', fullPage: true });

    // turning dates off says so
    // (the box follows the saved setting, so click and wait for it)
    await page.getByTestId('uk-dates-enabled').click();
    await expect(page.getByTestId('uk-dates-off')).toBeVisible();
    expect((await api('/ours/seasonal')).enabled).toBe(false);

    // phone width: no sideways scrolling
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('uk-dates-enabled').click();
    await expect(page.getByTestId('uk-dates-off')).toHaveCount(0);
    await expect(page.getByTestId('uk-dates-enabled')).toBeChecked();
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(scroll).toBeLessThanOrEqual(0);
    await panel.screenshot({ path: 'test-results/uk-dates-phone.png' });
  } finally {
    await site.close();
  }
});
