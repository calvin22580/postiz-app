'use client';
// OURS: data for the plan and usage screen (Milestone 7).
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

// blogPosts: only sent while blog posts are switched on (B1)
export type MetricKey = 'captionWeeks' | 'postsScheduled' | 'rewrites' | 'profileBuilds' | 'blogPosts';

export interface PlanCard {
  key: string;
  name: string;
  summary: string;
  // per month in pence, before VAT; null for the free trial
  monthlyPence: number | null;
  limits: Partial<Record<MetricKey, number>> & Record<'channels', number>;
}

export interface PlanOverview {
  plan: Omit<PlanCard, 'limits'> & {
    status: 'trial' | 'trial-ended' | 'ended' | 'active';
    // calendar date, YYYY-MM-DD
    trialEndsAt: string | null;
  };
  // calendar dates; resetsOn is null during the trial (it doesn't reset)
  period: { start: string; resetsOn: string | null };
  usage: { key: MetricKey; title: string; used: number; limit: number }[];
  channels: { used: number; limit: number };
  fairUseReached: boolean;
  plans: PlanCard[];
  metrics: { key: MetricKey; title: string }[];
  pricing: { currency: string; locale: string; vatRegistered: boolean; vatRate: number };
  billing: {
    mode: 'test' | 'stripe' | 'off';
    canChange: boolean;
    // card details, invoices and cancelling on Stripe's billing page
    canManage: boolean;
    // Stripe test keys: no real money moves, and the screen says so
    testPayments: boolean;
  };
  // set when changing plan means paying first (Stripe Checkout or portal)
  redirect?: string;
}

// refreshInterval: keep checking, e.g. just back from paying, while Stripe
// tells us the payment went through
export const usePlanOverview = (
  refreshInterval: number | ((latest?: PlanOverview) => number) = 0
) => {
  const fetch = useFetch();
  return useSWR<PlanOverview>(
    'ours-plan',
    async () => {
      const res = await fetch('/ours/plan');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false, refreshInterval }
  );
};
