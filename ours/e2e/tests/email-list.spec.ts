// OURS: the email list (email campaigns EM1 and EM2). The owner adds people
// with a stated basis (a bought list is refused), sees them counted, and turns
// on a sign-up form whose sign-ups wait to confirm. Someone who unsubscribes
// from the public page can't be added back by a later upload. With sending in
// test mode (OURS_EMAIL_SENDER=simulated), a sign-up confirms from the link in
// their email and the owner's test email is recorded, never sent.
// Needs the stack running as described in ours/README.md. The signed links
// are signed with the backend's secret, read from the same .env the stack
// uses (or OURS_EMAIL_TOKEN_SECRET / JWT_SECRET in this test's environment).
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, Page, test } from '@playwright/test';
import { BACKEND, signUp } from './helpers';

const tokenSecret = () => {
  const fromEnv = (process.env.OURS_EMAIL_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();
  if (fromEnv) return fromEnv;
  const env = readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8');
  const value = (key: string) =>
    [...env.matchAll(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, 'gm'))].pop()?.[1]?.trim() || '';
  return value('OURS_EMAIL_TOKEN_SECRET') || value('JWT_SECRET');
};

// the same signed links the emails carry (email.contacts.ts)
const signedLink = (page: string, purpose: 'unsubscribe' | 'confirm', contactId: string) => {
  const signature = createHmac('sha256', tokenSecret()).update(`ours-email-${purpose}:${contactId}`).digest('base64url');
  return `/${page}?t=${Buffer.from(contactId).toString('base64url')}.${signature}`;
};
const unsubscribeLink = (contactId: string) => signedLink('unsubscribe.html', 'unsubscribe', contactId);
const confirmLink = (contactId: string) => signedLink('confirm-email.html', 'confirm', contactId);

const contactId = async (page: Page, email: string) => {
  const auth = (await page.context().cookies()).find((c) => c.name === 'auth')!.value;
  const res = await page.request.get(`${BACKEND}/ours/email/contacts?search=${encodeURIComponent(email)}&page=0`, {
    headers: { auth },
  });
  return (await res.json()).contacts[0].id as string;
};

const count = (page: Page, key: string) => page.getByTestId(`email-count-${key}`);
const contact = (page: Page, email: string) => page.locator(`[data-testid="email-contact"][data-email="${email}"]`);

const paste = async (page: Page, text: string, basis: string) => {
  await page.getByTestId('email-add-paste').click();
  await page.getByTestId('email-paste').fill(text);
  await page.getByTestId(`email-basis-${basis}`).check();
  await page.getByTestId('email-confirm').check();
  await page.getByTestId('email-add-submit').click();
};

