// OURS: "What we've learned" (content engine E5). The owner sees what brand
// memory learned and has the last word: they add a lesson in their own
// words, change it, switch it off and back on, and delete it. Business
// details are turned away towards the profile. Needs the stack running (see
// ours/README.md); with OURS_BRAND_MEMORY off the screen says learning is off.
import { expect, test } from '@playwright/test';
import { BACKEND, signUp } from './helpers';

test('the owner adds, changes, switches off and deletes a lesson; facts go to the profile', async ({ page }) => {
  await signUp(page);
  const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
  const overview = await (await page.request.get(`${BACKEND}/ours/brand-memory`, { headers: { auth } })).json();

  await page.goto('/learned');
  await expect(page.getByTestId('memory-heading')).toHaveText('What we’ve learned');
  await expect(page.getByTestId('memory-empty')).toContainText('Nothing learned yet');
  await expect(page.getByTestId('memory-off')).toHaveCount(overview.on ? 0 : 1);

  // a detail about the business belongs in the profile
  const add = page.getByTestId('memory-add-form');
  await add.getByLabel('A lesson in your own words').fill('Say we are fully insured');
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(add.getByRole('alert')).toContainText('business profile');

  // a lesson in the owner's own words
  await add.getByLabel('A lesson in your own words').fill('Don’t use exclamation marks');
  await add.getByRole('button', { name: 'Add' }).click();
  const lesson = page.getByTestId('memory-folder-avoid').getByTestId('memory-lesson');
  await expect(lesson.getByTestId('memory-lesson-text')).toHaveText('Don’t use exclamation marks');
  await expect(lesson).toContainText('Set by you');
  await expect(page.getByTestId('memory-empty')).toHaveCount(0);

  // changed
  await lesson.getByRole('button', { name: 'Change' }).click();
  await page.getByLabel('Change this lesson').fill('Never use exclamation marks');
  await page.getByTestId('memory-edit').getByRole('button', { name: 'Save' }).click();
  await expect(lesson.getByTestId('memory-lesson-text')).toHaveText('Never use exclamation marks');

  // switched off, then back on
  await lesson.getByRole('button', { name: 'Switch off' }).click();
  await expect(page.getByTestId('memory-switched-off')).toContainText('Never use exclamation marks');
  await expect(page.getByTestId('memory-lesson')).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch back on' }).click();
  await expect(page.getByTestId('memory-switched-off')).toHaveCount(0);
  await expect(lesson).toBeVisible();

  // deleted: gone from the screen, not listed as switched off
  await lesson.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete it' }).click();
  await expect(page.getByTestId('memory-empty')).toBeVisible();
  await expect(page.getByTestId('memory-switched-off')).toHaveCount(0);

  // another organisation's lesson ids get nowhere
  const res = await page.request.put(`${BACKEND}/ours/brand-memory/lessons/not-a-real-id/on`, { headers: { auth } });
  expect(res.status()).toBe(404);
});
