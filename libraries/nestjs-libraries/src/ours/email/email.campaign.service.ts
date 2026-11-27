// OURS: sending list emails (email campaigns EM2). A loop inside the backend
// runs every minute while a sender is switched on (OURS_EMAIL_SENDER), like
// the erasure sweep, so no orchestrator or Postiz workflow changes:
// - confirmation emails for new form sign-ups (double opt-in);
// - campaigns that are approved and due. Each is leased, so two backends
//   never send the same one; one delivery row per recipient means a restart
//   carries on where it stopped, and a row is marked before its message goes,
//   so nobody is emailed twice (a send that may have gone is never repeated).
// Only approval or the owner's own test can make a campaign due.
//
// EM3: the business's list emails. The writer (AI, or a labelled demo)
// drafts one from the business profile, the same hard rules as posts drop
// anything not in the profile, and the owner edits, rewrites, rejects or
// approves it. Only approve() schedules a list email; it takes one unit of
// the plan's monthly `emails` allowance, and cancelling gives it back.
import {
  HttpException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { OursEmailContactBasis, Prisma } from '@prisma/client';
import {
  CampaignContent,
  CampaignRow,
  EmailCampaignRepository,
} from '@gitroom/nestjs-libraries/ours/email/email.campaign.repository';
import { EmailService } from '@gitroom/nestjs-libraries/ours/email/email.service';
import { confirmToken, unsubscribeToken } from '@gitroom/nestjs-libraries/ours/email/email.contacts';
import {
  EmailCampaignSender,
  emailSenderName,
  EmailSenderError,
  SenderSetup,
} from '@gitroom/nestjs-libraries/ours/email/senders/email.sender';
import { SimulatedEmailSender } from '@gitroom/nestjs-libraries/ours/email/senders/simulated.email.sender';
import { SesEmailSender } from '@gitroom/nestjs-libraries/ours/email/senders/ses.email.sender';
import { brandName } from '@gitroom/nestjs-libraries/ours/brand/brand';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import { ProfileFields } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import {
  CaptionFact,
  captionTimezone,
  factsFromProfile,
  hasEnoughToWrite,
  isSeasonalFact,
  toneFromProfile,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  cleanEmailText,
  EMAIL_LIMITS,
  groundEmail,
  unsupportedEmailDetails,
} from '@gitroom/nestjs-libraries/ours/email/email.grounding';
import {
  CaptionWriterError,
  CaptionWriterWithUsageError,
} from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import { EmailWriter } from '@gitroom/nestjs-libraries/ours/email/writers/email.writer';
import { AnthropicEmailWriter } from '@gitroom/nestjs-libraries/ours/email/writers/anthropic.email.writer';
import { DemoEmailWriter } from '@gitroom/nestjs-libraries/ours/email/writers/demo.email.writer';
import { SeasonalService } from '@gitroom/nestjs-libraries/ours/seasonal/seasonal.service';
import { PlanService } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { BrandSignalService } from '@gitroom/nestjs-libraries/ours/memory/brand.signal.service';

dayjs.extend(utc);
dayjs.extend(timezone);

const LOOP_MS = 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const BATCH = 20;
// a campaign still being retried after this long is given up on
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
// a sign-up older than this doesn't get a confirmation email: they've moved on
const CONFIRM_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;
export const TESTS_PER_HOUR = 5;

// EM3: AI cost features (ours_ai_usage.feature)
export const EMAIL_WRITE_FEATURE = 'email.write';
export const EMAIL_REWRITE_FEATURE = 'email.rewrite';
// Each AI draft or rewrite is a billed call: a few new emails a day, and a
// few rewrites of each; the owner can still edit the words themselves.
export const EMAIL_WRITES_PER_DAY = 5;
export const MAX_EMAIL_REWRITES = 5;
// leave the send loop time to pick it up, and keep plans within reach
const MIN_EMAIL_LEAD_MS = 10 * 60 * 1000;
const MAX_EMAIL_AHEAD_DAYS = 60;
// the latest finished emails the screen lists
const FINISHED_SHOWN = 10;

export const emailWriterName = (): EmailWriter['name'] =>
  process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'demo';

export const createEmailWriter = (): EmailWriter =>
  emailWriterName() === 'anthropic' ? new AnthropicEmailWriter() : new DemoEmailWriter();

// When a new email is suggested to go: the next Tuesday at 10:00 in the
// business's time zone, at least a day away. Small-business emails do well
// mid-morning early in the week, and it leaves the owner time to approve.
export const suggestedSendAt = (tz: string, now: Date = new Date()) => {
  const earliest = now.getTime() + 24 * 60 * 60 * 1000;
  for (let day = dayjs(now).tz(tz); ; day = day.add(1, 'day')) {
    const at = dayjs.tz(`${day.format('YYYY-MM-DD')} 10:00`, 'YYYY-MM-DD HH:mm', tz);
    if (at.day() === 2 && at.valueOf() >= earliest) {
      return at.toDate();
    }
  }
};

// What an email keeps of each fact it relies on (a UK date keeps its source).
const storedFact = (f: CaptionFact) => ({
  id: f.id,
  field: f.field,
  value: f.value,
  ...(f.label ? { label: f.label } : {}),
  ...(f.date ? { date: f.date } : {}),
  ...(f.source ? { source: f.source } : {}),
});

// Content engine E1: which email an owner signal is about.
const signalTarget = (c: Pick<CampaignRow, 'id' | 'subject'>) => ({
  draftId: c.id,
  platform: 'email',
  theme: c.subject.slice(0, 120),
});

// The owner's words, tidied, or why they can't be saved.
export const ownerContent = (input: Partial<CampaignContent>): CampaignContent | string => {
  const content = {
    subject: cleanEmailText(String(input.subject || '')).replace(/\s+/g, ' '),
    previewText: cleanEmailText(String(input.previewText || '')).replace(/\s+/g, ' '),
    body: cleanEmailText(String(input.body || '')),
  };
  if (!content.subject) return 'Give your email a subject.';
  if (!content.body) return 'Write something for your email, or don’t send it.';
  if (content.subject.length > EMAIL_LIMITS.subject.max) {
    return `Keep the subject under ${EMAIL_LIMITS.subject.max} characters.`;
  }
  if (content.previewText.length > EMAIL_LIMITS.previewText.max) {
    return `Keep the preview line under ${EMAIL_LIMITS.previewText.max} characters.`;
  }
  if (content.body.length > EMAIL_LIMITS.body.max) {
    return `This email is too long. Keep it under ${EMAIL_LIMITS.body.max} characters.`;
  }
  return content;
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
    private _emailService: EmailService,
    private _businessProfileService: BusinessProfileService,
    private _aiUsageService: AiUsageService,
    private _seasonalService: SeasonalService,
    private _planService: PlanService,
    private _brandSignalService: BrandSignalService
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

  // EM3: the Email screen's emails section.
  async campaigns(orgId: string) {
    const tz = captionTimezone();
    const [rows, recipients, allowance] = await Promise.all([
      this._repository.listCampaigns(orgId, FINISHED_SHOWN),
      this._repository.countSubscribed(orgId),
      this._planService.allowance(orgId, 'emails'),
    ]);
    // the owner's own edits are checked against the profile as it is now
    const facts = rows.some((r) => r.status === 'WAITING' && r.editedAt) ? await this.currentFacts(orgId) : [];
    return {
      sender: this._sender?.name || ('off' as const),
      writer: emailWriterName(),
      recipients,
      allowance,
      suggestedSendAt: suggestedSendAt(tz).toISOString(),
      timezone: tz,
      campaigns: rows.map((r) => this.presentCampaign(r, facts)),
    };
  }

  // A new email for the owner to approve, written now (one AI call, like a
  // post rewrite). Nothing is scheduled until approve().
  async write(orgId: string, writer: EmailWriter = createEmailWriter()) {
    this.assertSending();
    const { fields } = await this.readyProfile(orgId);
    // counts billed AI calls too, including emails that weren't kept
    const since = dayjs().subtract(1, 'day').toDate();
    const [written, calls] = await Promise.all([
      this._repository.countWrittenSince(orgId, since),
      this._aiUsageService.countCalls(orgId, EMAIL_WRITE_FEATURE, since),
    ]);
    if (Math.max(written, calls) >= EMAIL_WRITES_PER_DAY) {
      throw new HttpException(
        `We can write ${EMAIL_WRITES_PER_DAY} new emails a day. Edit one of yours, or try again tomorrow.`,
        429
      );
    }
    await this._planService.assertCanWrite(orgId);
    const sendDate = dayjs(suggestedSendAt(captionTimezone())).tz(captionTimezone()).format('YYYY-MM-DD');
    const facts = [...factsFromProfile(fields), ...(await this.datesFrom(orgId, sendDate))];

    let output;
    try {
      output = await writer.write({
        facts,
        tone: toneFromProfile(fields),
        sendDate,
        recentSubjects: await this._repository.recentSubjects(orgId, 5),
      });
    } catch (e) {
      throw await this.writerFailed(orgId, e, EMAIL_WRITE_FEATURE, 'writing your email');
    }
    await this.logUsages(orgId, output.usages, EMAIL_WRITE_FEATURE);

    const { email, reason } = groundEmail(output.raw, facts);
    if (!email) {
      // why, not the email itself, so the filter can be tuned from logs
      this._logger.log(`Email for org=${orgId} not kept (${reason})`);
      throw new HttpException(
        'We couldn’t write an email we were sure about. Add more detail to your profile and try again.',
        400
      );
    }
    await this._repository.createDraft(orgId, {
      subject: email.subject,
      previewText: email.previewText,
      body: email.body,
      writer: writer.name,
      facts: email.facts.map(storedFact) as Prisma.InputJsonValue,
    });
    return this.campaigns(orgId);
  }

  // The owner rewrites the email in their own words. It is their claim about
  // their own business, so it is not dropped like AI text, but the screen
  // points out details the profile doesn't have.
  async edit(orgId: string, id: string, input: Partial<CampaignContent>) {
    const draft = await this.waitingDraft(orgId, id);
    const content = ownerContent(input);
    if (typeof content === 'string') {
      throw new HttpException(content, 400);
    }
    if (!(await this._repository.editDraft(orgId, id, content))) {
      throw new HttpException('This email can only be changed while it is waiting for your approval.', 400);
    }
    const before = [draft.subject, draft.previewText, draft.body].join('\n\n');
    const after = [content.subject, content.previewText, content.body].join('\n\n');
    if (before !== after) {
      await this._brandSignalService.record(orgId, {
        kind: 'edited',
        ...signalTarget(draft),
        before,
        after,
        edited: !!draft.editedAt,
      });
    }
    return this.campaigns(orgId);
  }

  // A new version from the profile as it is now, through the same checks; if
  // it fails them the current version is kept. Unlike a post, it doesn't
  // take a unit of the plan's `rewrites` (those are for posts): the
  // per-email cap and the fair-use AI cap bound it.
  async rewrite(orgId: string, id: string, note?: string, writer: EmailWriter = createEmailWriter()) {
    const draft = await this.waitingDraft(orgId, id);
    const { fields } = await this.readyProfile(orgId);
    await this._planService.assertCanWrite(orgId);
    const sendDate = dayjs(suggestedSendAt(captionTimezone())).tz(captionTimezone()).format('YYYY-MM-DD');
    const facts = [...factsFromProfile(fields), ...(await this.datesFrom(orgId, sendDate))];
    if (!(await this._repository.claimRewrite(orgId, id, MAX_EMAIL_REWRITES))) {
      throw new HttpException(
        `This email has already been rewritten ${MAX_EMAIL_REWRITES} times. You can still edit it yourself.`,
        400
      );
    }

    let output;
    try {
      output = await writer.rewrite({
        facts,
        tone: toneFromProfile(fields),
        sendDate,
        recentSubjects: await this._repository.recentSubjects(orgId, 5),
        current: { subject: draft.subject, previewText: draft.previewText || '', body: draft.body },
        note,
        attempt: draft.rewriteCount,
      });
    } catch (e) {
      if (!(e instanceof CaptionWriterWithUsageError)) {
        // nothing was billed, so the owner keeps this rewrite
        await this._repository.giveBackRewrite(orgId, id).catch(() => undefined);
      }
      throw await this.writerFailed(orgId, e, EMAIL_REWRITE_FEATURE, 'writing a new version');
    }
    await this.logUsages(orgId, output.usages, EMAIL_REWRITE_FEATURE);

    const { email, reason } = groundEmail(output.raw, facts);
    const signal = (after: string | null) =>
      this._brandSignalService.record(orgId, {
        kind: 'rewrite',
        ...signalTarget(draft),
        before: draft.body,
        after,
        note: note?.trim() || null,
        edited: !!draft.editedAt,
      });
    if (!email || email.body === draft.body) {
      await signal(null);
      this._logger.log(`Email rewrite for org=${orgId} campaign=${id} not kept${reason ? ` (${reason})` : ''}`);
      throw new HttpException(
        'We couldn’t write a new version we were sure about, so we kept the current one. Try again, or edit it yourself.',
        400
      );
    }
    const saved = await this._repository.saveRewrite(orgId, id, {
      subject: email.subject,
      previewText: email.previewText,
      body: email.body,
      facts: email.facts.map(storedFact) as Prisma.InputJsonValue,
    });
    await signal(saved ? email.body : null);
    if (!saved) {
      throw new HttpException('This email was approved or rejected while we were writing, so it was left as it is.', 409);
    }
    return this.campaigns(orgId);
  }

  // A rejected email is never sent.
  async reject(orgId: string, id: string) {
    const draft = await this.waitingDraft(orgId, id);
    if (!(await this._repository.reject(orgId, id))) {
      throw new HttpException('This email can only be rejected while it is waiting for your approval.', 400);
    }
    await this._brandSignalService.record(orgId, {
      kind: 'rejected',
      ...signalTarget(draft),
      before: draft.body,
      edited: !!draft.editedAt,
    });
    return this.campaigns(orgId);
  }

  // The only way a list email is scheduled: the owner approves it for a time.
  // One unit of the plan's monthly email allowance.
  async approve(orgId: string, id: string, userId: string, sendAt: string) {
    this.assertSending();
    const at = new Date(sendAt);
    if (Number.isNaN(at.getTime())) {
      throw new HttpException('Choose when to send it.', 400);
    }
    if (at.getTime() < Date.now() + MIN_EMAIL_LEAD_MS) {
      throw new HttpException('Choose a time at least 10 minutes from now.', 400);
    }
    if (at.getTime() > dayjs().add(MAX_EMAIL_AHEAD_DAYS, 'day').valueOf()) {
      throw new HttpException(`Choose a time in the next ${MAX_EMAIL_AHEAD_DAYS} days.`, 400);
    }
    const draft = await this.waitingDraft(orgId, id);
    // a UK date the email talks about must not have passed when it goes
    const sendDay = dayjs(at).tz(captionTimezone()).format('YYYY-MM-DD');
    const passed = ((draft.facts || []) as unknown as CaptionFact[]).find(
      (f) => isSeasonalFact(f) && f.date && f.date < sendDay
    );
    if (passed) {
      throw new HttpException(
        `This email mentions ${passed.label || passed.value}, so choose a time on or before ${dayjs(passed.date).format('DD/MM/YYYY')}, or ask for a new version.`,
        400
      );
    }
    if (!(await this._repository.countSubscribed(orgId))) {
      throw new HttpException('Nobody on your list can be emailed yet. Add people who have agreed to hear from you first.', 400);
    }
    const ticket = await this._planService.claim(orgId, 'emails');
    let approved: boolean;
    try {
      approved = await this._repository.approve(orgId, id, { scheduledAt: at, userId, allowancePeriod: ticket.period });
    } catch (e) {
      await this._planService.giveBack(orgId, ticket);
      throw e;
    }
    if (!approved) {
      await this._planService.giveBack(orgId, ticket);
      throw new HttpException('This email was approved or changed a moment ago. Please check it and try again.', 409);
    }
    await this._brandSignalService.record(orgId, {
      kind: 'approved',
      ...signalTarget(draft),
      after: draft.body,
      edited: !!draft.editedAt,
    });
    return this.campaigns(orgId);
  }

  // Stops a scheduled email before it starts going; the allowance is given
  // back. Once the send loop has started it, it can't be stopped half way.
  async cancel(orgId: string, id: string) {
    const campaign = await this._repository.getCampaign(orgId, id);
    if (!campaign || campaign.test) {
      throw new HttpException('Email not found', 404);
    }
    if (campaign.status === 'WAITING') {
      throw new HttpException('This email isn’t scheduled yet. Choose “Don’t send” on it instead.', 400);
    }
    if (campaign.status !== 'APPROVED' && campaign.status !== 'SENDING') {
      throw new HttpException('This email isn’t scheduled any more.', 400);
    }
    if (campaign.status === 'SENDING' || !(await this._repository.cancel(orgId, id, new Date()))) {
      throw new HttpException('This email is already being sent, so it can’t be stopped now.', 409);
    }
    if (campaign.allowancePeriod) {
      await this._planService.giveBack(orgId, { metric: 'emails', period: campaign.allowancePeriod });
    }
    return this.campaigns(orgId);
  }

  private assertSending() {
    if (!this._sender) {
      throw new HttpException('Email campaigns aren’t switched on yet.', 400);
    }
  }

  private async readyProfile(orgId: string) {
    const { profile } = await this._businessProfileService.getProfile(orgId);
    if (!profile || profile.status !== 'READY') {
      throw new HttpException('Set up your business profile first, so we know what to write about.', 400);
    }
    const fields = profile.fields as ProfileFields;
    if (!hasEnoughToWrite(factsFromProfile(fields))) {
      throw new HttpException('Add your business name and what you do or offer to your profile first.', 400);
    }
    return { fields };
  }

  private async currentFacts(orgId: string) {
    try {
      const { profile } = await this._businessProfileService.getProfile(orgId);
      return profile?.fields ? factsFromProfile(profile.fields as ProfileFields) : [];
    } catch {
      return [];
    }
  }

  // UK dates on or after the send date. They never stop an email being
  // written: if they can't be read, it is written from the profile alone.
  private async datesFrom(orgId: string, sendDate: string) {
    try {
      return (await this._seasonalService.factsForWeek(orgId, sendDate)).filter((f) => !f.date || f.date >= sendDate);
    } catch (e) {
      this._logger.error(`Could not read UK dates for org=${orgId}: ${(e as Error)?.message}`);
      return [];
    }
  }

  private async waitingDraft(orgId: string, id: string) {
    const draft = await this._repository.getCampaign(orgId, id);
    if (!draft || draft.test) {
      throw new HttpException('Email not found', 404);
    }
    if (draft.status !== 'WAITING') {
      throw new HttpException(
        draft.status === 'REJECTED'
          ? 'This email was rejected.'
          : 'This email is already approved.',
        400
      );
    }
    return draft;
  }

  // A writer failure as the owner sees it, with any billed usage logged.
  private async writerFailed(orgId: string, e: unknown, feature: string, doing: string) {
    if (e instanceof CaptionWriterWithUsageError) {
      await this.logUsages(orgId, e.usages, feature);
    }
    if (e instanceof CaptionWriterError) {
      return new HttpException(e.message, 400);
    }
    this._logger.error(`Email ${feature} failed for org=${orgId}: ${(e as Error)?.stack}`);
    return new HttpException(`Something went wrong while ${doing}. Please try again.`, 400);
  }

  private async logUsages(orgId: string, usages: Parameters<AiUsageService['logCall']>[2][], feature: string) {
    for (const usage of usages) {
      await this._aiUsageService.logCall(orgId, feature, usage);
    }
  }

  private presentCampaign(row: CampaignRow, facts: CaptionFact[]) {
    const content = { subject: row.subject, previewText: row.previewText || '', body: row.body };
    return {
      id: row.id,
      status: row.status,
      ...content,
      writer: row.writer,
      facts: (row.facts || []) as unknown as CaptionFact[],
      edited: !!row.editedAt,
      rewritesLeft: Math.max(0, MAX_EMAIL_REWRITES - row.rewriteCount),
      // the owner's own words that the profile doesn't back up, to look at
      // again before approving (never blocks them)
      unsupported:
        row.status === 'WAITING' && row.editedAt && facts.length
          ? unsupportedEmailDetails(content, facts, facts.filter(isSeasonalFact))
          : [],
      scheduledAt: row.scheduledAt,
      approvedAt: row.approvedAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      sentWith: row.sentWith,
      recipients: row.recipients,
      sent: row.sent,
      failed: row.failed,
      createdAt: row.createdAt,
    };
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
      // the sender couldn't be set up: let go, so the owner can still stop
      // it, and try again next minute
      await this._repository.releaseLease(orgId, id, this._owner);
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
        await this.finish(orgId, campaign, false);
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
            await this.finish(orgId, campaign, true);
          }
          return;
        }
        await sleep(gap);
      }
    }
  }

  // Ends a send. A list email that reached nobody (the sender paused this
  // business) gives its unit of the monthly allowance back.
  private async finish(orgId: string, campaign: CampaignRow, paused: boolean) {
    const result = await this._repository.finishCampaign(orgId, campaign.id, this._owner, paused);
    if (result?.status === 'FAILED' && result.sent === 0 && !campaign.test && campaign.allowancePeriod) {
      await this._planService.giveBack(orgId, { metric: 'emails', period: campaign.allowancePeriod });
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
