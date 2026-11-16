'use client';
// OURS: data for the plan and usage screen (Milestone 7).
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type MetricKey = 'captionWeeks' | 'postsScheduled' | 'rewrites' | 'profileBuilds';

export interface PlanCard {
  key: string;
  name: string;
  summary: string;
  // per month in pence, before VAT; null for the free trial
  monthlyPence: number | null;
  limits: Record<MetricKey | 'channels', number>;
}

export interface PlanOverview {
  plan: Omit<PlanCard, 'limits'> & {
    status: 'trial' | 'trial-ended' | 'active';
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
  billing: { mode: 'test' | 'off'; canChange: boolean };
}

export const usePlanOverview = () => {
  const fetch = useFetch();
  return useSWR<PlanOverview>(
    'ours-plan',
    async () => {
      const res = await fetch('/ours/plan');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};
