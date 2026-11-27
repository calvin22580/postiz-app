// OURS: a real send through Amazon SES (email campaigns EM2). Skipped unless
// OURS_EMAIL_LIVE_TO is set, so the normal test run never touches AWS. It
// sets up a test business's tenant and configuration set exactly as the send
// loop does, then sends one test email, footer and all. Needs the sending
// variables from ours/README.md (keys, OURS_EMAIL_SES_IDENTITY_ARN, and
// OURS_EMAIL_SNS_TOPIC_ARN for events). In SES's sandbox the address must be
// verified. Run from the repo root:
//   OURS_EMAIL_LIVE_TO=you@example.com pnpm exec vitest run --config ours/vitest.config.mts ses.live
import { describe, expect, it } from 'vitest';
import { SesEmailSender } from '@gitroom/nestjs-libraries/ours/email/senders/ses.email.sender';
import { composeEmail, reasonFor, sendingAddress } from '@gitroom/nestjs-libraries/ours/email/email.campaign.service';

const to = (process.env.OURS_EMAIL_LIVE_TO || '').trim();

describe.skipIf(!to)('Amazon SES, for real', () => {
  it('sets up a business and sends it a test email', async () => {
    const sender = new SesEmailSender();
    const organizationId = 'live-test';
    const setup = await sender.prepare(organizationId);
    const business = 'Kanosena Test Cafe';
    const subject = `Test email from ${business}`;
    const { html, text } = composeEmail({
      business,
      address: '128 City Road, London, EC1V 2NX',
      subject,
      previewText: 'How your emails will look',
      body: `This is a test of how ${business}’s emails will look when they reach your customers.\n\nEach real email goes to the people on your list who can be emailed, with your business’s name and address and an unsubscribe link at the bottom.`,
      reason: reasonFor(business, null),
    });
    const { messageId } = await sender.send({
      organizationId,
      to,
      fromName: business,
      fromAddress: sendingAddress(business),
      subject,
      html,
      text,
      headers: {},
      tags: { organization: organizationId, delivery: 'live-test' },
      setup,
    });
    console.log(`Sent through SES: messageId=${messageId} tenant=${setup.tenantName}`);
    expect(messageId).toBeTruthy();
  }, 60000);
});
