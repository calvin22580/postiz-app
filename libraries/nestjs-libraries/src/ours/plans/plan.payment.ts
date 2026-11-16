// OURS: the seam where a payment provider plugs in (Milestone 7). Nothing
// here takes money. To add Stripe later: implement PlanPaymentProvider with
// our own env names (OURS_STRIPE_SECRET_KEY, not upstream's STRIPE_* names,
// which switch on upstream's billing screens and limits), return a Checkout
// URL as { status: 'redirect' }, and set the plan from a webhook of our own.
import type { BillingMode, PlanDefinition } from '@gitroom/nestjs-libraries/ours/plans/plans.config';

export type PlanChangeResult =
  // the plan applies straight away
  | { status: 'changed' }
  // send the owner to a checkout page; the plan changes when payment succeeds
  | { status: 'redirect'; url: string };

export interface PlanPaymentProvider {
  // stored on the plan row as paymentProvider
  name: string;
  changePlan(orgId: string, plan: PlanDefinition): Promise<PlanChangeResult>;
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
export const paymentProviderFor = (mode: BillingMode): PlanPaymentProvider | null =>
  mode === 'test' ? new TestModePaymentProvider() : null;
