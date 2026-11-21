'use client';
// OURS: data for the weekly captions screen.
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type CaptionWeekStatus = 'WRITING' | 'READY' | 'FAILED';
export type CaptionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface Caption {
  id: string;
  platform: 'facebook' | 'instagram' | 'linkedin';
  scheduledFor: string;
  theme: string;
  text: string;
  // a fact with the field "seasonal" is a UK date, with where it was checked
  facts: { field: string; value: string; label?: string; source?: { name: string; url: string } }[];
  status: CaptionStatus;
  channelId: string | null;
  postId: string | null;
  approvedAt: string | null;
  // set when the owner rewrote the text themselves
  editedAt: string | null;
  rejectedAt: string | null;
  // why the owner rejected it, if they said (a REJECT_REASONS key)
  rejectReason: string | null;
  // AI rewrites still allowed for this caption
  rewritesLeft: number;
  // the platform's character limit
  maxLength: number;
  // details in the owner's own wording that the profile doesn't have
  notInProfile: string[];
  graphic: {
    // what the owner chose: automatic, a layout, or no graphic
    choice: string;
    // the layout drawn, or null for no graphic
    layout: string | null;
    size: { width: number; height: number } | null;
    // the image attached to the scheduled post, once approved
    path: string | null;
    profileVersion: number | null;
  };
}

export interface CaptionWeek {
  id: string;
  weekStart: string;
  timezone: string;
  status: CaptionWeekStatus;
  errorMessage: string | null;
  demo: boolean;
  droppedCount: number;
  // Milestone 8: what past results steered this week towards
  preferences: {
    favour: { key: string; label: string }[];
    avoid: { key: string; label: string }[];
    simulated: boolean;
    basedOn: number;
  } | null;
  // rewrites use prepared versions, not AI, when no AI service is connected
  demoRewrites: boolean;
  maxRewrites: number;
  // posts closer than this to their time can't be approved any more
  minLeadMs: number;
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
