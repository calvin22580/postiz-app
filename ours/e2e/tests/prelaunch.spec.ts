// OURS: pre-launch clean-up. (1) Upstream screens a customer shouldn't see
// are gone from the menu and redirect when typed. (2) Disconnecting a channel
// and deleting the account really erase the data, checked in the database.
// Needs the stack running with SANDBOX_CHANNEL_ENABLED=true,
// OURS_BILLING_MODE=test, OURS_CRAWLER_ALLOW_PRIVATE=true and no
// ANTHROPIC_API_KEY, and the database reachable at E2E_DATABASE_URL (default:
// the local dev database). See ours/README.md.
import { Page, expect, test } from '@playwright/test';
import { Client } from 'pg';
import { BACKEND, setUkDates, signUp } from './helpers';
import { startTestSite } from './fixtures/test.site';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  'postgresql://postiz-local:postiz-local-pwd@localhost:5432/postiz-db-local';

const query = async <T = any>(sql: string, params: unknown[]) => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
};

// The first channel is added from the onboarding screen sign-up lands on.
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

test('Agent, Analytics, Billing and Webhooks are hidden from customers', async ({ page }) => {
  await signUp(page);
  const menu = page.locator('.blurMe');
  await expect(menu.getByText('Weekly posts')).toBeVisible();
  await expect(menu.getByText('Agent', { exact: true })).toHaveCount(0);
  await expect(menu.getByText('Analytics', { exact: true })).toHaveCount(0);
  await expect(menu.getByText('Affiliate', { exact: true })).toHaveCount(0);
  await expect(menu.getByText('Billing', { exact: true })).toHaveCount(0);

  for (const [from, to] of [
    ['/agents', '/launches'],
    ['/agents/new', '/launches'],
    ['/analytics', '/results'],
    ['/billing', '/plan'],
  ]) {
    await page.goto(from);
    await page.waitForURL((url) => url.pathname === to);
  }

  await page.goto('/settings');
  await expect(page.getByText('Global Settings').first()).toBeVisible();
  await expect(page.getByText('Webhooks', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Agents / Dev', { exact: true })).toHaveCount(0);
});

test('disconnecting a channel and deleting the account erase the data', async ({ page }) => {
  const site = await startTestSite();
  try {
    const email = await signUp(page);
    await connectSandbox(page, 'Erase Cafe One', true);
    await setUkDates(page, { enabled: false });
    const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
    const headers = { auth, 'content-type': 'application/json' };
    const [{ organizationId: orgId }] = await query(
      `select uo."organizationId" from "UserOrganization" uo join "User" u on u.id = uo."userId" where u.email = $1`,
      [email]
    );

    // two channels, a profile, a week of captions, one approved post
    await connectSandbox(page, 'Erase Cafe Two', false);
    await page.goto('/business-profile');
    await page.getByLabel('Your website address').fill(site.url);
    await page.getByRole('button', { name: 'Read my website' }).click();
    await expect(page.getByTestId('profile-summary')).toBeVisible({ timeout: 90_000 });
    await page.goto('/captions');
    await page.getByRole('button', { name: 'Write next week’s posts' }).click();
    await expect(page.getByTestId('captions-summary')).toBeVisible({ timeout: 90_000 });
    const week = (await (await page.request.get(`${BACKEND}/ours/captions`, { headers })).json()).week;
    const { channels } = await (await page.request.get(`${BACKEND}/ours/captions/channels`, { headers })).json();
    const approve = await page.request.post(`${BACKEND}/ours/captions/${week.captions[0].id}/approve`, {
      headers,
      data: { integrationId: channels[0].id },
    });
    expect(approve.ok(), await approve.text()).toBeTruthy();

    const channelRows = await query<{ id: string; name: string; token: string }>(
      `select id, name, token from "Integration" where "organizationId" = $1 order by name`,
      [orgId]
    );
    expect(channelRows.map((c) => c.name)).toEqual(['Sandbox · Erase Cafe One', 'Sandbox · Erase Cafe Two']);
    const [one, two] = channelRows;

    // 1. disconnect channel two in the app's own way (upstream's route)
    const disconnect = await page.request.delete(`${BACKEND}/integrations`, {
      headers,
      data: { id: two.id },
    });
    expect(disconnect.ok(), await disconnect.text()).toBeTruthy();
    await expect
      .poll(async () => (await query(`select 1 from ours_erasure where "targetId" = $1 and kind = 'channel'`, [two.id])).length, {
        timeout: 30_000,
      })
      .toBe(1);
    const [gone] = await query(`select name, token, picture, "internalId" from "Integration" where id = $1`, [two.id]);
    // the name stays, so connecting the same page again revives the row
    expect(gone.name).toBe('Sandbox · Erase Cafe Two');
    expect(gone.token).not.toBe(two.token);
    expect(gone.token).toMatch(/^[0-9a-f]{32}$/);
    expect(gone.picture).toBeNull();
    // the channel still connected is untouched
    const [kept] = await query(`select name, token from "Integration" where id = $1`, [one.id]);
    expect(kept).toEqual({ name: 'Sandbox · Erase Cafe One', token: one.token });

    // 2. delete the account from Settings
    expect((await query(`select 1 from ours_business_profile where "organizationId" = $1`, [orgId])).length).toBe(1);
    expect((await query(`select 1 from ours_caption_draft where "organizationId" = $1`, [orgId])).length).toBeGreaterThan(0);
    // content engine E1: approving left owner signals behind
    expect((await query(`select 1 from ours_brand_signal where "organizationId" = $1`, [orgId])).length).toBeGreaterThan(0);
    const [{ count: postsBefore }] = await query(`select count(*)::int as count from "Post" where "organizationId" = $1 and content <> ''`, [orgId]);
    expect(postsBefore).toBeGreaterThan(0);

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await page.getByRole('button', { name: 'Yes, delete my account' }).click();
    await page.waitForURL(/\/auth/, { timeout: 60_000 });

    await expect
      .poll(async () => (await query(`select 1 from ours_erasure where "targetId" = $1 and kind = 'organisation'`, [orgId])).length, {
        timeout: 60_000,
      })
      .toBe(1);
    const count = async (table: string, extra = '') =>
      (await query<{ count: number }>(`select count(*)::int as count from ${table} where "organizationId" = $1 ${extra}`, [orgId]))[0].count;
    expect(await count('ours_business_profile')).toBe(0);
    expect(await count('ours_caption_draft')).toBe(0);
    expect(await count('ours_caption_week')).toBe(0);
    expect(await count('ours_seasonal_settings')).toBe(0);
    expect(await count('ours_brand_signal')).toBe(0);
    expect(await count('"Post"', `and (content <> '' or "deletedAt" is null)`)).toBe(0);
    expect(await count('"Integration"', `and name like '%Erase Cafe%'`)).toBe(0);
    // billing and AI-cost records stay (no customer content in them)
    expect(await count('ours_plan_subscription')).toBe(1);
    const [org] = await query(`select name, "apiKey", "deletedAt" from "Organization" where id = $1`, [orgId]);
    expect(org.name).toBe('Deleted organisation');
    expect(org.apiKey).toBeNull();
    expect(org.deletedAt).not.toBeNull();
    expect((await query(`select 1 from "User" where email = $1`, [email])).length).toBe(0);
  } finally {
    await site.close();
  }
});
