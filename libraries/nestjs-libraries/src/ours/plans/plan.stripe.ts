// OURS: paying for a plan with Stripe (payments milestone). Only used when
// OURS_BILLING_MODE=stripe and a usable key is set (see billingMode in
// plans.config.ts: a live key also needs OURS_STRIPE_ALLOW_LIVE=true).
//
// - Each organisation has one Stripe customer, tagged with its id, so a
//   second checkout finds the first one's subscription instead of paying
//   twice.
// - A first plan goes through Stripe Checkout. The plan changes when Stripe's
//   webhook says the subscription is active, never on the redirect back.
// - Moving between plans, card details, invoices and cancelling go through
//   Stripe's customer portal.
// - Prices are found by lookup key (stripeLookupKey) and must match the
//   amount and currency on our plan cards, so the owner is never charged a
//   different price from the one we show.
import { HttpException, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
  PlanDefinition,
  planForStripeLookupKey,
  pricingDisplay,
  stripeLookupKey,
  stripeTestKey,
} from '@gitroom/nestjs-libraries/ours/plans/plans.config';
import type {
  BillingUpdate,
  CurrentBilling,
  PlanChangeResult,
  PlanPaymentProvider,
} from '@gitroom/nestjs-libraries/ours/plans/plan.payment';

const CHECKOUT_FAILED = 'We couldn’t open the payment page. Please try again, or get in touch and we’ll sort it out.';

// subscriptions that still give the owner their plan
export const LIVE_SUBSCRIPTION_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
// subscriptions that are over (or paused): the plan ends. "incomplete" means
// the first payment hasn't gone through yet, so we wait.
export const ENDED_SUBSCRIPTION_STATUSES: Stripe.Subscription.Status[] = [
  'canceled',
  'unpaid',
  'incomplete_expired',
  'paused',
];

// Stripe events that can change a subscription. Each one is handled by
// reading the subscription fresh, so the order they arrive in doesn't matter.
export const STRIPE_PLAN_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

const appUrl = (path: string) => `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}${path}`;

const isMissing = (e: unknown) => (e as { code?: string })?.code === 'resource_missing';

export const stripeClient = () => new Stripe((process.env.OURS_STRIPE_SECRET_KEY || '').trim());

export class StripePaymentProvider implements PlanPaymentProvider {
  name = 'stripe';
  private _logger = new Logger(StripePaymentProvider.name);

  constructor(private _stripe: Stripe = stripeClient()) {}

  isTest() {
    return stripeTestKey();
  }

