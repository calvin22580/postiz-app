import { APIRequestContext, Page, expect } from '@playwright/test';

export const BACKEND = process.env.E2E_BACKEND_URL || 'http://localhost:3000';

// Fresh test account per run (local dev only, never a real person).
export const signUp = async (page: Page) => {
  const email = `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.test`;
  await page.goto('/auth');
  await page.fill('input[placeholder="Email Address"]', email);
  await page.fill('input[placeholder="Password"]', `E2e-${Date.now()}!`);
  await page.fill('input[placeholder="Company"]', 'E2E Test Cafe');
  await page.getByText('Create Account').click();
  await page.waitForURL(/\/launches/, { timeout: 120_000 });
  return email;
};

// The add-channel list as the backend serves it to this signed-in user.
export const providerIdentifiers = async (
  page: Page,
  request: APIRequestContext
) => {
  const cookies = await page.context().cookies();
  const auth = cookies.find((c) => c.name === 'auth')?.value;
  expect(auth, 'signed-in auth cookie').toBeTruthy();
  const res = await request.get(`${BACKEND}/integrations`, {
    headers: { auth: auth! },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.social as { identifier: string }[]).map((p) => p.identifier);
};
