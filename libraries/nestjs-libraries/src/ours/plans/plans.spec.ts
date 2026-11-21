// OURS: plans and usage (Milestone 7). The plan config is consistent, the
// allowance month follows the UK calendar, limits can't be passed, failed
// work is given back, and the owner always gets a plain-English reason.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_METRICS,
  billingMode,
  findPlan,
  METRICS,
  PAID_PLANS,
  pricingDisplay,
  TRIAL_PLAN,
  trialDays,
} from '@gitroom/nestjs-libraries/ours/plans/plans.config';
import {
  allowancePeriod,
  channelLimitMessage,
  keepsBillingDate,
  limitMessage,
  planStatus,
  PlanService,
  PLAN_LIMIT_STATUS,
  usagePeriod,
} from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { paymentProviderFor } from '@gitroom/nestjs-libraries/ours/plans/plan.payment';
import { ChangePlanDto } from '@gitroom/nestjs-libraries/ours/plans/dtos/plan.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

const DAY = 24 * 3600 * 1000;

describe('plan config', () => {
  it('has the three test prices in pence, cheapest first, with a free trial', () => {
    expect(PAID_PLANS.map((p) => p.monthlyPence)).toEqual([7900, 14900, 29900]);
    expect(TRIAL_PLAN.monthlyPence).toBeNull();
    expect(new Set(PAID_PLANS.map((p) => p.key)).size).toBe(PAID_PLANS.length);
  });

  it('never gives a bigger plan less of anything', () => {
    const keys = [...METRICS.map((m) => m.key), 'channels', 'platforms', 'aiSpendUsd'] as const;
    for (let i = 1; i < PAID_PLANS.length; i++) {
      for (const k of keys) {
        expect(PAID_PLANS[i].limits[k], `${PAID_PLANS[i].key}.${k}`).toBeGreaterThanOrEqual(
          PAID_PLANS[i - 1].limits[k]
        );
      }
    }
  });

  it('gives every plan a whole, positive limit for every metric', () => {
    for (const p of [TRIAL_PLAN, ...PAID_PLANS]) {
      for (const m of METRICS) {
        expect(Number.isInteger(p.limits[m.key]) && p.limits[m.key] > 0, `${p.key}.${m.key}`).toBe(true);
      }
      expect(p.limits.channels).toBeGreaterThan(0);
      expect(p.limits.aiSpendUsd).toBeGreaterThan(0);
    }
  });

  it('lets the trial write a full week on all three platforms', () => {
    // 5 weekdays x Facebook, Instagram, LinkedIn
    expect(TRIAL_PLAN.limits.postsScheduled).toBeGreaterThanOrEqual(15);
    expect(TRIAL_PLAN.limits.platforms).toBe(3);
  });

  it('writes each plan’s week on as many platforms as its summary says', () => {
    expect(PAID_PLANS.map((p) => p.limits.platforms)).toEqual([1, 2, 3]);
  });

  it('never gives a paying customer less than the trial', () => {
    const keys = [...METRICS.map((m) => m.key), 'aiSpendUsd'] as const;
    for (const k of keys) {
      // a week of posts is the one exception: every plan writes a week a week
      if (k === 'captionWeeks' || k === 'postsScheduled') continue;
      expect(PAID_PLANS[0].limits[k], `starter.${k}`).toBeGreaterThanOrEqual(TRIAL_PLAN.limits[k]);
    }
  });

  it('reads settings from the environment with UK defaults', () => {
    expect(pricingDisplay({})).toEqual({ currency: 'GBP', locale: 'en-GB', vatRegistered: false, vatRate: 0.2 });
    expect(pricingDisplay({ OURS_VAT_REGISTERED: 'true', OURS_VAT_RATE: '0.05', OURS_CURRENCY: 'eur' })).toMatchObject({
      currency: 'EUR',
      vatRegistered: true,
      vatRate: 0.05,
    });
    expect(pricingDisplay({ OURS_VAT_RATE: '20' }).vatRate).toBe(0.2);
    expect(trialDays({})).toBe(14);
    expect(trialDays({ OURS_TRIAL_DAYS: '7' })).toBe(7);
    expect(trialDays({ OURS_TRIAL_DAYS: 'soon' })).toBe(14);
    expect(billingMode({})).toBe('off');
    expect(billingMode({ OURS_BILLING_MODE: 'test' })).toBe('test');
    expect(billingMode({ OURS_BILLING_MODE: 'stripe' })).toBe('off');
  });

  it('only takes payment through a provider, and has none yet', () => {
    expect(paymentProviderFor('off')).toBeNull();
    expect(paymentProviderFor('test')?.name).toBe('test');
  });

  it('accepts only paid plan keys when changing plan', () => {
    const check = (plan: unknown) => validateSync(plainToInstance(ChangePlanDto, { plan })).length;
    expect(check('growth')).toBe(0);
    expect(check('trial')).toBeGreaterThan(0);
    expect(check('enterprise')).toBeGreaterThan(0);
  });
});

