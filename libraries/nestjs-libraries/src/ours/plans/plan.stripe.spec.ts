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
import { billingUpdateFor, StripePaymentProvider } from '@gitroom/nestjs-libraries/ours/plans/plan.stripe';
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
const fakeStripe = (
  opts: {
    prices?: Stripe.Price[];
    sub?: Stripe.Subscription | 'missing';
    customers?: { id: string; email?: string | null }[];
    subs?: Stripe.Subscription[];
  } = {}
) => {
  const calls = {
    checkout: vi.fn(async (_p: Stripe.Checkout.SessionCreateParams) => ({ url: 'https://checkout.stripe.test/c' })),
    portal: vi.fn(async (_p: Stripe.BillingPortal.SessionCreateParams) => ({ url: 'https://billing.stripe.test/p' })),
    prices: vi.fn(async (_p: Stripe.PriceListParams) => ({ data: opts.prices ?? [price()] })),
    retrieve: vi.fn(async (_id: string) => {
      if (opts.sub === 'missing') throw Object.assign(new Error('No such subscription'), { code: 'resource_missing' });
      return opts.sub ?? subscription();
    }),
    list: vi.fn(async (_p: Stripe.SubscriptionListParams) => ({ data: opts.subs ?? [] })),
    search: vi.fn(async (_p: Stripe.CustomerSearchParams) => ({ data: opts.customers ?? [] })),
    createCustomer: vi.fn(async (_p: Stripe.CustomerCreateParams) => ({ id: 'cus_new' })),
    updateCustomer: vi.fn(async (id: string, _p: Stripe.CustomerUpdateParams) => ({ id })),
  };
  const stripe = {
    checkout: { sessions: { create: calls.checkout } },
    billingPortal: { sessions: { create: calls.portal } },
    prices: { list: calls.prices },
    subscriptions: { retrieve: calls.retrieve, list: calls.list },
    customers: { search: calls.search, create: calls.createCustomer, update: calls.updateCustomer },
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
    delete process.env.OURS_VAT_REGISTERED;
  });

  it('sends a first plan to Checkout, with one customer tagged with the organisation', async () => {
    const { stripe, calls } = fakeStripe();
    const result = await new StripePaymentProvider(stripe).changePlan('org-1', growth, {
      paymentProvider: 'none',
      externalId: null,
    });
    expect(result).toEqual({ status: 'redirect', url: 'https://checkout.stripe.test/c' });
    expect(calls.prices).toHaveBeenCalledWith({ lookup_keys: ['ours_plan_growth_monthly'], active: true, limit: 1 });
    expect(calls.search.mock.calls[0][0].query).toBe("metadata['organizationId']:'org-1'");
    expect(calls.createCustomer).toHaveBeenCalledWith({ metadata: { organizationId: 'org-1' } });
    const params = calls.checkout.mock.calls[0][0];
    expect(params).toMatchObject({
      mode: 'subscription',
      customer: 'cus_new',
      line_items: [{ price: 'price_growth', quantity: 1 }],
      client_reference_id: 'org-1',
      subscription_data: { metadata: { organizationId: 'org-1', plan: 'growth' } },
      locale: 'en-GB',
      success_url: 'https://app.example.test/plan?checkout=success',
      cancel_url: 'https://app.example.test/plan?checkout=cancelled',
    });
    expect(params.automatic_tax).toBeUndefined();
  });

  it('puts the signed-in admin’s email on a new customer, so receipts go to the account', async () => {
    const { stripe, calls } = fakeStripe();
    await new StripePaymentProvider(stripe).changePlan('org-1', growth, null, 'owner@bakery.test');
    expect(calls.createCustomer).toHaveBeenCalledWith({
      metadata: { organizationId: 'org-1' },
      email: 'owner@bakery.test',
    });
    expect(calls.checkout.mock.calls[0][0].customer).toBe('cus_new');
  });

  it('gives an existing customer with no email the admin’s email, and leaves one that has an email alone', async () => {
    const bare = fakeStripe({ customers: [{ id: 'cus_old', email: null }] });
    await new StripePaymentProvider(bare.stripe).changePlan('org-1', growth, null, 'owner@bakery.test');
    expect(bare.calls.updateCustomer).toHaveBeenCalledWith('cus_old', { email: 'owner@bakery.test' });
    expect(bare.calls.createCustomer).not.toHaveBeenCalled();

    const kept = fakeStripe({ customers: [{ id: 'cus_old', email: 'billing@bakery.test' }] });
    await new StripePaymentProvider(kept.stripe).changePlan('org-1', growth, null, 'owner@bakery.test');
    expect(kept.calls.updateCustomer).not.toHaveBeenCalled();
  });

  it('adds VAT at checkout when the plan cards say "+ VAT"', async () => {
    process.env.OURS_VAT_REGISTERED = 'true';
    const { stripe, calls } = fakeStripe();
    await new StripePaymentProvider(stripe).changePlan('org-1', growth, null);
    expect(calls.checkout.mock.calls[0][0].automatic_tax).toEqual({ enabled: true });
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
    const paying = subscription({}, starter);
    const { stripe, calls } = fakeStripe({ prices: [price(growth)], sub: paying, subs: [paying] });
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

  it('finds an earlier payment that isn’t on record yet, instead of charging twice', async () => {
    const paying = subscription({}, starter);
    const { stripe, calls } = fakeStripe({ customers: [{ id: 'cus_1' }], subs: [paying] });
    await new StripePaymentProvider(stripe).changePlan('org-1', growth, { paymentProvider: 'none', externalId: null });
    expect(calls.createCustomer).not.toHaveBeenCalled();
    expect(calls.checkout).not.toHaveBeenCalled();
    expect(calls.portal).toHaveBeenCalled();
  });

  it('reuses the customer after a plan ended, so invoices stay together', async () => {
    const ended = subscription({ status: 'canceled' });
    const { stripe, calls } = fakeStripe({ sub: ended, subs: [ended] });
    await new StripePaymentProvider(stripe).changePlan('org-1', growth, { paymentProvider: 'stripe', externalId: 'sub_1' });
    expect(calls.portal).not.toHaveBeenCalled();
    expect(calls.checkout.mock.calls[0][0].customer).toBe('cus_1');
  });

  it('doesn’t lock the owner out when the subscription on record no longer exists', async () => {
    const { stripe, calls } = fakeStripe({ sub: 'missing' });
    const result = await new StripePaymentProvider(stripe).changePlan('org-1', growth, {
      paymentProvider: 'stripe',
      externalId: 'sub_gone',
    });
    expect(result.status).toBe('redirect');
    expect(calls.checkout.mock.calls[0][0].customer).toBe('cus_new');
  });

  it('only opens the billing page for an organisation with a Stripe customer', async () => {
    const none = fakeStripe();
    expect(await new StripePaymentProvider(none.stripe).manageUrl('org-1', null)).toBeNull();
    expect(none.calls.createCustomer).not.toHaveBeenCalled();
    const { stripe, calls } = fakeStripe();
    expect(
      await new StripePaymentProvider(stripe).manageUrl('org-1', { paymentProvider: 'stripe', externalId: 'sub_1' })
    ).toBe('https://billing.stripe.test/p');
    expect(calls.portal.mock.calls[0][0]).toMatchObject({ customer: 'cus_1' });
  });
});

