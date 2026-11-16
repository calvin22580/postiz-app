// OURS: plans and monthly usage (Milestone 7). Our own features ask this
// service for one unit of an allowance before doing the work, and give it
// back when the work didn't happen. Upstream's billing (Stripe, pricing.ts,
// PermissionsService) is separate and stays off while STRIPE_PUBLISHABLE_KEY
// is unset.
import { HttpException, Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { PlanRepository } from '@gitroom/nestjs-libraries/ours/plans/plan.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { captionTimezone } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  AI_METRICS,
  billingMode,
  findPlan,
  METRICS,
  MeteredKey,
  PAID_PLANS,
  PlanDefinition,
  pricingDisplay,
  TRIAL_PLAN_KEY,
  trialDays,
} from '@gitroom/nestjs-libraries/ours/plans/plans.config';
import { paymentProviderFor } from '@gitroom/nestjs-libraries/ours/plans/plan.payment';

dayjs.extend(utc);
dayjs.extend(timezone);

// HTTP status for "your plan doesn't allow this". Not 402: upstream's screens
// answer 402 by sending the owner to upstream's own billing page.
export const PLAN_LIMIT_STATUS = 403;

export type PlanStatus = 'trial' | 'trial-ended' | 'active';

// what claim() took, so the same unit can be given back
export interface UsageTicket {
  metric: MeteredKey;
  period: string;
}

// The allowance month: the calendar month in the business's time zone.
export const usagePeriod = (now: Date = new Date(), tz = captionTimezone()) => {
  const start = dayjs(now).tz(tz).startOf('month');
  // from the date, not start + 1 month: that keeps the start's UTC offset,
  // which is an hour out when the clocks change in March and October
  const next = dayjs.tz(start.add(1, 'month').format('YYYY-MM-DD'), tz);
  return {
    key: start.format('YYYY-MM'),
    start: start.toDate(),
    end: next.toDate(),
    startDate: start.format('YYYY-MM-DD'),
    resetsOn: next.format('YYYY-MM-DD'),
  };
};

// The trial's allowance covers the whole trial and never resets; paid plans
// use the calendar month.
export const allowancePeriod = (
  row: { plan: string; startedAt: Date; trialEndsAt: Date | null },
  now: Date = new Date()
) => {
  if (row.plan === TRIAL_PLAN_KEY) {
    return {
      key: TRIAL_PLAN_KEY,
      start: row.startedAt,
      end: row.trialEndsAt || now,
      startDate: dayjs(row.startedAt).tz(captionTimezone()).format('YYYY-MM-DD'),
      resetsOn: null as string | null,
      spendFrom: row.startedAt,
    };
  }
  const month = usagePeriod(now);
  // AI spent during the trial doesn't count against the first paid month
  const spendFrom = row.startedAt > month.start ? row.startedAt : month.start;
  return { ...month, spendFrom };
};

