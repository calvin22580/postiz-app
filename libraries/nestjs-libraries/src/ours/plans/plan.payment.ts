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

export interface PlanPaymentProvider {
  // stored on the plan row as paymentProvider
  name: string;
  changePlan(orgId: string, plan: PlanDefinition, current: CurrentBilling | null): Promise<PlanChangeResult>;
  // a page where the owner manages payment details, invoices and cancelling;
  // null when there's nothing to manage yet
  manageUrl?(current: CurrentBilling | null): Promise<string | null>;
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
