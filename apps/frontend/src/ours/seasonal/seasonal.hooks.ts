'use client';
// OURS: data for the UK dates panel (Milestone 6).
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface UkDate {
  id: string;
  key: string;
  name: string;
  // a calendar date, YYYY-MM-DD
  date: string;
  kind: 'occasion' | 'shopping' | 'national-day' | 'bank-holiday';
  about: string;
  bankHoliday: boolean;
  // false for quiet days (Good Friday, for example): listed, never suggested
  usedInPosts: boolean;
  skipped: boolean;
  sources: { name: string; url: string }[];
}

export interface UkDatesOverview {
  nation: string;
  enabled: boolean;
  // false until the owner has picked anything
  chosen: boolean;
  nations: { key: string; label: string }[];
  // the nation assumed until the owner picks one
  defaultNation: string;
  // how many days ahead "upcoming" looks
  upcomingDays: number;
  checkedOn: string;
  coversUntil: string;
  upcoming: UkDate[];
}

export const useUkDates = () => {
  const fetch = useFetch();
  return useSWR<UkDatesOverview>(
    'ours-uk-dates',
    async () => {
      const res = await fetch('/ours/seasonal');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};
