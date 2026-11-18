// OURS: paying for a plan with Stripe. Live keys never switch payments on by
// accident, the owner is never charged a price we don't show, and the plan
// only changes when a signed Stripe event says so.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import {
  billingMode,
  planForStripeLookupKey,
  PAID_PLANS,
  stripeLookupKey,
} from '@gitroom/nestjs-libraries/ours/plans/plans.config';
import { StripePaymentProvider } from '@gitroom/nestjs-libraries/ours/plans/plan.stripe';
import { formatDay, planStatus, PlanService } from '@gitroom/nestjs-libraries/ours/plans/plan.service';

const WEBHOOK_SECRET = 'whsec_test_secret';
const starter = PAID_PLANS[0];
const growth = PAID_PLANS[1];

const price = (plan = growth, over: Partial<Stripe.Price> = {}) =>
  ({
    id: `price_${plan.key}`,
    unit_amount: plan.monthlyPence,
    currency: 'gbp',
    recurring: { interval: 'month' },
    lookup_key: stripeLookupKey(plan.key),
    ...over,
  }) as Stripe.Price;

const subscription = (over: Record<string, unknown> = {}, plan = growth) =>
  ({
    id: 'sub_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_1',
    metadata: { organizationId: 'org-1', plan: plan.key },
    items: { data: [{ id: 'si_1', price: price(plan) }] },
    ...over,
  }) as unknown as Stripe.Subscription;

// a Stripe client with only the calls we make, all recorded
const fakeStripe = (opts: { prices?: Stripe.Price[]; sub?: Stripe.Subscription } = {}) => {
  const calls = {
    checkout: vi.fn(async (_p: Stripe.Checkout.SessionCreateParams) => ({ url: 'https://checkout.stripe.test/c' })),
    portal: vi.fn(async (_p: Stripe.BillingPortal.SessionCreateParams) => ({ url: 'https://billing.stripe.test/p' })),
    prices: vi.fn(async (_p: Stripe.PriceListParams) => ({ data: opts.prices ?? [price()] })),
    retrieve: vi.fn(async (_id: string) => opts.sub ?? subscription()),
  };
  const stripe = {
    checkout: { sessions: { create: calls.checkout } },
    billingPortal: { sessions: { create: calls.portal } },
    prices: { list: calls.prices },
    subscriptions: { retrieve: calls.retrieve },
  } as unknown as Stripe;
  return { stripe, calls };
};

describe('Stripe billing mode', () => {
  it('only takes payments with a test key, unless live is allowed on purpose', () => {
    const base = { OURS_BILLING_MODE: 'stripe', OURS_STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET };
    expect(billingMode({ ...base, OURS_STRIPE_SECRET_KEY: 'sk_test_abc' })).toBe('stripe');
    expect(billingMode({ ...base, OURS_STRIPE_SECRET_KEY: 'rk_test_abc' })).toBe('stripe');
    expect(billingMode({ ...base, OURS_STRIPE_SECRET_KEY: 'sk_live_abc' })).toBe('off');
    expect(billingMode({ ...base, OURS_STRIPE_SECRET_KEY: 'sk_live_abc', OURS_STRIPE_ALLOW_LIVE: 'yes' })).toBe('off');
    expect(billingMode({ ...base, OURS_STRIPE_SECRET_KEY: 'sk_live_abc', OURS_STRIPE_ALLOW_LIVE: 'true' })).toBe('stripe');
    // no webhook secret: we'd never hear the payment went through
    expect(billingMode({ OURS_BILLING_MODE: 'stripe', OURS_STRIPE_SECRET_KEY: 'sk_test_abc' })).toBe('off');
    expect(billingMode({ ...base })).toBe('off');
  });

  it('maps each plan to one lookup key and back', () => {
    for (const plan of PAID_PLANS) {
      expect(planForStripeLookupKey(stripeLookupKey(plan.key))).toBe(plan);
    }
    expect(stripeLookupKey('trial')).toBe('ours_plan_trial_monthly');
    expect(planForStripeLookupKey('ours_plan_trial_monthly')).toBeUndefined();
    expect(planForStripeLookupKey(null)).toBeUndefined();
  });
});