  async changePlan(
    orgId: string,
    plan: PlanDefinition,
    current: CurrentBilling | null,
    email?: string
  ): Promise<PlanChangeResult> {
    const price = await this.priceFor(plan);
    try {
      const customer = await this.customerFor(orgId, current, true, email);
      const subscription = await this.liveSubscription(customer!);
      if (subscription) {
        // already paying: confirm the switch on Stripe's portal, which shows
        // the prorated amount before anything is charged
        const session = await this._stripe.billingPortal.sessions.create({
          customer: customer!,
          return_url: appUrl('/plan?billing=updated'),
          ...portalConfiguration(),
          flow_data: {
            type: 'subscription_update_confirm',
            subscription_update_confirm: {
              subscription: subscription.id,
              items: [{ id: subscription.items.data[0].id, price: price.id, quantity: 1 }],
            },
            after_completion: { type: 'redirect', redirect: { return_url: appUrl('/plan?billing=updated') } },
          },
        });
        return { status: 'redirect', url: session.url };
      }
      const metadata = { organizationId: orgId, plan: plan.key };
      const vat = pricingDisplay().vatRegistered;
      const session = await this._stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer!,
        line_items: [{ price: price.id, quantity: 1 }],
        client_reference_id: orgId,
        metadata,
        subscription_data: { metadata },
        // VAT on top of the price, as the plan cards say (needs Stripe Tax)
        ...(vat ? { automatic_tax: { enabled: true }, customer_update: { address: 'auto' as const } } : {}),
        billing_address_collection: 'required',
        locale: checkoutLocale(),
        success_url: appUrl('/plan?checkout=success'),
        cancel_url: appUrl('/plan?checkout=cancelled'),
      });
      if (!session.url) {
        throw new Error('Checkout session has no url');
      }
      return { status: 'redirect', url: session.url };
    } catch (e) {
      this._logger.error(`Stripe checkout failed for org=${orgId}: ${(e as Error).message}`);
      throw new HttpException(CHECKOUT_FAILED, 502);
    }
  }

  async manageUrl(orgId: string, current: CurrentBilling | null) {
    try {
      const customer = await this.customerFor(orgId, current, false);
      if (!customer) {
        return null;
      }
      const session = await this._stripe.billingPortal.sessions.create({
        customer,
        return_url: appUrl('/plan?billing=updated'),
        ...portalConfiguration(),
      });
      return session.url;
    } catch (e) {
      this._logger.error(`Stripe portal failed for org=${orgId}: ${(e as Error).message}`);
      throw new HttpException('We couldn’t open your billing page. Please try again.', 502);
    }
  }

  async readWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<BillingUpdate | null> {
    const event = this.parseWebhook(rawBody, signature);
    if (!event) {
      return null;
    }
    if (!STRIPE_PLAN_EVENTS.includes(event.type)) {
      return { state: 'ignore' };
    }
    const subscription = await this.subscriptionFor(event);
    return subscription ? billingUpdateFor(subscription) : { state: 'ignore' };
  }

  // Checks a webhook really came from Stripe. Returns null when it didn't.
  parseWebhook(rawBody: Buffer | undefined, signature: string | undefined): Stripe.Event | null {
    if (!rawBody || !signature) {
      return null;
    }
    try {
      return this._stripe.webhooks.constructEvent(
        rawBody,
        signature,
        (process.env.OURS_STRIPE_WEBHOOK_SECRET || '').trim()
      );
    } catch (e) {
      this._logger.warn(`Stripe webhook signature rejected: ${(e as Error).message}`);
      return null;
    }
  }

  // The subscription an event is about, read fresh from Stripe so events
  // arriving out of order still end in the right state.
  async subscriptionFor(event: Stripe.Event): Promise<Stripe.Subscription | null> {
    const object = event.data.object as { object?: string; id?: string; subscription?: unknown };
    const id =
      object.object === 'subscription'
        ? object.id
        : typeof object.subscription === 'string'
          ? object.subscription
          : (object.subscription as { id?: string } | null)?.id;
    if (!id) {
      return null;
    }
    return this._stripe.subscriptions.retrieve(id);
  }

  private async priceFor(plan: PlanDefinition) {
    const lookupKey = stripeLookupKey(plan.key);
    let price: Stripe.Price | undefined;
    try {
      price = (await this._stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })).data[0];
    } catch (e) {
      this._logger.error(`Stripe price lookup failed for ${lookupKey}: ${(e as Error).message}`);
      throw new HttpException(CHECKOUT_FAILED, 502);
    }
    const currency = pricingDisplay().currency.toLowerCase();
    if (
      !price ||
      price.unit_amount !== plan.monthlyPence ||
      price.currency !== currency ||
      price.recurring?.interval !== 'month'
    ) {
      this._logger.error(
        `Stripe price ${lookupKey} is missing or doesn't match the plan (${plan.monthlyPence} ${currency} a month)`
      );
      throw new HttpException(CHECKOUT_FAILED, 502);
    }
    return price;
  }

  // The organisation's Stripe customer: from the subscription on record,
  // else found by its organisation tag, else (create=true) a new one. A
  // subscription id that no longer exists (test data reset, or test ids left
  // after moving to live keys) is treated as none.
  private async customerFor(orgId: string, current: CurrentBilling | null, create: boolean, email?: string) {
    if (current?.paymentProvider === this.name && current.externalId) {
      try {
        return customerId(await this._stripe.subscriptions.retrieve(current.externalId));
      } catch (e) {
        if (!isMissing(e)) {
          throw e;
        }
        this._logger.warn(`Stripe subscription ${current.externalId} for org=${orgId} no longer exists`);
      }
    }
    const found = await this._stripe.customers.search({
      query: `metadata['organizationId']:'${orgId.replace(/'/g, '')}'`,
      limit: 1,
    });
    if (found.data[0]) {
      // a customer made before we passed the email: give it one now, so
      // Checkout doesn't ask for (and send receipts to) a typed-in address
      if (email && !found.data[0].email) {
        await this._stripe.customers.update(found.data[0].id, { email });
      }
      return found.data[0].id;
    }
    if (!create) {
      return null;
    }
    return (
      await this._stripe.customers.create({ metadata: { organizationId: orgId }, ...(email ? { email } : {}) })
    ).id;
  }

  private async liveSubscription(customer: string) {
    const { data } = await this._stripe.subscriptions.list({ customer, status: 'all', limit: 10 });
    return data.find((s) => LIVE_SUBSCRIPTION_STATUSES.includes(s.status)) || null;
  }
}

// What a subscription means for our plan row
export const billingUpdateFor = (subscription: Stripe.Subscription, now: Date = new Date()): BillingUpdate => {
  const orgId = subscription.metadata?.organizationId;
  if (!orgId) {
    return { state: 'ignore' };
  }
  if (LIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
    const lookupKey = subscription.items.data[0]?.price?.lookup_key;
    return {
      state: 'live',
      orgId,
      externalId: subscription.id,
      // an unknown price comes through as is, so it's logged as an error
      planKey: planForStripeLookupKey(lookupKey)?.key || `stripe price ${lookupKey || 'without lookup key'}`,
      // the allowance resets on the day Stripe bills, even if this event
      // arrived late
      ...(subscription.billing_cycle_anchor ? { billingAnchor: new Date(subscription.billing_cycle_anchor * 1000) } : {}),
    };
  }
  if (ENDED_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
    const endedAt = subscription.ended_at || subscription.canceled_at;
    return { state: 'ended', orgId, externalId: subscription.id, endedAt: endedAt ? new Date(endedAt * 1000) : now };
  }
  return { state: 'ignore' };
};

const customerId = (subscription: Stripe.Subscription) =>
  typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

// optional: a portal set up for our plans (ours/README.md); Stripe's default
// portal settings are used otherwise
const portalConfiguration = () =>
  process.env.OURS_STRIPE_PORTAL_CONFIGURATION ? { configuration: process.env.OURS_STRIPE_PORTAL_CONFIGURATION } : {};

// Checkout's language follows our locale setting (en-GB by default)
const checkoutLocale = (): Stripe.Checkout.SessionCreateParams.Locale => {
  const locale = pricingDisplay().locale;
  return (locale === 'en-GB' ? 'en-GB' : 'auto') as Stripe.Checkout.SessionCreateParams.Locale;
};