test('adding people, refusing a bought list, the sign-up form and unsubscribing', async ({ page, browser }) => {
  await signUp(page);
  await page.goto('/email');
  await expect(page.getByTestId('email-heading')).toBeVisible();
  await expect(page.getByTestId('email-list-empty')).toBeVisible();

  // 1. a bought list is refused before anything can be added
  await page.getByTestId('email-add-paste').click();
  await page.getByTestId('email-basis-OTHER').check();
  await expect(page.getByTestId('email-refused')).toContainText('Bought or borrowed lists never count');
  await expect(page.getByTestId('email-add-submit')).toHaveCount(0);

  // 2. people who signed up are added and counted; bad and repeated entries are reported
  await paste(page, 'Ann <ann@example.com>, bob@example.com\nbob@example.com not@valid', 'CONSENT');
  await expect(page.getByTestId('email-import-added')).toHaveAttribute('data-value', '2');
  await expect(page.getByTestId('email-import-result')).toContainText('more than once');
  await expect(count(page, 'subscribed')).toHaveAttribute('data-value', '2');
  await expect(page.getByTestId('email-limit')).toContainText('2 of 100');
  await expect(contact(page, 'ann@example.com')).toHaveAttribute('data-status', 'SUBSCRIBED');

  // 3. the sign-up form: a sign-up waits to confirm
  await page.getByTestId('email-form-toggle').click();
  const formUrl = await page.getByTestId('email-form-url').inputValue();
  expect(formUrl).toContain('/subscribe.html?f=');
  const visitor = await browser.newPage();
  await visitor.goto(formUrl);
  await visitor.getByTestId('email-subscribe-address').fill('cara@example.com');
  await visitor.getByTestId('email-subscribe-submit').click();
  await expect(visitor.getByTestId('email-subscribe-error')).toContainText('tick the box');
  await visitor.getByTestId('email-subscribe-consent').check();
  await visitor.getByTestId('email-subscribe-submit').click();
  await expect(visitor.getByTestId('email-subscribe-done')).toBeVisible();
  await page.reload();
  await expect(count(page, 'waiting')).toHaveAttribute('data-value', '1');
  await expect(contact(page, 'cara@example.com')).toHaveAttribute('data-status', 'PENDING_CONFIRMATION');

  // 4. Ann unsubscribes from her link; opening the page alone changes nothing
  const annId = await contactId(page, 'ann@example.com');
  await visitor.goto(unsubscribeLink(annId));
  await expect(visitor.getByTestId('email-unsubscribe-submit')).toBeVisible();
  await page.reload();
  await expect(contact(page, 'ann@example.com')).toHaveAttribute('data-status', 'SUBSCRIBED');
  await visitor.getByTestId('email-unsubscribe-submit').click();
  await expect(visitor.getByTestId('email-unsubscribe-done')).toBeVisible();
  await visitor.goto(`${unsubscribeLink(annId)}x`);
  await expect(visitor.getByTestId('email-public-missing')).toBeVisible();
  await page.reload();
  await expect(contact(page, 'ann@example.com')).toHaveAttribute('data-status', 'UNSUBSCRIBED');
  await expect(count(page, 'unsubscribed')).toHaveAttribute('data-value', '1');

  // 5. removing her and uploading her again doesn't bring her back
  await contact(page, 'ann@example.com').getByTestId('email-contact-remove').click();
  // the confirmation opens above the list
  await page.getByText('Remove this person?').waitFor();
  await page.getByRole('button', { name: 'Remove', exact: true }).first().click();
  await expect(contact(page, 'ann@example.com')).toHaveCount(0);
  await paste(page, 'ann@example.com', 'SOFT_OPT_IN');
  await expect(page.getByTestId('email-import-added')).toHaveAttribute('data-value', '0');
  await expect(page.getByTestId('email-import-result')).toContainText('unsubscribed');
  await expect(contact(page, 'ann@example.com')).toHaveCount(0);

  // 6. a big spreadsheet (well over 100 KB) uploads; only what the trial has room for is added
  const rows = Array.from({ length: 3000 }, (_, i) => `Customer ${i};Surname ${i};customer.${i}@example.com`);
  await page.getByTestId('email-add-upload').click();
  await page.getByTestId('email-file').setInputFiles({
    name: 'customers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`\uFEFFFirst name;Surname;Email\n${rows.join('\n')}\n`),
  });
  await page.getByTestId('email-basis-SOFT_OPT_IN').check();
  await page.getByTestId('email-confirm').check();
  await page.getByTestId('email-add-submit').click();
  await expect(page.getByTestId('email-import-added')).toHaveAttribute('data-value', '98');
  await expect(page.getByTestId('email-import-result')).toContainText('your list is full');
  await expect(page.getByTestId('email-limit')).toContainText('100 of 100');
  await visitor.close();
});

test('in test mode: a sign-up confirms from their email, and the owner’s test email is recorded, not sent', async ({
  page,
  browser,
}) => {
  await signUp(page);
  await page.goto('/email');
  await expect(page.getByTestId('email-sending')).toBeVisible();
  test.skip(
    await page.getByTestId('email-sending-off').isVisible(),
    'Start the stack with OURS_EMAIL_SENDER=simulated to test sending'
  );
  await expect(page.getByTestId('email-simulated')).toContainText('never actually sent');

  // 1. the owner's test email goes through the whole pipe, labelled as simulated
  await page.getByTestId('email-test-send').click();
  await expect(page.getByTestId('email-test-status')).toHaveAttribute('data-status', 'SENT', { timeout: 30000 });
  await expect(page.getByTestId('email-test-status')).toContainText('simulated, not delivered');

  // 2. a form sign-up confirms from the link in their email; opening it alone changes nothing
  await page.getByTestId('email-form-toggle').click();
  const formUrl = await page.getByTestId('email-form-url').inputValue();
  const visitor = await browser.newPage();
  await visitor.goto(formUrl);
  await visitor.getByTestId('email-subscribe-address').fill('dev@example.com');
  await visitor.getByTestId('email-subscribe-consent').check();
  await visitor.getByTestId('email-subscribe-submit').click();
  await expect(visitor.getByTestId('email-subscribe-done')).toBeVisible();
  const devId = await contactId(page, 'dev@example.com');
  await visitor.goto(confirmLink(devId));
  await expect(visitor.getByTestId('email-confirm-submit')).toBeVisible();
  await page.reload();
  await expect(contact(page, 'dev@example.com')).toHaveAttribute('data-status', 'PENDING_CONFIRMATION');
  // an unsubscribe link can't confirm anyone
  await visitor.goto(unsubscribeLink(devId).replace('/unsubscribe.html', '/confirm-email.html'));
  await expect(visitor.getByTestId('email-public-missing')).toBeVisible();
  await visitor.goto(confirmLink(devId));
  await visitor.getByTestId('email-confirm-submit').click();
  await expect(visitor.getByTestId('email-confirm-done')).toBeVisible();
  await page.reload();
  await expect(contact(page, 'dev@example.com')).toHaveAttribute('data-status', 'SUBSCRIBED');
  await expect(count(page, 'subscribed')).toHaveAttribute('data-value', '1');
  await visitor.close();
});
