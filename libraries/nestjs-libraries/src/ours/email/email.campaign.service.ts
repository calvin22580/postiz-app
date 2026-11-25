// OURS: sending list emails (email campaigns EM2). A loop inside the backend
// runs every minute while a sender is switched on (OURS_EMAIL_SENDER), like
// the erasure sweep, so no orchestrator or Postiz workflow changes:
// - confirmation emails for new form sign-ups (double opt-in);
// - campaigns that are approved and due. Each is leased, so two backends
//   never send the same one; one delivery row per recipient means a restart
//   carries on where it stopped, and a row is marked before its message goes,
//   so nobody is emailed twice (a send that may have gone is never repeated).
// Only approval (EM3) or the owner's own test can make a campaign due.
import {
  HttpException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OursEmailContactBasis } from '@prisma/client';
import { EmailCampaignRepository } from '@gitroom/nestjs-libraries/ours/email/email.campaign.repository';
import { EmailService } from '@gitroom/nestjs-libraries/ours/email/email.service';
import { confirmToken, unsubscribeToken } from '@gitroom/nestjs-libraries/ours/email/email.contacts';
import {
  EmailCampaignSender,
  EmailSenderError,
  SenderSetup,
} from '@gitroom/nestjs-libraries/ours/email/senders/email.sender';
import { SimulatedEmailSender } from '@gitroom/nestjs-libraries/ours/email/senders/simulated.email.sender';
import { SesEmailSender } from '@gitroom/nestjs-libraries/ours/email/senders/ses.email.sender';
import { brandName } from '@gitroom/nestjs-libraries/ours/brand/brand';

const LOOP_MS = 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const BATCH = 20;
// a campaign still being retried after this long is given up on
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
// a sign-up older than this doesn't get a confirmation email: they've moved on
const CONFIRM_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;
export const TESTS_PER_HOUR = 5;

export type EmailSenderName = 'off' | 'simulated' | 'ses';

export const emailSenderName = (env: NodeJS.ProcessEnv = process.env): EmailSenderName => {
  const value = (env.OURS_EMAIL_SENDER || '').trim().toLowerCase();
  return value === 'ses' || value === 'simulated' ? value : 'off';
};

export const createEmailSender = (): EmailCampaignSender | null => {
  const name = emailSenderName();
  return name === 'ses' ? new SesEmailSender() : name === 'simulated' ? new SimulatedEmailSender() : null;
};

// how many messages a second (SES's sandbox allows 1)
const sendGapMs = (env: NodeJS.ProcessEnv = process.env) =>
  Math.ceil(1000 / Math.max(1, Number(env.OURS_EMAIL_SEND_PER_SECOND) || 1));