describe('StripePaymentProvider', () => {
  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://app.example.test/';
  });
  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  it('sends a first plan to Checkout, tagged with the organisation', async () => {
    const { stripe, calls } = fakeStripe();
    const result = await new StripePaymentProvider(stripe).changePlan('org-1', growth, {
      paymentProvider: 'none',
      externalId: null,
    });
    expect(result).toEqual({ status: 'redirect', url: 'https://checkout.stripe.test/c' });
    expect(calls.prices).toHaveBeenCalledWith({ lookup_keys: ['ours_plan_growth_monthly'], active: true, limit: 1 });
    const params = calls.checkout.mock.calls[0][0];
    expect(params).toMatchObject({
      mode: 'subscription',
      line_items: [{ price: 'price_growth', quantity: 1 }],
      client_reference_id: 'org-1',
      subscription_data: { metadata: { organizationId: 'org-1', plan: 'growth' } },
      locale: 'en-GB',
      success_url: 'https://app.example.test/plan?checkout=success',
      cancel_url: 'https://app.example.test/plan?checkout=cancelled',
    });
    expect(params.customer).toBeUndefined();
  });

  it('refuses when Stripe’s price doesn’t match the price we show', async () => {
    for (const wrong of [
      [],
      [price(growth, { unit_amount: 15900 })],
      [price(growth, { currency: 'usd' })],
      [price(growth, { recurring: { interval: 'year' } as Stripe.Price.Recurring })],
    ]) {
      const { stripe, calls } = fakeStripe({ prices: wrong as Stripe.Price[] });
      const error = await new StripePaymentProvider(stripe).changePlan('org-1', growth, null).catch((e) => e);
      expect(error.getStatus()).toBe(502);
      expect(error.message).toContain('couldn’t open the payment page');
      expect(calls.checkout).not.toHaveBeenCalled();
    }
  });

  it('confirms a switch on Stripe’s portal when already paying', async () => {
    const { stripe, calls } = fakeStripe({ prices: [price(growth)], sub: subscription({}, starter) });
    const result = await new StripePaymentProvider(stripe).changePlan('org-1', growth, {
      paymentProvider: 'stripe',
      externalId: 'sub_1',
    });
    expect(result).toEqual({ status: 'redirect', url: 'https://billing.stripe.test/p' });
    expect(calls.checkout).not.toHaveBeenCalled();
    expect(calls.portal.mock.calls[0][0]).toMatchObject({
      customer: 'cus_1',
      flow_data: {
        type: 'subscription_update_confirm',
        subscription_update_confirm: { subscription: 'sub_1', items: [{ id: 'si_1', price: 'price_growth', quantity: 1 }] },
      },
    });
  });

  it('reuses the customer after a plan ended, so invoices stay together', async () => {
    const { stripe, calls } = fakeStripe({ sub: subscription({ status: 'canceled' }) });
    await new StripePaymentProvider(stripe).changePlan('org-1', growth, { paymentProvider: 'stripe', externalId: 'sub_1' });
    expect(calls.portal).not.toHaveBeenCalled();
    expect(calls.checkout.mock.calls[0][0].customer).toBe('cus_1');
  });

  it('only opens the billing page for an organisation that has paid through Stripe', async () => {
    const { stripe, calls } = fakeStripe();
    const provider = new StripePaymentProvider(stripe);
    expect(await provider.manageUrl(null)).toBeNull();
    expect(await provider.manageUrl({ paymentProvider: 'test', externalId: null })).toBeNull();
    expect(await provider.manageUrl({ paymentProvider: 'stripe', externalId: 'sub_1' })).toBe(
      'https://billing.stripe.test/p'
    );
    expect(calls.portal.mock.calls[0][0]).toMatchObject({ customer: 'cus_1', return_url: 'https://app.example.test/plan' });
  });
});

// PlanService with an in-memory plan row
const makeService = (row: Record<string, unknown> | null) => {
  let plan = row;
  const repo = {
    getPlan: vi.fn(async () => plan),
    setPlan: vi.fn(async (_org: string, key: string, paymentProvider: string, externalId?: string) => {
      plan = { plan: key, trialEndsAt: null, paymentProvider, externalId, startedAt: new Date() };
      return plan;
    }),
    endPlan: vi.fn(async (_org: string, externalId: string, endedAt: Date) => {
      if (plan?.externalId !== externalId) return false;
      plan = { ...plan, plan: 'trial', trialEndsAt: endedAt };
      return true;
    }),
    startTrial: vi.fn(),
    aiSpendUsd: vi.fn(async () => 0),
    claim: vi.fn(async () => true),
    getUsage: vi.fn(async () => ({})),
  };
  const service = new PlanService(repo as never, { getIntegrationsList: async () => [] } as never);
  return { service, repo, row: () => plan };
};

const signed = (event: Record<string, unknown>) => {
  const payload = JSON.stringify(event);
  const header = new Stripe('sk_test_x').webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { body: Buffer.from(payload), header };
};

