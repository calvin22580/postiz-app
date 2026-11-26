'use client';
// OURS: data for "How people find you" (D1): the searches that matter.
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface TrackedSearch {
  id: string;
  keyword: string;
  // "local" names the town or says "near me"; "topic" is wider
  kind: 'local' | 'topic';
  origin: 'suggested' | 'owner';
  // average monthly searches; null = too few to measure, or not checked
  searchVolume: number | null;
  simulated: boolean;
}

export type SearchOverview =
  | { enabled: false }
  | {
      enabled: true;
      simulated: boolean;
      // finishes "searches a month in …"
      market: string;
      profile: { ready: boolean; town: string; services: number };
      limit: number;
      limitMessage: string;
      tracked: TrackedSearch[];
      suggestions: TrackedSearch[];
      // when fresh suggestions can be asked for again (ISO), if not now
      nextSuggestAt: string | null;
    };

export const useSearchOverview = () => {
  const fetch = useFetch();
  return useSWR<SearchOverview>(
    'ours-search',
    async () => {
      const res = await fetch('/ours/search');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};