describe('allowance periods', () => {
  it('resets on the billing date each month, not the 1st', () => {
    const startedAt = new Date('2026-11-19T15:00:00Z');
    expect(usagePeriod(startedAt, new Date('2026-11-20T12:00:00Z'), 'Europe/London')).toMatchObject({
      key: '2026-11-19',
      startDate: '2026-11-19',
      resetsOn: '2026-12-19',
    });
    // the moment it renews, the next month starts
    expect(usagePeriod(startedAt, new Date('2026-12-19T14:59:59Z')).key).toBe('2026-11-19');
    expect(usagePeriod(startedAt, new Date('2026-12-19T15:00:00Z')).key).toBe('2026-12-19');
    expect(usagePeriod(startedAt, new Date('2027-03-01T00:00:00Z'))).toMatchObject({ key: '2027-02-19', resetsOn: '2027-03-19' });
  });

  it('counts each month from the start, as Stripe bills a plan started on the 31st', () => {
    const startedAt = new Date('2027-01-31T10:00:00Z');
    const feb = usagePeriod(startedAt, new Date('2027-02-15T12:00:00Z'));
    expect(feb).toMatchObject({ key: '2027-01-31', resetsOn: '2027-02-28' });
    expect(usagePeriod(startedAt, new Date('2027-03-10T12:00:00Z'))).toMatchObject({ key: '2027-02-28', resetsOn: '2027-03-31' });
    expect(usagePeriod(startedAt, new Date('2027-04-01T12:00:00Z'))).toMatchObject({ key: '2027-03-31', resetsOn: '2027-04-30' });
    expect(limitMessage(findPlan('starter')!, 'rewrites', feb.end)).toContain('resets on 28/02/2027');
  });

  it('shows the billing date in UK time', () => {
    // 23:30 UTC on 31 March 2026 is 1 April in British Summer Time
    expect(usagePeriod(new Date('2026-03-31T23:30:00Z'), new Date('2026-04-10T12:00:00Z'), 'Europe/London')).toMatchObject({
      startDate: '2026-04-01',
      resetsOn: '2026-05-01',
    });
  });

  it('keeps the billing date when moving between paid plans on the same subscription', () => {
    expect(keepsBillingDate({ plan: 'starter', paymentProvider: 'stripe', externalId: 'sub_1' }, 'stripe', 'sub_1')).toBe(true);
    expect(keepsBillingDate({ plan: 'starter', paymentProvider: 'test' }, 'test', undefined)).toBe(true);
    // a first paid plan, a new subscription, or a plan that ended starts afresh
    expect(keepsBillingDate({ plan: 'trial', paymentProvider: 'none' }, 'stripe', 'sub_1')).toBe(false);
    expect(keepsBillingDate({ plan: 'trial', paymentProvider: 'stripe', externalId: 'sub_1' }, 'stripe', 'sub_1')).toBe(false);
    expect(keepsBillingDate({ plan: 'growth', paymentProvider: 'stripe', externalId: 'sub_1' }, 'stripe', 'sub_2')).toBe(false);
    expect(keepsBillingDate(null, 'stripe', 'sub_1')).toBe(false);
  });

  it('doesn’t count AI spent in the trial against the first paid month', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    const upgraded = new Date('2026-11-10T09:00:00Z');
    expect(allowancePeriod({ plan: 'starter', startedAt: upgraded, trialEndsAt: null }, now).spendFrom).toEqual(upgraded);
    const longAgo = new Date('2026-01-01T00:00:00Z');
    expect(allowancePeriod({ plan: 'starter', startedAt: longAgo, trialEndsAt: null }, now).spendFrom.toISOString()).toBe(
      '2026-11-01T00:00:00.000Z'
    );
    const midMonth = new Date('2026-03-14T09:00:00Z');
    expect(allowancePeriod({ plan: 'starter', startedAt: midMonth, trialEndsAt: null }, now).spendFrom.toISOString()).toBe(
      '2026-11-14T09:00:00.000Z'
    );
  });

  it('gives the trial one allowance for its whole length', () => {
    const startedAt = new Date('2026-11-25T10:00:00Z');
    const trialEndsAt = new Date('2026-12-09T10:00:00Z');
    const p = allowancePeriod({ plan: 'trial', startedAt, trialEndsAt }, new Date('2026-12-02T10:00:00Z'));
    expect(p).toMatchObject({ key: 'trial', resetsOn: null, start: startedAt });
    expect(allowancePeriod({ plan: 'growth', startedAt, trialEndsAt: null }, new Date('2026-12-02T10:00:00Z')).key).toBe('2026-11-25');
  });

  it('knows when a trial has ended', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    expect(planStatus({ plan: 'trial', trialEndsAt: new Date(now.getTime() + DAY) }, now)).toBe('trial');
    expect(planStatus({ plan: 'trial', trialEndsAt: new Date(now.getTime() - 1) }, now)).toBe('trial-ended');
    expect(planStatus({ plan: 'starter', trialEndsAt: null }, now)).toBe('active');
  });
});

