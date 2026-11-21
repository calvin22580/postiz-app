// OURS: which plan an organisation is on and what it has used this billing month
// (Milestone 7). Every query is scoped by organizationId.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const isUniqueClash = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

const planSelect = {
  plan: true,
  trialEndsAt: true,
  paymentProvider: true,
  externalId: true,
  startedAt: true,
} as const;

@Injectable()
export class PlanRepository {
  constructor(
    private _plan: PrismaRepository<'oursPlanSubscription'>,
    private _usage: PrismaRepository<'oursUsageCounter'>,
    private _aiUsage: PrismaRepository<'oursAiUsage'>
  ) {}

  getPlan(orgId: string) {
    return this._plan.model.oursPlanSubscription.findUnique({
      where: { organizationId: orgId },
      select: planSelect,
    });
  }

  // the first time we see an organisation it starts a trial; an existing row
  // is never changed here
  async startTrial(orgId: string, trialEndsAt: Date) {
    try {
      return await this._plan.model.oursPlanSubscription.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, plan: 'trial', trialEndsAt },
        update: {},
        select: planSelect,
      });
    } catch (e) {
      // two first requests at once: the other one created the row
      if (isUniqueClash(e)) {
        return (await this.getPlan(orgId))!;
      }
      throw e;
    }
  }

  // externalId: the provider's subscription id (Stripe), left as it is when
  // not given. startedAt: when the allowance month starts (the billing
  // date); not given keeps the one on record (a change of plan on the same
  // subscription).
  setPlan(orgId: string, plan: string, paymentProvider: string, externalId?: string, startedAt?: Date) {
    return this._plan.model.oursPlanSubscription.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, plan, paymentProvider, externalId, ...(startedAt ? { startedAt } : {}) },
      update: { plan, paymentProvider, externalId, trialEndsAt: null, ...(startedAt ? { startedAt } : {}) },
      select: planSelect,
    });
  }

  // A paid subscription is over: back to an ended trial, so new work stops
  // until the owner picks a plan. Only the subscription we have on record can
  // end it, so a late event about an older one changes nothing.
  async endPlan(orgId: string, externalId: string, endedAt: Date) {
    const { count } = await this._plan.model.oursPlanSubscription.updateMany({
      // already ended: a repeated event doesn't move the date
      where: { organizationId: orgId, externalId, plan: { not: 'trial' } },
      data: { plan: 'trial', trialEndsAt: endedAt },
    });
    return count === 1;
  }

  async getUsage(orgId: string, period: string) {
    const rows = await this._usage.model.oursUsageCounter.findMany({
      where: { organizationId: orgId, period },
      select: { metric: true, used: true },
    });
    return Object.fromEntries(rows.map((r) => [r.metric, r.used])) as Record<string, number>;
  }

  // Takes one unit if any is left, in a single conditional update, so double
  // clicks and parallel requests can't go past the limit.
  async claim(orgId: string, period: string, metric: string, limit: number) {
    try {
      await this._usage.model.oursUsageCounter.upsert({
        where: {
          organizationId_period_metric: { organizationId: orgId, period, metric },
        },
        create: { organizationId: orgId, period, metric },
        update: {},
        select: { id: true },
      });
    } catch (e) {
      // a parallel request created the row first, which is all we need
      if (!isUniqueClash(e)) {
        throw e;
      }
    }
    const { count } = await this._usage.model.oursUsageCounter.updateMany({
      where: { organizationId: orgId, period, metric, used: { lt: limit } },
      data: { used: { increment: 1 } },
    });
    return count === 1;
  }

  // returns a unit when the work it paid for didn't happen
  giveBack(orgId: string, period: string, metric: string) {
    return this._usage.model.oursUsageCounter.updateMany({
      where: { organizationId: orgId, period, metric, used: { gt: 0 } },
      data: { used: { decrement: 1 } },
    });
  }

  async aiSpendUsd(orgId: string, from: Date, to: Date) {
    const { _sum } = await this._aiUsage.model.oursAiUsage.aggregate({
      where: { organizationId: orgId, createdAt: { gte: from, lt: to } },
      _sum: { costUsd: true },
    });
    return Number(_sum.costUsd || 0);
  }
}
