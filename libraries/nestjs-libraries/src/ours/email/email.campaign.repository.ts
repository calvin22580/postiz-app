// OURS: campaigns, deliveries and the sender set-up (email campaigns EM2).
// Every query is scoped by organizationId, except the send loop's search for
// due work across all businesses (system work, like the erasure sweep) and
// finding a delivery from a sender event by its message id, where the event's
// signature is the proof; every write after those uses the row's own
// organisation.
import { Injectable } from '@nestjs/common';
import { OursEmailCampaignStatus, OursEmailDeliveryStatus, Prisma } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const campaignSelect = {
  id: true,
  organizationId: true,
  status: true,
  test: true,
  testTo: true,
  subject: true,
  previewText: true,
  body: true,
  writer: true,
  facts: true,
  rewriteCount: true,
  editedAt: true,
  allowancePeriod: true,
  scheduledAt: true,
  approvedAt: true,
  startedAt: true,
  finishedAt: true,
  sentWith: true,
  recipients: true,
  sent: true,
  failed: true,
  createdAt: true,
} satisfies Prisma.OursEmailCampaignSelect;

export type CampaignRow = Prisma.OursEmailCampaignGetPayload<{ select: typeof campaignSelect }>;

export interface CampaignContent {
  subject: string;
  previewText: string;
  body: string;
}

// what the screen lists after the drafts and scheduled emails
const FINISHED: OursEmailCampaignStatus[] = ['SENT', 'FAILED', 'REJECTED', 'CANCELLED'];

@Injectable()
export class EmailCampaignRepository {
  constructor(
    private _campaign: PrismaRepository<'oursEmailCampaign'>,
    private _delivery: PrismaRepository<'oursEmailDelivery'>,
    private _sender: PrismaRepository<'oursEmailSender'>,
    private _contact: PrismaRepository<'oursEmailContact'>
  ) {}

  createTestCampaign(orgId: string, data: { to: string; subject: string; body: string; userId: string }) {
    const now = new Date();
    return this._campaign.model.oursEmailCampaign.create({
      data: {
        organizationId: orgId,
        status: 'APPROVED',
        test: true,
        testTo: data.to,
        subject: data.subject,
        body: data.body,
        scheduledAt: now,
        approvedAt: now,
        approvedBy: data.userId,
      },
      select: campaignSelect,
    });
  }

  // EM3: an email written for the owner to approve.
  createDraft(orgId: string, data: CampaignContent & { writer: string; facts: Prisma.InputJsonValue }) {
    return this._campaign.model.oursEmailCampaign.create({
      data: { organizationId: orgId, status: 'WAITING', ...data },
      select: campaignSelect,
    });
  }

  // The business's list emails (never tests): waiting, scheduled or being
  // sent, then the latest finished ones.
  async listCampaigns(orgId: string, finished: number) {
    const [open, done] = await Promise.all([
      this._campaign.model.oursEmailCampaign.findMany({
        where: { organizationId: orgId, test: false, status: { in: ['WAITING', 'APPROVED', 'SENDING'] } },
        orderBy: { createdAt: 'asc' },
        select: campaignSelect,
      }),
      this._campaign.model.oursEmailCampaign.findMany({
        where: { organizationId: orgId, test: false, status: { in: FINISHED } },
        orderBy: { updatedAt: 'desc' },
        take: finished,
        select: campaignSelect,
      }),
    ]);
    return [...open, ...done];
  }

  // subjects of emails the owner approved lately, so the next one differs
  async recentSubjects(orgId: string, take: number) {
    const rows = await this._campaign.model.oursEmailCampaign.findMany({
      where: { organizationId: orgId, test: false, status: { in: ['APPROVED', 'SENDING', 'SENT'] } },
      orderBy: { createdAt: 'desc' },
      take,
      select: { subject: true },
    });
    return rows.map((r) => r.subject);
  }

  // emails written since, to cap how many AI drafts a day
  countWrittenSince(orgId: string, since: Date) {
    return this._campaign.model.oursEmailCampaign.count({
      where: { organizationId: orgId, test: false, createdAt: { gte: since } },
    });
  }

