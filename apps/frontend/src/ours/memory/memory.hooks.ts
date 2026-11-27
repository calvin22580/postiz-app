'use client';
// OURS: data for the "What we've learned" screen (content engine E5).
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface LessonExample {
  kind: 'edited' | 'approved' | 'rejected' | 'reject-reason' | 'rewrite' | 'restored';
  platform: string | null;
  theme: string | null;
  before: string | null;
  after: string | null;
  reason: string | null;
  note: string | null;
  createdAt: string;
}

export interface LearnedLesson {
  id: string;
  lesson: string;
  folder: 'voice' | 'phrases' | 'likes' | 'topics' | 'avoid';
  status: 'active' | 'tentative';
  source: 'keeper' | 'owner';
  examples: LessonExample[];
  changedAt: string;
  offAt?: string;
}

export interface BrandMemoryOverview {
  on: boolean;
  lastRun: { createdAt: string; status: 'ok' | 'failed' } | null;
  lessons: LearnedLesson[];
  switchedOff: LearnedLesson[];
}

export const useBrandMemory = () => {
  const fetch = useFetch();
  return useSWR<BrandMemoryOverview>(
    'ours-brand-memory',
    async () => {
      const res = await fetch('/ours/brand-memory');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};
