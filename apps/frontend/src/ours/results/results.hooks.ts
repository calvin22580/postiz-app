'use client';
// OURS: data for the "What worked" screen (Milestone 8).
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type Verdict = 'better' | 'worse' | 'no-difference' | 'too-few';

export interface ResultGroup {
  key: string;
  label: string;
  posts: number;
  ratio: number | null;
  verdict: Verdict;
}

export interface PostResults {
  source: 'real' | 'simulated' | null;
  timezone: string;
  approvedPosts: number;
  measuredPosts: number;
  simulatedLeftOut: number;
  minPosts: number;
  minGroupPosts: number;
  enough: boolean;
  dimensions: { key: 'kind' | 'day' | 'layout'; title: string; groups: ResultGroup[] }[];
  platforms: {
    key: string;
    label: string;
    posts: number;
    typicalInteractions: number;
    typicalReach: number | null;
  }[];
  preferences: {
    favour: { key: string; label: string }[];
    avoid: { key: string; label: string }[];
    simulated: boolean;
    basedOn: number;
    applied: boolean;
  } | null;
  recent: {
    draftId: string;
    scheduledFor: string;
    platform: string;
    theme: string;
    kind: string;
    reach: number | null;
    interactions: number;
    simulated: boolean;
  }[];
}

export const usePostResults = () => {
  const fetch = useFetch();
  return useSWR<PostResults>(
    'ours-performance',
    async () => {
      const res = await fetch('/ours/performance');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};

// "a, b and c"
export const listOf = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '';
