'use client';
// OURS: data for the weekly captions screen.
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type CaptionWeekStatus = 'WRITING' | 'READY' | 'FAILED';

export interface Caption {
  id: string;
  platform: 'facebook' | 'instagram' | 'linkedin';
  scheduledFor: string;
  theme: string;
  text: string;
  facts: { field: string; value: string }[];
  status: 'PENDING_APPROVAL' | 'APPROVED';
  channelId: string | null;
  postId: string | null;
  approvedAt: string | null;
}

export interface CaptionWeek {
  id: string;
  weekStart: string;
  timezone: string;
  status: CaptionWeekStatus;
  errorMessage: string | null;
  demo: boolean;
  droppedCount: number;
  captions: Caption[];
}

export interface CaptionWeekResponse {
  week: CaptionWeek | null;
  nextWeekStart: string;
}

export const useCaptionWeek = () => {
  const fetch = useFetch();
  return useSWR<CaptionWeekResponse>(
    'ours-caption-week',
    async () => {
      const res = await fetch('/ours/captions');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    {
      refreshInterval: (data) => (data?.week?.status === 'WRITING' ? 1500 : 0),
      revalidateOnFocus: false,
    }
  );
};

export const useCaptionChannels = () => {
  const fetch = useFetch();
  return useSWR<{ sandboxEnabled: boolean; channels: { id: string; name: string }[] }>(
    'ours-caption-channels',
    async () => {
      const res = await fetch('/ours/captions/channels');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};