  // The owner's own words, only while it waits for approval.
  async editDraft(orgId: string, id: string, content: CampaignContent) {
    const { count } = await this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, test: false, status: 'WAITING' },
      data: { ...content, editedAt: new Date() },
    });
    return count === 1;
  }

  // One AI rewrite, up to `max` for this email.
  async claimRewrite(orgId: string, id: string, max: number) {
    const { count } = await this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, test: false, status: 'WAITING', rewriteCount: { lt: max } },
      data: { rewriteCount: { increment: 1 } },
    });
    return count === 1;
  }

  giveBackRewrite(orgId: string, id: string) {
    return this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, rewriteCount: { gt: 0 } },
      data: { rewriteCount: { decrement: 1 } },
    });
  }

  // A new version replaces the words; the owner's earlier edit no longer
  // applies to them.
  async saveRewrite(orgId: string, id: string, data: CampaignContent & { facts: Prisma.InputJsonValue }) {
    const { count } = await this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, test: false, status: 'WAITING' },
      data: { ...data, editedAt: null },
    });
    return count === 1;
  }

  async reject(orgId: string, id: string) {
    const { count } = await this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, test: false, status: 'WAITING' },
      data: { status: 'REJECTED' },
    });
    return count === 1;
  }

  // The only way a list email becomes due (EmailCampaignService.approve).
  async approve(orgId: string, id: string, data: { scheduledAt: Date; userId: string; allowancePeriod: string }) {
    const { count } = await this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, test: false, status: 'WAITING' },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: data.userId, scheduledAt: data.scheduledAt, allowancePeriod: data.allowancePeriod },
    });
    return count === 1;
  }

  // Stops a scheduled email, only while the send loop doesn't hold it, so a
  // send that has started is never cut off half way.
  async cancel(orgId: string, id: string, now: Date) {
    const { count } = await this._campaign.model.oursEmailCampaign.updateMany({
      where: {
        id,
        organizationId: orgId,
        test: false,
        status: 'APPROVED',
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: { status: 'CANCELLED', scheduledAt: null },
    });
    return count === 1;
  }

  latestTest(orgId: string) {
    return this._campaign.model.oursEmailCampaign.findFirst({
      where: { organizationId: orgId, test: true },
      orderBy: { createdAt: 'desc' },
      select: campaignSelect,
    });
  }

  // tests started in the last hour, to stop the button being used to spam
  countRecentTests(orgId: string, since: Date) {
    return this._campaign.model.oursEmailCampaign.count({
      where: { organizationId: orgId, test: true, createdAt: { gte: since } },
    });
  }

  // System work: campaigns due now whose lease is free.
  async dueCampaignIds(now: Date, limit: number) {
    const rows = await this._campaign.model.oursEmailCampaign.findMany({
      where: {
        status: { in: ['APPROVED', 'SENDING'] },
        scheduledAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      select: { id: true, organizationId: true },
    });
    return rows;
  }

  // Takes the campaign for this process (`owner`) until `until`; false if
  // another process has it.
  async lease(orgId: string, id: string, owner: string, now: Date, until: Date) {
    const { count } = await this._campaign.model.oursEmailCampaign.updateMany({
      where: {
        id,
        organizationId: orgId,
        status: { in: ['APPROVED', 'SENDING'] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: { leaseUntil: until, leaseOwner: owner },
    });
    return count === 1;
  }

  // Keeps the lease; false if this process has lost it.
  async renewLease(orgId: string, id: string, owner: string, until: Date) {
    const { count } = await this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, leaseOwner: owner, status: 'SENDING' },
      data: { leaseUntil: until },
    });
    return count === 1;
  }

  // Lets go of a campaign that hasn't started sending (its sender couldn't be
  // set up), so the owner can still stop it before the next try.
  releaseLease(orgId: string, id: string, owner: string) {
    return this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, leaseOwner: owner, status: 'APPROVED' },
      data: { leaseUntil: null, leaseOwner: null },
    });
  }

  getCampaign(orgId: string, id: string) {
    return this._campaign.model.oursEmailCampaign.findFirst({
      where: { id, organizationId: orgId },
      select: campaignSelect,
    });
  }

  // First pass of a send: one delivery row per recipient, made once.
  async startSending(
    orgId: string,
    id: string,
    sentWith: string,
    recipients: { email: string; contactId: string | null }[]
  ) {
    await this._delivery.model.oursEmailDelivery.createMany({
      data: recipients.map((r) => ({ organizationId: orgId, campaignId: id, ...r })),
      skipDuplicates: true,
    });
    const total = await this._delivery.model.oursEmailDelivery.count({ where: { organizationId: orgId, campaignId: id } });
    await this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId },
      data: { status: 'SENDING', startedAt: new Date(), sentWith, recipients: total },
    });
  }

  // how many people a list email would go to now
  countSubscribed(orgId: string) {
    return this._contact.model.oursEmailContact.count({ where: { organizationId: orgId, status: 'SUBSCRIBED' } });
  }

  // Everyone on the list who may be emailed now.
  subscribedRecipients(orgId: string) {
    return this._contact.model.oursEmailContact.findMany({
      where: { organizationId: orgId, status: 'SUBSCRIBED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, basis: true },
    });
  }

  queuedDeliveries(orgId: string, campaignId: string, take: number) {
    return this._delivery.model.oursEmailDelivery.findMany({
      where: { organizationId: orgId, campaignId, status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      take,
      select: { id: true, email: true, contactId: true },
    });
  }

  // The contacts behind a batch, as they stand now (they may have unsubscribed).
  contactsForDelivery(orgId: string, ids: string[]) {
    return this._contact.model.oursEmailContact.findMany({
      where: { organizationId: orgId, id: { in: ids } },
      select: { id: true, email: true, status: true, basis: true },
    });
  }

  // Moves a delivery on, only from the status we expect it to be in.
  async moveDelivery(
    orgId: string,
    id: string,
    from: OursEmailDeliveryStatus,
    data: { status: OursEmailDeliveryStatus; messageId?: string; error?: string; sentAt?: Date }
  ) {
    const { count } = await this._delivery.model.oursEmailDelivery.updateMany({
      where: { id, organizationId: orgId, status: from },
      data,
    });
    return count === 1;
  }

  // Ends the campaign with its counts: SENT, or FAILED when nothing went or
  // the sender paused this business. Only by the process holding the lease.
  async finishCampaign(orgId: string, id: string, owner: string, paused = false) {
    if (!(await this._campaign.model.oursEmailCampaign.count({ where: { id, organizationId: orgId, leaseOwner: owner } }))) {
      return null;
    }
    // anything left mid-send by a stopped backend may or may not have gone
    await this._delivery.model.oursEmailDelivery.updateMany({
      where: { organizationId: orgId, campaignId: id, status: 'SENDING' },
      data: { status: 'FAILED', error: 'Interrupted while sending; not sent again.' },
    });
    const rows = await this._delivery.model.oursEmailDelivery.groupBy({
      by: ['status'],
      where: { organizationId: orgId, campaignId: id },
      _count: { _all: true },
    });
    const count = (statuses: OursEmailDeliveryStatus[]) =>
      rows.filter((r) => statuses.includes(r.status)).reduce((n, r) => n + r._count._all, 0);
    const sent = count(['SENT', 'SIMULATED', 'DELIVERED', 'BOUNCED', 'COMPLAINED']);
    const failed = count(['FAILED']);
    const status: OursEmailCampaignStatus = paused || (sent === 0 && failed > 0) ? 'FAILED' : 'SENT';
    await this._campaign.model.oursEmailCampaign.updateMany({
      where: { id, organizationId: orgId, leaseOwner: owner },
      data: {
        status,
        finishedAt: new Date(),
        leaseUntil: null,
        leaseOwner: null,
        sent,
        failed,
      },
    });
    return { status, sent };
  }

  getSenderSetup(orgId: string) {
    return this._sender.model.oursEmailSender.findUnique({
      where: { organizationId: orgId },
      select: { tenantName: true, configurationSet: true },
    });
  }

  saveSenderSetup(orgId: string, setup: { tenantName: string; configurationSet: string }) {
    return this._sender.model.oursEmailSender.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, ...setup },
      update: setup,
      select: { tenantName: true, configurationSet: true },
    });
  }

  // System work: form sign-ups whose confirmation email hasn't gone yet.
  // Only recent ones: someone who signed up weeks ago isn't expecting it.
  pendingConfirmations(since: Date, take: number) {
    return this._contact.model.oursEmailContact.findMany({
      where: { status: 'PENDING_CONFIRMATION', source: 'FORM', confirmationSentAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take,
      select: { id: true, organizationId: true, email: true },
    });
  }

  // Claims the confirmation email for one sign-up, so it goes once.
  async claimConfirmation(orgId: string, contactId: string) {
    const { count } = await this._contact.model.oursEmailContact.updateMany({
      where: { id: contactId, organizationId: orgId, confirmationSentAt: null, status: 'PENDING_CONFIRMATION' },
      data: { confirmationSentAt: new Date() },
    });
    return count === 1;
  }

  // The email didn't go and can be tried again.
  releaseConfirmation(orgId: string, contactId: string) {
    return this._contact.model.oursEmailContact.updateMany({
      where: { id: contactId, organizationId: orgId },
      data: { confirmationSentAt: null },
    });
  }

  // From a sender event: the event's signature has already been checked.
  deliveryForMessage(messageId: string) {
    return this._delivery.model.oursEmailDelivery.findFirst({
      where: { messageId },
      select: { id: true, organizationId: true, email: true, status: true },
    });
  }

  markDeliveryEvent(orgId: string, id: string, status: Extract<OursEmailDeliveryStatus, 'DELIVERED' | 'BOUNCED' | 'COMPLAINED'>) {
    return this._delivery.model.oursEmailDelivery.updateMany({
      // a bounce or complaint always wins over delivered, never the reverse
      where: {
        id,
        organizationId: orgId,
        status: { in: status === 'DELIVERED' ? ['SENT'] : ['SENT', 'DELIVERED', 'BOUNCED'] },
      },
      data: { status },
    });
  }
}
