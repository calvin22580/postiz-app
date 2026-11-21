// OURS: our plans (Milestone 7). Prices and allowances live here, in code,
// beside upstream's pricing.ts (USD, Stripe-only, left untouched).
//
// PLACEHOLDERS: every price and limit below is a first guess for testing, not
// a decision. Calvin tunes them here; nothing else needs to change.
//
// Allowances reset each month on the customer's billing date: the day their
// paid plan started (plan.service.ts usagePeriod).

// What we count each month. Labels are written to finish the sentence
// "You've used all 5 …" and to sit under a meter on the plan screen.
export const METRICS = [
  {
    key: 'captionWeeks',
    label: 'weeks of posts written',
    title: 'Weeks of posts written',
  },
  {
    key: 'postsScheduled',
    label: 'scheduled posts',
    title: 'Posts scheduled',
  },
  {
    key: 'rewrites',
    label: 'new versions of a post',
    title: 'New versions of a post',
  },
  {
    key: 'profileBuilds',
    label: 'website reads',
    title: 'Website reads for your profile',
  },
] as const;

export type MeteredKey = (typeof METRICS)[number]['key'];

// metrics that make an AI call, so they also count towards the fair-use cap
export const AI_METRICS: MeteredKey[] = ['captionWeeks', 'rewrites', 'profileBuilds'];

export interface PlanLimits extends Record<MeteredKey, number> {
  // connected channels at any one time (not monthly)
  channels: number;
  // platforms a week of posts is written for (Facebook, Instagram, LinkedIn)
  platforms: number;
  // fair-use safety net: AI cost in USD per month (ours_ai_usage.costUsd).
  // Never shown to the owner as an amount.
  aiSpendUsd: number;
}

export interface PlanDefinition {
  key: string;
  name: string;
  // one plain line for the plan card
  summary: string;
  // price per month in pence, before VAT (null for the trial)
  monthlyPence: number | null;
  limits: PlanLimits;
}

export const TRIAL_PLAN_KEY = 'trial';

// Paid plans, cheapest first. A posting week is 5 weekdays, one post per
// platform each day, so one platform is about 22 posts a month.
export const PAID_PLANS: PlanDefinition[] = [
  {
    key: 'starter',
    name: 'Starter',
    summary: 'A post every weekday on one platform.',
    monthlyPence: 7900, // PLACEHOLDER price
    limits: {
      // PLACEHOLDER limits
      captionWeeks: 5,
      postsScheduled: 25,
      rewrites: 20,
      // the same as the trial, so starting to pay never takes anything away
      profileBuilds: 3,
      channels: 2,
      platforms: 1,
      aiSpendUsd: 8,
    },
  },
  {
    key: 'growth',
    name: 'Growth',
    summary: 'A post every weekday on two platforms.',
    monthlyPence: 14900, // PLACEHOLDER price
    limits: {
      // PLACEHOLDER limits
      captionWeeks: 5,
      postsScheduled: 50,
      rewrites: 60,
      profileBuilds: 4,
      channels: 4,
      platforms: 2,
      aiSpendUsd: 15,
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    summary: 'A post every weekday on all three platforms, with room to spare.',
    monthlyPence: 29900, // PLACEHOLDER price
    limits: {
      // PLACEHOLDER limits
      captionWeeks: 5,
      postsScheduled: 100,
      rewrites: 150,
      profileBuilds: 10,
      channels: 8,
      platforms: 3,
      aiSpendUsd: 30,
    },
  },
];

// New organisations start here. Enough to see one full week on every
// platform.
export const TRIAL_PLAN: PlanDefinition = {
  key: TRIAL_PLAN_KEY,
  name: 'Free trial',
  summary: 'One full week of posts on every platform, free.',
  monthlyPence: null,
  limits: {
    // PLACEHOLDER limits
    captionWeeks: 2,
    postsScheduled: 15,
    rewrites: 15,
    profileBuilds: 3,
    channels: 3,
    platforms: 3,
    aiSpendUsd: 3,
  },
};

const intFromEnv = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value || '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const trialDays = (env: NodeJS.ProcessEnv = process.env) =>
  intFromEnv(env.OURS_TRIAL_DAYS, 14); // PLACEHOLDER length

export const findPlan = (key: string | null | undefined) =>
  key === TRIAL_PLAN_KEY ? TRIAL_PLAN : PAID_PLANS.find((p) => p.key === key);

// How prices are shown. Steady Lamp Ltd may not be VAT registered yet, so VAT
// is only added when OURS_VAT_REGISTERED=true.
export const pricingDisplay = (env: NodeJS.ProcessEnv = process.env) => {
  const rate = Number.parseFloat(env.OURS_VAT_RATE || '');
  return {
    currency: (env.OURS_CURRENCY || 'GBP').trim().toUpperCase(),
    locale: (env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en-GB').trim() || 'en-GB',
    vatRegistered: env.OURS_VAT_REGISTERED === 'true',
    vatRate: Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : 0.2,
  };
};

// "test": the owner can switch plans in the app and no payment is taken (for
// trying the product, labelled on screen). "stripe": the owner pays through
// Stripe Checkout and the plan changes when Stripe tells us the payment went
// through (plan.stripe.ts). "off" (the default): plans and usage are shown,
// and changing plan means getting in touch.
export type BillingMode = 'test' | 'stripe' | 'off';

// A live Stripe key takes real money, so it only counts when
// OURS_STRIPE_ALLOW_LIVE=true says so on purpose. Anything else falls back to
// "off", never to taking payments by accident.
export const stripeTestKey = (env: NodeJS.ProcessEnv = process.env) => {
  const key = (env.OURS_STRIPE_SECRET_KEY || '').trim();
  return key.startsWith('sk_test_') || key.startsWith('rk_test_');
};

export const stripeKeyUsable = (env: NodeJS.ProcessEnv = process.env) => {
  const key = (env.OURS_STRIPE_SECRET_KEY || '').trim();
  if (stripeTestKey(env)) {
    return true;
  }
  return (key.startsWith('sk_live_') || key.startsWith('rk_live_')) && env.OURS_STRIPE_ALLOW_LIVE === 'true';
};

export const billingMode = (env: NodeJS.ProcessEnv = process.env): BillingMode => {
  if (env.OURS_BILLING_MODE === 'test') {
    return 'test';
  }
  if (env.OURS_BILLING_MODE === 'stripe' && stripeKeyUsable(env) && !!env.OURS_STRIPE_WEBHOOK_SECRET) {
    return 'stripe';
  }
  return 'off';
};

// The Stripe price for a plan is found by this lookup key, so price ids never
// need copying into settings. ours/README.md has the setup.
export const stripeLookupKey = (planKey: string) => `ours_plan_${planKey}_monthly`;

export const planForStripeLookupKey = (lookupKey: string | null | undefined) =>
  PAID_PLANS.find((p) => stripeLookupKey(p.key) === lookupKey);