const frontendUrl = () => (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
const backendUrl = () => (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');

// The sending address's part before the @, from the business's name.
export const fromLocalPart = (business: string) =>
  business
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '') || 'news';

export const sendingAddress = (business: string, env: NodeJS.ProcessEnv = process.env) =>
  `${fromLocalPart(business)}@${(env.OURS_EMAIL_FROM_DOMAIN || 'news.kanosena.com').trim()}`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export interface ComposeInput {
  business: string;
  address: string | null;
  subject: string;
  previewText?: string | null;
  body: string;
  // why this person is getting it, one sentence
  reason: string;
  // a button under the body (the confirmation email's)
  button?: { label: string; url: string } | null;
  unsubscribeUrl?: string | null;
}

// The email as it goes out: plain-text paragraphs into a simple, light HTML
// layout, plus a text version, with the footer every list email carries
// (why they're getting it, the business's address, how to unsubscribe).
export const composeEmail = (input: ComposeInput) => {
  const body = paragraphs(input.body);
  const footer = [
    input.reason,
    input.address ? `${input.business}, ${input.address}` : input.business,
  ];
  const text = [
    ...body,
    ...(input.button ? [`${input.button.label}: ${input.button.url}`] : []),
    '--',
    ...footer,
    ...(input.unsubscribeUrl ? [`Unsubscribe: ${input.unsubscribeUrl}`] : []),
  ].join('\n\n');
  const p = (t: string) => `<p style="margin:0 0 16px">${escapeHtml(t).replace(/\n/g, '<br>')}</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
${input.previewText ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.previewText)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px"><tr><td style="padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1d1d1b">
${body.map(p).join('\n')}
${input.button ? `<p style="margin:24px 0"><a href="${escapeHtml(input.button.url)}" style="display:inline-block;background:#1F5F5B;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${escapeHtml(input.button.label)}</a></p>` : ''}
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:16px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6b6b66">
${footer.map((t) => `<p style="margin:0 0 6px">${escapeHtml(t)}</p>`).join('\n')}
${input.unsubscribeUrl ? `<p style="margin:0"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6b6b66">Unsubscribe</a></p>` : ''}
</td></tr></table>
</td></tr></table>
</body></html>`;
  return { html, text };
};

export const reasonFor = (business: string, basis: OursEmailContactBasis | null) =>
  basis === 'SOFT_OPT_IN'
    ? `You’re getting this because you bought from ${business} or asked about its services.`
    : basis === 'CONSENT'
      ? `You’re getting this because you asked to hear from ${business}.`
      : `This is a test email ${business} sent to itself with ${brandName()}.`;

// One-click unsubscribe for mail apps (RFC 8058): a POST to our backend.
export const unsubscribeHeaders = (oneClickUrl: string) => ({
  'List-Unsubscribe': `<${oneClickUrl}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class EmailCampaignService implements OnApplicationBootstrap, OnModuleDestroy {
  private _logger = new Logger(EmailCampaignService.name);
  private _timer?: NodeJS.Timeout;
  private _running?: Promise<void>;
  // this process, as the holder of a campaign's lease
  private _owner = randomUUID();
  // chosen by OURS_EMAIL_SENDER; replaced in tests
  _sender: EmailCampaignSender | null = createEmailSender();

  constructor(
    private _repository: EmailCampaignRepository,
    private _emailService: EmailService
  ) {}

  onApplicationBootstrap() {
    if (!this._sender) {
      return;
    }
    this.tick();
    this._timer = setInterval(() => this.tick(), LOOP_MS);
    this._timer.unref();
  }

  onModuleDestroy() {
    if (this._timer) {
      clearInterval(this._timer);
    }
  }

  // What the Email screen shows about sending.
  async status(orgId: string) {
    const latest = await this._repository.latestTest(orgId);
    return {
      sender: this._sender?.name || ('off' as const),
      latestTest: latest
        ? {
            to: latest.testTo,
            status: latest.status,
            sentWith: latest.sentWith,
            createdAt: latest.createdAt,
            finishedAt: latest.finishedAt,
          }
        : null,
    };
  }

  // The owner's own test: one email to the signed-in owner's address, sent
  // through the whole pipe (loop, delivery row, footer, headers, sender).
  async sendTest(orgId: string, user: { id: string; email: string }) {
    if (!this._sender) {
      throw new HttpException('Sending isn’t switched on yet.', 400);
    }
    const since = new Date(Date.now() - 60 * 60 * 1000);
    if ((await this._repository.countRecentTests(orgId, since)) >= TESTS_PER_HOUR) {
      throw new HttpException(`You can send ${TESTS_PER_HOUR} test emails an hour. Please try again later.`, 429);
    }
    const { name } = await this._emailService.businessDetails(orgId);
    await this._repository.createTestCampaign(orgId, {
      to: user.email,
      userId: user.id,
      subject: `Test email from ${name}`,
      body: [
        `This is a test of how ${name}’s emails will look when they reach your customers.`,
        `Each real email goes to the people on your list who can be emailed, one at a time, with your business’s name and address and an unsubscribe link at the bottom.`,
      ].join('\n\n'),
    });
    this.tick();
    return this.status(orgId);
  }

  // Never throws. One run at a time in this process; a tick asked for while
  // one runs is skipped (the next minute's picks up anything left).
  tick(): Promise<void> {
    if (!this._running) {
      this._running = this.run().finally(() => {
        this._running = undefined;
      });
    }
    return this._running;
  }

  private async run() {
    if (!this._sender) {
      return;
    }
    try {
      await this.sendConfirmations(this._sender);
      for (const due of await this._repository.dueCampaignIds(new Date(), 5)) {
        // one campaign failing doesn't stop the others
        try {
          await this.sendCampaign(this._sender, due.organizationId, due.id);
        } catch (e) {
          this._logger.error(`Campaign ${due.id} org=${due.organizationId} not sent this time: ${(e as Error)?.message}`);
        }
      }
    } catch (e) {
      this._logger.error(`Email send loop failed: ${(e as Error)?.message}`);
    }
  }

  private async sendCampaign(sender: EmailCampaignSender, orgId: string, id: string) {
    const now = new Date();
    const leaseUntil = () => new Date(Date.now() + LEASE_MS);
    if (!(await this._repository.lease(orgId, id, this._owner, now, leaseUntil()))) {
      return;
    }
    let campaign = await this._repository.getCampaign(orgId, id);
    if (!campaign) {
      return;
    }
    const setup = await this.senderSetup(sender, orgId);
    if (setup === false) {
      // the sender couldn't be set up: the lease runs out and we try again
      return;
    }
    if (campaign.status === 'APPROVED') {
      const recipients = campaign.test
        ? [{ email: campaign.testTo!, contactId: null }]
        : (await this._repository.subscribedRecipients(orgId)).map((c) => ({ email: c.email, contactId: c.id }));
      await this._repository.startSending(orgId, id, sender.name, recipients);
      campaign = (await this._repository.getCampaign(orgId, id))!;
    }

    const business = await this._emailService.businessDetails(orgId);
    const gap = sendGapMs();
    for (;;) {
      const batch = await this._repository.queuedDeliveries(orgId, id, BATCH);
      if (!batch.length) {
        await this._repository.finishCampaign(orgId, id, this._owner);
        this._logger.log(`Campaign ${id} org=${orgId} finished (${sender.name})`);
        return;
      }
      const contactIds = batch.map((d) => d.contactId).filter((c): c is string => !!c);
      const contacts = new Map(
        (await this._repository.contactsForDelivery(orgId, contactIds)).map((c) => [c.id, c])
      );
      for (const delivery of batch) {
        // before each message, so a slow sender can't outlast the lease
        if (!(await this._repository.renewLease(orgId, id, this._owner, leaseUntil()))) {
          this._logger.warn(`Campaign ${id} org=${orgId}: lease lost, stopping`);
          return;
        }
        const contact = delivery.contactId ? contacts.get(delivery.contactId) : null;
        // unsubscribed, blocked or removed since the send was planned
        if (delivery.contactId && contact?.status !== 'SUBSCRIBED') {
          await this._repository.moveDelivery(orgId, delivery.id, 'QUEUED', { status: 'SKIPPED' });
          continue;
        }
        if (!(await this._repository.moveDelivery(orgId, delivery.id, 'QUEUED', { status: 'SENDING' }))) {
          continue;
        }
        const unsubscribe = contact ? unsubscribeToken(contact.id) : null;
        const { html, text } = composeEmail({
          business: business.name,
          address: business.address,
          subject: campaign.subject,
          previewText: campaign.previewText,
          body: campaign.body,
          reason: reasonFor(business.name, contact?.basis || null),
          unsubscribeUrl: unsubscribe ? `${frontendUrl()}/unsubscribe.html?t=${unsubscribe}` : null,
        });
        try {
          const { messageId } = await sender.send({
            organizationId: orgId,
            to: delivery.email,
            fromName: business.name,
            fromAddress: sendingAddress(business.name),
            replyTo: business.email,
            subject: campaign.subject,
            html,
            text,
            headers: unsubscribe
              ? unsubscribeHeaders(`${backendUrl()}/ours/email/public/unsubscribe?t=${unsubscribe}`)
              : {},
            tags: { organization: orgId, delivery: delivery.id },
            setup,
          });
          await this._repository.moveDelivery(orgId, delivery.id, 'SENDING', {
            status: sender.name === 'simulated' ? 'SIMULATED' : 'SENT',
            messageId,
            sentAt: new Date(),
          });
        } catch (e) {
          // only an error the sender is sure about means it didn't go; anything
          // else (a timeout, a dropped connection) may have gone, so it's never
          // sent again
          const kind = e instanceof EmailSenderError ? e.kind : 'unknown';
          const message = (e as Error)?.message?.slice(0, 300) || 'Unknown error';
          this._logger.warn(`Delivery ${delivery.id} org=${orgId} not sent (${kind}): ${message}`);
          if (kind === 'reject' || kind === 'unknown') {
            await this._repository.moveDelivery(orgId, delivery.id, 'SENDING', {
              status: 'FAILED',
              error: kind === 'unknown' ? `May not have been sent; not sent again. ${message}` : message,
            });
            continue;
          }
          // it didn't go: put it back for the next pass
          await this._repository.moveDelivery(orgId, delivery.id, 'SENDING', { status: 'QUEUED', error: message });
          const stale = campaign.startedAt && Date.now() - campaign.startedAt.getTime() > GIVE_UP_AFTER_MS;
          if (kind === 'paused' || stale) {
            await this._repository.finishCampaign(orgId, id, this._owner, true);
          }
          return;
        }
        await sleep(gap);
      }
    }
  }

  // The business's own space at the sender, made the first time it sends.
  // False when it couldn't be made this time.
  private async senderSetup(sender: EmailCampaignSender, orgId: string): Promise<SenderSetup | null | false> {
    if (sender.name !== 'ses') {
      return null;
    }
    const saved = await this._repository.getSenderSetup(orgId);
    if (saved) {
      return saved;
    }
    try {
      const setup = await sender.prepare(orgId);
      return setup ? await this._repository.saveSenderSetup(orgId, setup) : null;
    } catch (e) {
      this._logger.error(`Sender set-up failed for org=${orgId}: ${(e as Error)?.message}`);
      return false;
    }
  }

  // Double opt-in: a form sign-up gets one email asking them to confirm.
  private async sendConfirmations(sender: EmailCampaignSender) {
    const pending = await this._repository.pendingConfirmations(new Date(Date.now() - CONFIRM_WITHIN_MS), BATCH);
    for (const contact of pending) {
      try {
        if (!(await this.sendConfirmation(sender, contact))) {
          // the sender is busy or paused: try again next minute
          return;
        }
      } catch (e) {
        this._logger.error(`Confirmation for contact=${contact.id} failed: ${(e as Error)?.message}`);
      }
      await sleep(sendGapMs());
    }
  }

  // False when the sender couldn't take it now and it should be tried again.
  private async sendConfirmation(
    sender: EmailCampaignSender,
    contact: { id: string; organizationId: string; email: string }
  ) {
    const orgId = contact.organizationId;
    const setup = await this.senderSetup(sender, orgId);
    if (setup === false || !(await this._repository.claimConfirmation(orgId, contact.id))) {
      return true;
    }
    const business = await this._emailService.businessDetails(orgId);
    const subject = `Please confirm: emails from ${business.name}`;
    const { html, text } = composeEmail({
      business: business.name,
      address: business.address,
      subject,
      body: [
        `Thanks for signing up to get emails from ${business.name}.`,
        `Please confirm it was you. Until you do, you won’t get anything else from us.`,
        `If you didn’t sign up, ignore this email and you won’t hear from us.`,
      ].join('\n\n'),
      reason: `You’re getting this because this address was entered on ${business.name}’s sign-up form.`,
      button: { label: 'Confirm my sign-up', url: `${frontendUrl()}/confirm-email.html?t=${confirmToken(contact.id)}` },
    });
    try {
      await sender.send({
        organizationId: orgId,
        to: contact.email,
        fromName: business.name,
        fromAddress: sendingAddress(business.name),
        replyTo: business.email,
        subject,
        html,
        text,
        headers: {},
        tags: { organization: orgId, confirmation: contact.id },
        setup,
      });
      return true;
    } catch (e) {
      const kind = e instanceof EmailSenderError ? e.kind : 'unknown';
      this._logger.warn(`Confirmation for contact=${contact.id} org=${orgId} not sent (${kind}): ${(e as Error)?.message}`);
      if (kind === 'retry' || kind === 'paused') {
        // it surely didn't go
        await this._repository.releaseConfirmation(orgId, contact.id);
        return false;
      }
      // refused, or it may have gone: not sent again
      return true;
    }
  }
}