// A calendar date for a message, in the configured locale (DD/MM/YYYY for
// en-GB).
export const formatDay = (date: Date, tz = captionTimezone()) =>
  new Intl.DateTimeFormat(pricingDisplay().locale, {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);

export const planStatus = (
  row: { plan: string; trialEndsAt: Date | null },
  now: Date = new Date()
): PlanStatus => {
  if (row.plan !== TRIAL_PLAN_KEY) {
    return 'active';
  }
  return row.trialEndsAt && row.trialEndsAt.getTime() <= now.getTime() ? 'trial-ended' : 'trial';
};

// The next plan up that allows more of something, for the "move to …" hint.
export const biggerPlan = (current: PlanDefinition, key: MeteredKey | 'channels') =>
  PAID_PLANS.find((p) => p.limits[key] > current.limits[key]);

const metricLabel = (key: MeteredKey) => METRICS.find((m) => m.key === key)!.label;

// "your Starter plan", or "your free trial"
const planPhrase = (plan: PlanDefinition) =>
  plan.key === TRIAL_PLAN_KEY ? 'your free trial' : `your ${plan.name} plan`;

export const limitMessage = (
  plan: PlanDefinition,
  key: MeteredKey,
  resetsOn: Date
) => {
  if (plan.key === TRIAL_PLAN_KEY) {
    return `You’ve used all ${plan.limits[key]} ${metricLabel(key)} included in your free trial. Choose a plan on Plan and usage to keep going.`;
  }
  const next = biggerPlan(plan, key);
  return [
    `You’ve used all ${plan.limits[key]} ${metricLabel(key)} included in ${planPhrase(plan)} this month.`,
    `It resets on ${formatDay(resetsOn)}.`,
    next ? `${next.name} includes ${next.limits[key]} a month: see Plan and usage.` : '',
  ]
    .filter(Boolean)
    .join(' ');
};

export const fairUseMessage = (plan: PlanDefinition, resetsOn: Date) =>
  plan.key === TRIAL_PLAN_KEY
    ? 'You’ve reached the fair-use limit for AI writing in your free trial. Choose a plan on Plan and usage to keep going.'
    : `You’ve reached this month’s fair-use limit for AI writing. It resets on ${formatDay(resetsOn)}. If you need more before then, please get in touch.`;

export const channelLimitMessage = (plan: PlanDefinition, used: number) => {
  const next = biggerPlan(plan, 'channels');
  const ask = next
    ? `Remove one to connect another, or move to ${next.name} (${next.limits.channels} channels) on Plan and usage.`
    : 'Remove one to connect another.';
  const intro = planPhrase(plan);
  return `${intro[0].toUpperCase()}${intro.slice(1)} includes ${plan.limits.channels} connected channels, and you’re using ${used}. ${ask}`;
};

@Injectable()
export class PlanService {
  private _logger = new Logger(PlanService.name);

  constructor(
    private _planRepository: PlanRepository,
    private _integrationService: IntegrationService
  ) {}

  // The organisation's plan. The first time we see an organisation, its free
  // trial starts.
  async current(orgId: string, now: Date = new Date()) {
    const row =
      (await this._planRepository.getPlan(orgId)) ||
      (await this._planRepository.startTrial(
        orgId,
        dayjs(now).add(trialDays(), 'day').toDate()
      ));
    let plan = findPlan(row.plan);
    if (!plan) {
      // a plan key was renamed in plans.config.ts: never lock the owner out
      this._logger.warn(`Unknown plan "${row.plan}" for org=${orgId}, using ${PAID_PLANS[0].key}`);
      plan = PAID_PLANS[0];
    }
    return { row, plan, status: planStatus(row, now) };
  }

  // Takes one unit of a monthly allowance, or explains in plain words why
  // not. Call it right before the work; give the ticket back if the work
  // didn't happen.
  async claim(orgId: string, metric: MeteredKey, now: Date = new Date()): Promise<UsageTicket> {
    const { row, plan, status } = await this.current(orgId, now);
    this.assertUsable(row, status);
    const period = allowancePeriod(row, now);
    if (AI_METRICS.includes(metric)) {
      const spent = await this._planRepository.aiSpendUsd(orgId, period.spendFrom, now);
      if (spent >= plan.limits.aiSpendUsd) {
        this._logger.warn(`Fair-use AI limit reached for org=${orgId}: ${spent} USD`);
        throw new HttpException(fairUseMessage(plan, period.end), PLAN_LIMIT_STATUS);
      }
    }
    if (!(await this._planRepository.claim(orgId, period.key, metric, plan.limits[metric]))) {
      throw new HttpException(limitMessage(plan, metric, period.end), PLAN_LIMIT_STATUS);
    }
    return { metric, period: period.key };
  }

  // Never throws: the caller is usually already handling a failure.
  async giveBack(orgId: string, ticket: UsageTicket | null | undefined) {
    if (!ticket) {
      return;
    }
    try {
      await this._planRepository.giveBack(orgId, ticket.period, ticket.metric);
    } catch (e) {
      this._logger.error(
        `Could not give back ${ticket.metric} for org=${orgId}: ${(e as Error).message}`
      );
    }
  }

  // Connecting another channel: checked when the owner starts connecting one.
  // Reconnecting a channel the organisation already has doesn't add one.
  // refreshId is its internal id (the app) or its id (the public API).
  async assertCanAddChannel(orgId: string, refreshId?: string) {
    if (
      refreshId &&
      ((await this._integrationService.getIntegrationByInternalId(orgId, refreshId)) ||
        (await this._integrationService.getIntegrationById(orgId, refreshId)))
    ) {
      return;
    }
    const { row, plan, status } = await this.current(orgId);
    this.assertUsable(row, status);
    const used = await this.channelsUsed(orgId);
    if (used >= plan.limits.channels) {
      throw new HttpException(channelLimitMessage(plan, used), PLAN_LIMIT_STATUS);
    }
  }

  async overview(orgId: string, canManage: boolean) {
    const now = new Date();
    const { row, plan, status } = await this.current(orgId, now);
    const period = allowancePeriod(row, now);
    const [used, channels, spent] = await Promise.all([
      this._planRepository.getUsage(orgId, period.key),
      this.channelsUsed(orgId),
      this._planRepository.aiSpendUsd(orgId, period.spendFrom, now),
    ]);
    const mode = billingMode();
    return {
      plan: {
        key: plan.key,
        name: plan.name,
        summary: plan.summary,
        monthlyPence: plan.monthlyPence,
        status,
        trialEndsAt: row.trialEndsAt ? dayjs(row.trialEndsAt).tz(captionTimezone()).format('YYYY-MM-DD') : null,
      },
      period: { start: period.startDate, resetsOn: period.resetsOn },
      usage: METRICS.map((m) => ({
        key: m.key,
        title: m.title,
        used: used[m.key] || 0,
        limit: plan.limits[m.key],
      })),
      channels: { used: channels, limit: plan.limits.channels },
      fairUseReached: spent >= plan.limits.aiSpendUsd,
      plans: PAID_PLANS.map((p) => ({
        key: p.key,
        name: p.name,
        summary: p.summary,
        monthlyPence: p.monthlyPence,
        limits: {
          ...Object.fromEntries(METRICS.map((m) => [m.key, p.limits[m.key]])),
          channels: p.limits.channels,
        },
      })),
      metrics: METRICS.map((m) => ({ key: m.key, title: m.title })),
      pricing: pricingDisplay(),
      billing: {
        mode,
        // only admins change the plan, and only where the app can do it
        canChange: mode === 'test' && canManage,
      },
    };
  }

  async changePlan(orgId: string, key: string, canManage: boolean) {
    const plan = PAID_PLANS.find((p) => p.key === key);
    if (!plan) {
      throw new HttpException('That plan doesn’t exist.', 400);
    }
    if (!canManage) {
      throw new HttpException('Only an admin of your team can change the plan.', PLAN_LIMIT_STATUS);
    }
    const provider = paymentProviderFor(billingMode());
    if (!provider) {
      throw new HttpException(
        'Changing plan isn’t available in the app yet. Please get in touch and we’ll do it for you.',
        400
      );
    }
    const result = await provider.changePlan(orgId, plan);
    if (result.status === 'changed') {
      await this._planRepository.setPlan(orgId, plan.key, provider.name);
    }
    return { ...(await this.overview(orgId, canManage)), ...(result.status === 'redirect' ? { redirect: result.url } : {}) };
  }

  private assertUsable(row: { trialEndsAt: Date | null }, status: PlanStatus) {
    if (status === 'trial-ended') {
      throw new HttpException(
        `Your free trial ended on ${formatDay(row.trialEndsAt!)}. Choose a plan on Plan and usage to keep going.`,
        PLAN_LIMIT_STATUS
      );
    }
  }

  private async channelsUsed(orgId: string) {
    // disabled channels count too: one can be enabled again without
    // connecting anything
    return (await this._integrationService.getIntegrationsList(orgId)).length;
  }
}
