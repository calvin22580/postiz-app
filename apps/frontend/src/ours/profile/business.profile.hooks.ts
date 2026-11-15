'use client';
// OURS: data for the business profile screen.
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import type { ProfileFields } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';

export type ProfileStatus = 'CRAWLING' | 'EXTRACTING' | 'READY' | 'FAILED';

export interface BusinessProfile {
  websiteUrl: string;
  status: ProfileStatus;
  progress: { stage: 'checking' | 'reading' | 'writing'; done: number; total: number } | null;
  errorMessage: string | null;
  fields: ProfileFields;
  pages: { url: string; title: string }[];
  demo: boolean;
  updatedAt: string;
}

export const isBuilding = (p?: BusinessProfile | null) =>
  p?.status === 'CRAWLING' || p?.status === 'EXTRACTING';

export const useBusinessProfile = () => {
  const fetch = useFetch();
  return useSWR<{ profile: BusinessProfile | null }>(
    'ours-business-profile',
    async () => {
      const res = await fetch('/ours/business-profile');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    {
      refreshInterval: (data) => (isBuilding(data?.profile) ? 1500 : 0),
      revalidateOnFocus: false,
    }
  );
};

export const readError = async (res: Response) => {
  try {
    const body = await res.json();
    const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
    return typeof msg === 'string' && msg ? msg : null;
  } catch {
    return null;
  }
};