describe('what a Stripe subscription means for the plan', () => {
  it('maps live, ended, paused and pending subscriptions', () => {
    expect(billingUpdateFor(subscription({}, growth))).toEqual({
      state: 'live',
      orgId: 'org-1',
      externalId: 'sub_1',
      planKey: 'growth',
    });
    expect(billingUpdateFor(subscription({ status: 'past_due' }))).toMatchObject({ state: 'live' });
    const endedAt = Date.UTC(2026, 10, 2, 10) / 1000;
    for (const status of ['canceled', 'unpaid', 'incomplete_expired', 'paused']) {
      expect(billingUpdateFor(subscription({ status, ended_at: endedAt }))).toEqual({
        state: 'ended',
        orgId: 'org-1',
        externalId: 'sub_1',
        endedAt: new Date('2026-11-02T10:00:00Z'),
      });
    }
    expect(billingUpdateFor(subscription({ status: 'incomplete' }))).toEqual({ state: 'ignore' });
    expect(billingUpdateFor(subscription({ metadata: {} }))).toEqual({ state: 'ignore' });
    const unknown = subscription({ items: { data: [{ id: 'si_1', price: price(growth, { lookup_key: 'other' }) }] } });
    expect(billingUpdateFor(unknown)).toMatchObject({ state: 'live', planKey: 'stripe price other' });
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
      if (plan?.externalId !== externalId || plan?.plan === 'trial') return false;
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

const stripeOn = () =>
  Object.assign(process.env, {
    OURS_BILLING_MODE: 'stripe',
    OURS_STRIPE_SECRET_KEY: 'sk_test_x',
    OURS_STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  });
const stripeOff = () => {
  delete process.env.OURS_BILLING_MODE;
  delete process.env.OURS_STRIPE_SECRET_KEY;
  delete process.env.OURS_STRIPE_WEBHOOK_SECRET;
};

describe('Stripe webhook', () => {
  beforeEach(stripeOn);
  afterEach(() => {
    stripeOff();
    vi.restoreAllMocks();
  });

  it('is switched off unless Stripe billing is on', async () => {
    process.env.OURS_BILLING_MODE = 'test';
    const { service } = makeService(null);
    const { body, header } = signed({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } });
    expect(await service.paymentWebhook('stripe', body, header)).toEqual({ ok: false, retry: false });
  });

  it('rejects events that Stripe didn’t sign, and changes nothing', async () => {
    const { service, repo } = makeService(null);
    const { body } = signed({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: subscription() } });
    for (const [raw, sig] of [
      [body, 't=1,v1=forged'],
      [body, undefined],
      [undefined, 'x'],
    ] as const) {
      expect(await service.paymentWebhook('stripe', raw, sig)).toEqual({ ok: false, retry: false });
    }
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
    expect(await service.paymentWebhook('stripe', body, header)).toEqual({ ok: true, retry: false });
    expect(lookup).toHaveBeenCalled();
    // the first paid month starts now
    expect(repo.setPlan).toHaveBeenCalledWith('org-1', 'growth', 'stripe', 'sub_1', expect.any(Date));
  });

  it('ignores events it doesn’t need', async () => {
    const lookup = vi.spyOn(StripePaymentProvider.prototype, 'subscriptionFor');
    const { service } = makeService(null);
    const { body, header } = signed({ id: 'evt_1', type: 'customer.created', data: { object: {} } });
    expect(await service.paymentWebhook('stripe', body, header)).toEqual({ ok: true, retry: false });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('never throws: a failure asks Stripe to send the event again', async () => {
    vi.spyOn(StripePaymentProvider.prototype, 'subscriptionFor').mockResolvedValue(subscription());
    const { service, repo } = makeService(null);
    repo.getPlan.mockRejectedValueOnce(new Error('db down'));
    const { body, header } = signed({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: subscription() } });
    await expect(service.paymentWebhook('stripe', body, header)).resolves.toEqual({ ok: false, retry: true });
  });
});

describe('applying a billing update', () => {
  const paying = (key = 'starter', externalId = 'sub_1') => ({
    plan: key,
    trialEndsAt: null,
    paymentProvider: 'stripe',
    externalId,
    startedAt: new Date('2026-11-02'),
  });
  const apply = (service: PlanService, sub: Stripe.Subscription) => service.applyBillingUpdate('stripe', billingUpdateFor(sub));

  it('moves the plan when the subscription’s price changes, keeping the billing date', async () => {
    const { service, repo } = makeService(paying('starter'));
    await apply(service, subscription({}, growth));
    expect(repo.setPlan).toHaveBeenCalledWith('org-1', 'growth', 'stripe', 'sub_1', undefined);
  });

  it('starts a new billing month for a new subscription, on the day Stripe bills', async () => {
    const { service, repo } = makeService(paying('starter', 'sub_old'));
    // the event arrives a day late: the allowance still starts on the billing date
    const anchor = new Date('2026-11-19T15:00:00Z');
    await apply(service, subscription({ billing_cycle_anchor: anchor.getTime() / 1000 }, growth));
    expect(repo.setPlan).toHaveBeenCalledWith('org-1', 'growth', 'stripe', 'sub_1', anchor);
  });

  it('leaves a renewal alone, so the fair-use month isn’t restarted', async () => {
    const { service, repo } = makeService(paying('growth'));
    await apply(service, subscription({}, growth));
    await apply(service, subscription({ status: 'past_due' }, growth));
    expect(repo.setPlan).not.toHaveBeenCalled();
  });

  it('ignores subscriptions without an organisation, pending ones, and prices we don’t know', async () => {
    const { service, repo } = makeService(paying('growth'));
    await apply(service, subscription({ metadata: {} }));
    await apply(service, subscription({ items: { data: [{ id: 'si_1', price: price(growth, { lookup_key: 'x' }) }] } }));
    await apply(service, subscription({ status: 'incomplete' }));
    expect(repo.setPlan).not.toHaveBeenCalled();
    expect(repo.endPlan).not.toHaveBeenCalled();
  });

  it('ends the plan on the day Stripe ended it, and says so in plain words', async () => {
    const { service, row } = makeService(paying('growth'));
    const endedAt = new Date(Math.floor((Date.now() - 2 * 24 * 3600 * 1000) / 1000) * 1000);
    await apply(service, subscription({ status: 'canceled', ended_at: endedAt.getTime() / 1000 }));
    expect(row()).toMatchObject({ plan: 'trial', trialEndsAt: endedAt, paymentProvider: 'stripe' });
    expect(planStatus(row() as never)).toBe('ended');
    // the same event again doesn't move the date
    await apply(service, subscription({ status: 'canceled', ended_at: endedAt.getTime() / 1000 + 3600 }));
    expect(row()).toMatchObject({ trialEndsAt: endedAt });
    await expect(service.claim('org-1', 'postsScheduled')).rejects.toThrow(
      `Your plan ended on ${formatDay(endedAt)}. Choose a plan on Plan and usage to keep going.`
    );
    stripeOn();
    const view = await service.overview('org-1', true);
    stripeOff();
    expect(view.plan).toMatchObject({ status: 'ended', name: 'No plan' });
    expect(view.billing).toMatchObject({ mode: 'stripe', canChange: true, canManage: true, testPayments: true });
  });

  it('doesn’t let a late event about an older subscription end a newer one', async () => {
    const { service, repo } = makeService(paying('growth', 'sub_new'));
    await apply(service, subscription({ id: 'sub_old', status: 'canceled' }));
    expect(repo.endPlan).toHaveBeenCalledWith('org-1', 'sub_old', expect.any(Date));
    expect(repo.setPlan).not.toHaveBeenCalled();
    expect((await service.current('org-1')).status).toBe('active');
  });

  it('keeps an unpaid trial on the free-trial wording', () => {
    const ended = new Date('2026-11-01');
    expect(planStatus({ plan: 'trial', trialEndsAt: ended, paymentProvider: 'none' }, new Date())).toBe('trial-ended');
  });
});
