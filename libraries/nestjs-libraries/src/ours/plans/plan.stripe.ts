// OURS: paying for a plan with Stripe (payments milestone). Only used when
// OURS_BILLING_MODE=stripe and a usable key is set (see billingMode in
// plans.config.ts: a live key also needs OURS_STRIPE_ALLOW_LIVE=true).
//
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
  pricingDisplay,
  stripeLookupKey,
} from '@gitroom/nestjs-libraries/ours/plans/plans.config';
import type {
  CurrentBilling,
  PlanChangeResult,
  PlanPaymentProvider,
} from '@gitroom/nestjs-libraries/ours/plans/plan.payment';

const CHECKOUT_FAILED = 'We couldn’t open the payment page. Please try again, or get in touch and we’ll sort it out.';

// subscriptions that still give the owner their plan
export const LIVE_SUBSCRIPTION_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
// subscriptions that are over: the plan ends
export const ENDED_SUBSCRIPTION_STATUSES: Stripe.Subscription.Status[] = ['canceled', 'unpaid', 'incomplete_expired'];

const appUrl = (path: string) => `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}${path}`;

export const stripeClient = () => new Stripe((process.env.OURS_STRIPE_SECRET_KEY || '').trim());

export class StripePaymentProvider implements PlanPaymentProvider {
  name = 'stripe';
  private _logger = new Logger(StripePaymentProvider.name);

  constructor(private _stripe: Stripe = stripeClient()) {}

  async changePlan(orgId: string, plan: PlanDefinition, current: CurrentBilling | null): Promise<PlanChangeResult> {
    const price = await this.priceFor(plan);
    const subscription = await this.liveSubscription(current);
    try {
      if (subscription) {
        // already paying: confirm the switch on Stripe's portal, which shows
        // the prorated amount before anything is charged
        const session = await this._stripe.billingPortal.sessions.create({
          customer: customerId(subscription),
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
      const session = await this._stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: price.id, quantity: 1 }],
        client_reference_id: orgId,
        metadata,
        subscription_data: { metadata },
        // an ended subscription keeps its customer, so invoices stay together
        ...(current?.paymentProvider === this.name && current.externalId
          ? { customer: await this.customerOf(current.externalId) }
          : {}),
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

  async manageUrl(current: CurrentBilling | null) {
    if (current?.paymentProvider !== this.name || !current.externalId) {
      return null;
    }
    try {
      const session = await this._stripe.billingPortal.sessions.create({
        customer: await this.customerOf(current.externalId),
        return_url: appUrl('/plan'),
        ...portalConfiguration(),
      });
      return session.url;
    } catch (e) {
      this._logger.error(`Stripe portal failed for ${current.externalId}: ${(e as Error).message}`);
      throw new HttpException('We couldn’t open your billing page. Please try again.', 502);
    }
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
  // arriving out of order still end in the right state. null when the event
  // isn't about a subscription.
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

  private async liveSubscription(current: CurrentBilling | null) {
    if (current?.paymentProvider !== this.name || !current.externalId) {
      return null;
    }
    try {
      const subscription = await this._stripe.subscriptions.retrieve(current.externalId);
      return LIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) ? subscription : null;
    } catch (e) {
      this._logger.error(`Stripe subscription ${current.externalId} lookup failed: ${(e as Error).message}`);
      throw new HttpException(CHECKOUT_FAILED, 502);
    }
  }

  private async customerOf(subscriptionId: string) {
    return customerId(await this._stripe.subscriptions.retrieve(subscriptionId));
  }
}

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