describe('Stripe webhook', () => {
  beforeEach(() => {
    process.env.OURS_BILLING_MODE = 'stripe';
    process.env.OURS_STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.OURS_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });
  afterEach(() => {
    delete process.env.OURS_BILLING_MODE;
    delete process.env.OURS_STRIPE_SECRET_KEY;
    delete process.env.OURS_STRIPE_WEBHOOK_SECRET;
    vi.restoreAllMocks();
  });

  it('is switched off unless Stripe billing is on', async () => {
    process.env.OURS_BILLING_MODE = 'test';
    const { service } = makeService(null);
    const { body, header } = signed({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } });
    expect(await service.stripeWebhook(body, header)).toBe(404);
  });

  it('rejects events that Stripe didn’t sign, and changes nothing', async () => {
    const { service, repo } = makeService(null);
    const { body } = signed({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: subscription() } });
    expect(await service.stripeWebhook(body, 't=1,v1=forged')).toBe(400);
    expect(await service.stripeWebhook(body, undefined)).toBe(400);
    expect(await service.stripeWebhook(undefined, 'x')).toBe(400);
    expect(repo.setPlan).not.toHaveBeenCalled();
  });

  it('starts the plan when checkout completes, reading the subscription fresh', async () => {
    const lookup = vi
      .spyOn(StripePaymentProvider.prototype, 'subscriptionFor')
      .mockResolvedValue(subscription({}, growth));
    const { service, repo } = makeService({ plan: 'trial', trialEndsAt: new Date(), paymentProvider: 'none', externalId: null });
    const { body, header } = signed({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { object: 'checkout.session', subscription: 'sub_1' } },
    });
    expect(await service.stripeWebhook(body, header)).toBe(200);
    expect(lookup).toHaveBeenCalled();
    expect(repo.setPlan).toHaveBeenCalledWith('org-1', 'growth', 'stripe', 'sub_1');
  });

  it('ignores events it doesn’t need', async () => {
    const lookup = vi.spyOn(StripePaymentProvider.prototype, 'subscriptionFor');
    const { service } = makeService(null);
    const { body, header } = signed({ id: 'evt_1', type: 'customer.created', data: { object: {} } });
    expect(await service.stripeWebhook(body, header)).toBe(200);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('never throws: a failure answers 500 so Stripe sends the event again', async () => {
    vi.spyOn(StripePaymentProvider.prototype, 'subscriptionFor').mockResolvedValue(subscription());
    const { service, repo } = makeService(null);
    repo.getPlan.mockRejectedValueOnce(new Error('db down'));
    const { body, header } = signed({ id: 'evt_1', type: 'invoice.paid', data: { object: { subscription: 'sub_1' } } });
    await expect(service.stripeWebhook(body, header)).resolves.toBe(500);
  });
});

describe('syncing a Stripe subscription', () => {
  const paying = (key = 'starter', externalId = 'sub_1') => ({
    plan: key,
    trialEndsAt: null,
    paymentProvider: 'stripe',
    externalId,
    startedAt: new Date('2026-11-02'),
  });

  it('moves the plan when the subscription’s price changes', async () => {
    const { service, repo } = makeService(paying('starter'));
    await service.syncStripeSubscription(subscription({}, growth));
    expect(repo.setPlan).toHaveBeenCalledWith('org-1', 'growth', 'stripe', 'sub_1');
  });

  it('leaves a renewal alone, so the fair-use month isn’t restarted', async () => {
    const { service, repo } = makeService(paying('growth'));
    await service.syncStripeSubscription(subscription({}, growth));
    await service.syncStripeSubscription(subscription({ status: 'past_due' }, growth));
    expect(repo.setPlan).not.toHaveBeenCalled();
  });

  it('ignores subscriptions without an organisation or with a price we don’t know', async () => {
    const { service, repo } = makeService(paying('growth'));
    await service.syncStripeSubscription(subscription({ metadata: {} }));
    await service.syncStripeSubscription(
      subscription({ items: { data: [{ id: 'si_1', price: price(growth, { lookup_key: 'something_else' }) }] } })
    );
    await service.syncStripeSubscription(subscription({ status: 'incomplete' }));
    expect(repo.setPlan).not.toHaveBeenCalled();
    expect(repo.endPlan).not.toHaveBeenCalled();
  });

  it('ends the plan when the subscription ends, and says so in plain words', async () => {
    const { service, row } = makeService(paying('growth'));
    const now = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    await service.syncStripeSubscription(subscription({ status: 'canceled' }), now);
    expect(row()).toMatchObject({ plan: 'trial', trialEndsAt: now, paymentProvider: 'stripe' });
    expect(planStatus(row() as never)).toBe('ended');
    await expect(service.claim('org-1', 'postsScheduled')).rejects.toThrow(
      `Your plan ended on ${formatDay(now)}. Choose a plan on Plan and usage to keep going.`
    );
    Object.assign(process.env, {
      OURS_BILLING_MODE: 'stripe',
      OURS_STRIPE_SECRET_KEY: 'sk_test_x',
      OURS_STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    });
    const view = await service.overview('org-1', true);
    delete process.env.OURS_BILLING_MODE;
    delete process.env.OURS_STRIPE_SECRET_KEY;
    delete process.env.OURS_STRIPE_WEBHOOK_SECRET;
    expect(view.plan).toMatchObject({ status: 'ended', name: 'No plan' });
    expect(view.billing).toMatchObject({ mode: 'stripe', canChange: true, canManage: true, testPayments: true });
  });

  it('doesn’t let a late event about an older subscription end a newer one', async () => {
    const { service, repo } = makeService(paying('growth', 'sub_new'));
    await service.syncStripeSubscription(subscription({ id: 'sub_old', status: 'canceled' }));
    expect(repo.endPlan).toHaveBeenCalledWith('org-1', 'sub_old', expect.any(Date));
    expect(repo.setPlan).not.toHaveBeenCalled();
    expect((await service.current('org-1')).status).toBe('active');
  });

  it('keeps an unpaid trial on the free-trial wording', () => {
    const ended = new Date('2026-11-01');
    expect(planStatus({ plan: 'trial', trialEndsAt: ended, paymentProvider: 'none' }, new Date())).toBe('trial-ended');
  });
});
