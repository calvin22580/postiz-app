// OURS: the seam where a payment provider plugs in (Milestone 7). Stripe is
// in plan.stripe.ts, under our own env names (OURS_STRIPE_*), never
// upstream's STRIPE_* names, which switch on upstream's billing screens and
// limits.
import type { BillingMode, PlanDefinition } from '@gitroom/nestjs-libraries/ours/plans/plans.config';
import { StripePaymentProvider } from '@gitroom/nestjs-libraries/ours/plans/plan.stripe';

export type PlanChangeResult =
  // the plan applies straight away
  | { status: 'changed' }
  // send the owner to a checkout page; the plan changes when payment succeeds
  | { status: 'redirect'; url: string };

// what we already know about the organisation's billing (ours_plan_subscription)
export interface CurrentBilling {
  paymentProvider: string;
  externalId: string | null;
}

// What a provider's webhook means for our plan row, worked out by the
// provider so PlanService needs no provider-specific code.
export type BillingUpdate =
  | { state: 'ignore' }
  // paid up: the organisation is on planKey
  // billingAnchor: when the subscription's billing month starts
  | { state: 'live'; orgId: string; externalId: string; planKey: string; billingAnchor?: Date }
  // over: new work stops until the owner picks a plan again
  | { state: 'ended'; orgId: string; externalId: string; endedAt: Date };

export interface PlanPaymentProvider {
  // stored on the plan row as paymentProvider
  name: string;
  // email: the signed-in admin's, for the provider's customer and receipts
  changePlan(
    orgId: string,
    plan: PlanDefinition,
    current: CurrentBilling | null,
    email?: string
  ): Promise<PlanChangeResult>;
  // a page where the owner manages payment details, invoices and cancelling;
  // null when there's nothing to manage yet
  manageUrl?(orgId: string, current: CurrentBilling | null): Promise<string | null>;
  // checks a webhook came from the provider (null when it didn't) and says
  // what it means for the plan
  readWebhook?(rawBody: Buffer | undefined, signature: string | undefined): Promise<BillingUpdate | null>;
  // payments in the provider's test mode: no real money moves
  isTest?(): boolean;
}

// Test mode: the plan changes at once and no payment is taken. The plan
// screen says so.
export class TestModePaymentProvider implements PlanPaymentProvider {
  name = 'test';
  async changePlan(): Promise<PlanChangeResult> {
    return { status: 'changed' };
  }
}

// null: the app can't change plans ("off" mode)
export const paymentProviderFor = (mode: BillingMode): PlanPaymentProvider | null => {
  if (mode === 'test') {
    return new TestModePaymentProvider();
  }
  if (mode === 'stripe') {
    return new StripePaymentProvider();
  }
  return null;
};