describe('limit messages', () => {
  it('says what ran out, when it resets (DD/MM/YYYY) and which plan has more', () => {
    const starter = findPlan('starter')!;
    expect(limitMessage(starter, 'rewrites', new Date('2026-12-01T00:00:00Z'))).toBe(
      'You’ve used all 20 new versions of a post included in your Starter plan this month. It resets on 01/12/2026. Growth includes 60 a month: see Plan and usage.'
    );
  });

  it('suggests no plan when already on the biggest one for that limit', () => {
    const pro = findPlan('pro')!;
    const message = limitMessage(pro, 'postsScheduled', new Date('2027-01-01T00:00:00Z'));
    expect(message).toContain('100 scheduled posts included in your Pro plan');
    expect(message).not.toContain('includes');
    // every paid plan writes a week every week: nothing bigger to suggest
    expect(limitMessage(findPlan('starter')!, 'captionWeeks', new Date())).not.toContain('includes');
  });

  it('asks a trial to choose a plan instead of waiting for a reset', () => {
    const message = limitMessage(TRIAL_PLAN, 'postsScheduled', new Date());
    expect(message).toBe(
      'You’ve used all 15 scheduled posts included in your free trial. Choose a plan on Plan and usage to keep going.'
    );
  });

  it('explains the channel limit', () => {
    expect(channelLimitMessage(findPlan('starter')!, 2)).toBe(
      'Your Starter plan includes 2 connected channels, and you’re using 2. Remove one to connect another, or move to Growth (4 channels) on Plan and usage.'
    );
    expect(channelLimitMessage(findPlan('pro')!, 8)).toMatch(/Remove one to connect another\.$/);
  });
});

