// The Sandbox channel must not be offered when SANDBOX_CHANNEL_ENABLED is off.
// Run against a stack started without the variable:
//   E2E_SANDBOX_EXPECTED=off pnpm exec playwright test sandbox-disabled
import { test, expect } from '@playwright/test';
import { providerIdentifiers, signUp } from './helpers';

test('Sandbox channel is unavailable when its environment variable is off', async ({ page, request }) => {
  test.skip(
    process.env.E2E_SANDBOX_EXPECTED !== 'off',
    'needs a stack started without SANDBOX_CHANNEL_ENABLED (set E2E_SANDBOX_EXPECTED=off)'
  );
  await signUp(page);
  expect(await providerIdentifiers(page, request)).not.toContain('sandbox');
  await expect(page.getByText('Sandbox (test only, never publishes)')).toHaveCount(0);
  await expect(page.getByText('LinkedIn').first()).toBeVisible();
});