// An in-memory PlanRepository with the same conditional-update behaviour.
const makeService = (opts: { plan?: Record<string, unknown> | null; spent?: number; channels?: { disabled: boolean }[] } = {}) => {
  let plan = opts.plan === undefined ? null : opts.plan;
  const counters = new Map<string, number>();
  const repo = {
    getPlan: vi.fn(async () => plan),
    startTrial: vi.fn(async (_org: string, trialEndsAt: Date) => {
      plan = plan || { plan: 'trial', trialEndsAt, paymentProvider: 'none', startedAt: new Date() };
      return plan;
    }),
    setPlan: vi.fn(async (_org: string, key: string, paymentProvider: string) => {
      plan = { plan: key, trialEndsAt: null, paymentProvider, startedAt: new Date() };
      return plan;
    }),
    getUsage: vi.fn(async (_org: string, period: string) =>
      Object.fromEntries([...counters].filter(([k]) => k.startsWith(`${period}:`)).map(([k, v]) => [k.split(':')[1], v]))
    ),
    claim: vi.fn(async (_org: string, period: string, metric: string, limit: number) => {
      const used = counters.get(`${period}:${metric}`) || 0;
      if (used >= limit) return false;
      counters.set(`${period}:${metric}`, used + 1);
      return true;
    }),
    giveBack: vi.fn(async (_org: string, period: string, metric: string) => {
      const used = counters.get(`${period}:${metric}`) || 0;
      if (used > 0) counters.set(`${period}:${metric}`, used - 1);
    }),
    aiSpendUsd: vi.fn(async () => opts.spent || 0),
  };
  const integrations = {
    getIntegrationsList: vi.fn(async () => opts.channels || []),
    getIntegrationByInternalId: vi.fn(async (_org: string, id: string) => (id === 'existing' ? { id: 'i1' } : null)),
    getIntegrationById: vi.fn(async (_org: string, id: string) => (id === 'i1' ? { id: 'i1' } : null)),
  };
  const service = new PlanService(repo as never, integrations as never);
  return { service, repo, integrations, counters };
};

const active = (key: string) => ({ plan: key, trialEndsAt: null, paymentProvider: 'test', startedAt: new Date('2026-01-01') });

describe('PlanService', () => {
  afterEach(() => {
    delete process.env.OURS_BILLING_MODE;
  });

  it('starts a 14-day free trial the first time it sees an organisation', async () => {
    const { service, repo } = makeService();
    const now = new Date('2026-11-16T12:00:00Z');
    const { plan, status } = await service.current('org-1', now);
    expect(plan.key).toBe('trial');
    expect(status).toBe('trial');
    expect(repo.startTrial).toHaveBeenCalledWith('org-1', new Date('2026-11-30T12:00:00Z'));
  });

  it('takes one unit at a time and refuses past the limit with a 403 and a reason', async () => {
    const { service } = makeService({ plan: active('starter') });
    for (let i = 0; i < 3; i++) {
      await service.claim('org-1', 'profileBuilds');
    }
    const error = await service.claim('org-1', 'profileBuilds').catch((e) => e);
    expect(error.getStatus()).toBe(PLAN_LIMIT_STATUS);
    expect(error.message).toContain('all 3 website reads included in your Starter plan this month');
  });

  it('never refuses with 402, which sends the owner to upstream’s billing page', () => {
    expect(PLAN_LIMIT_STATUS).not.toBe(402);
  });

  it('gives back a unit when the work didn’t happen, and never throws doing it', async () => {
    const { service, counters, repo } = makeService({ plan: active('starter') });
    const ticket = await service.claim('org-1', 'captionWeeks');
    expect([...counters.values()]).toEqual([1]);
    await service.giveBack('org-1', ticket);
    expect([...counters.values()]).toEqual([0]);
    repo.giveBack.mockRejectedValueOnce(new Error('db down'));
    await expect(service.giveBack('org-1', ticket)).resolves.toBeUndefined();
    await expect(service.giveBack('org-1', null)).resolves.toBeUndefined();
  });

  it('gives a unit back to the month it was taken from', async () => {
    const { service, repo } = makeService({ plan: active('growth') });
    const ticket = await service.claim('org-1', 'rewrites', new Date('2026-11-30T23:59:00Z'));
    await service.giveBack('org-1', ticket);
    expect(repo.giveBack).toHaveBeenCalledWith('org-1', '2026-11-01', 'rewrites');
  });

  it('blocks everything once the trial has ended', async () => {
    const { service } = makeService({
      plan: { plan: 'trial', trialEndsAt: new Date('2026-11-01T12:00:00Z'), paymentProvider: 'none', startedAt: new Date('2026-10-18') },
    });
    await expect(service.claim('org-1', 'postsScheduled')).rejects.toThrow(
      'Your free trial ended on 01/11/2026. Choose a plan on Plan and usage to keep going.'
    );
    await expect(service.assertCanAddChannel('org-1')).rejects.toThrow('free trial ended');
    expect((await service.assertCanAddChannel('org-1').catch((e) => e)).getResponse()).toMatchObject({
      planLimit: 'channels',
    });
  });

  it('stops AI work at the fair-use cap, but still lets approved posts through', async () => {
    const { service } = makeService({ plan: active('starter'), spent: 8 });
    for (const metric of AI_METRICS) {
      await expect(service.claim('org-1', metric)).rejects.toThrow('fair-use limit for AI writing');
    }
    await expect(service.claim('org-1', 'postsScheduled')).resolves.toMatchObject({ metric: 'postsScheduled' });
  });

  it('falls back to the cheapest plan if a stored plan key no longer exists', async () => {
    const { service } = makeService({ plan: active('gold') });
    expect((await service.current('org-1')).plan.key).toBe('starter');
  });

  it('counts disabled channels too, and lets an existing channel reconnect', async () => {
    // a disabled channel can be enabled again without connecting anything
    const two = [{ disabled: false }, { disabled: true }];
    const { service } = makeService({ plan: active('starter'), channels: two });
    await expect(service.assertCanAddChannel('org-1')).rejects.toThrow('includes 2 connected channels, and you’re using 2');
    // the app's connect buttons look for planLimit to show the message
    const error = await service.assertCanAddChannel('org-1').catch((e) => e);
    expect(error.getStatus()).toBe(PLAN_LIMIT_STATUS);
    expect(error.getResponse()).toMatchObject({ planLimit: 'channels' });
    await expect(service.assertCanAddChannel('org-1', 'existing')).resolves.toBeUndefined();
    // the public API passes the channel's id instead of its internal id
    await expect(service.assertCanAddChannel('org-1', 'i1')).resolves.toBeUndefined();
    await expect(service.assertCanAddChannel('org-1', 'someone-elses')).rejects.toThrow('connected channels');
    const growth = makeService({ plan: active('growth'), channels: two });
    await expect(growth.service.assertCanAddChannel('org-1')).resolves.toBeUndefined();
  });

  it('shows usage, channels and plans, without the AI cost', async () => {
    const { service } = makeService({ plan: active('growth'), channels: [{ disabled: false }], spent: 1.23 });
    await service.claim('org-1', 'postsScheduled');
    const view = await service.overview('org-1', true);
    expect(view.plan).toMatchObject({ key: 'growth', name: 'Growth', status: 'active', monthlyPence: 14900 });
    expect(view.usage.find((u) => u.key === 'postsScheduled')).toMatchObject({ used: 1, limit: 50 });
    expect(view.channels).toEqual({ used: 1, limit: 4 });
    expect(view.plans).toHaveLength(3);
    expect(JSON.stringify(view)).not.toContain('aiSpendUsd');
    expect(JSON.stringify(view)).not.toContain('1.23');
    expect(view.fairUseReached).toBe(false);
    expect(view.billing).toEqual({ mode: 'off', canChange: false, canManage: false, testPayments: false });
  });

  it('only changes plan in test mode, and only for admins', async () => {
    const { service, repo } = makeService({ plan: active('starter') });
    await expect(service.changePlan('org-1', 'growth', true)).rejects.toThrow('isn’t available in the app yet');
    process.env.OURS_BILLING_MODE = 'test';
    await expect(service.changePlan('org-1', 'growth', false)).rejects.toThrow('Only an admin');
    await expect(service.changePlan('org-1', 'trial', true)).rejects.toThrow('doesn’t exist');
    expect(repo.setPlan).not.toHaveBeenCalled();
    const view = await service.changePlan('org-1', 'growth', true);
    // a change between paid plans keeps the billing date
    expect(repo.setPlan).toHaveBeenCalledWith('org-1', 'growth', 'test', undefined, undefined);
    expect(view.plan.key).toBe('growth');
    expect(view.billing).toEqual({ mode: 'test', canChange: true, canManage: false, testPayments: false });
  });
});
