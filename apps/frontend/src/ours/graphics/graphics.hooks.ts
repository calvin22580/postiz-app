'use client';
// OURS: data for post graphics: the brand kit and graphic previews. Previews
// are images from our API, fetched with the signed-in session and shown as
// object URLs.
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface BrandKit {
  colour: string;
  chosen: boolean;
  hasLogo: boolean;
  updatedAt: string | null;
}

export const useBrandKit = () => {
  const fetch = useFetch();
  return useSWR<BrandKit>(
    'ours-brand-kit',
    async () => {
      const res = await fetch('/ours/brand-kit');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};

const useImage = (key: string | null, path: string) => {
  const fetch = useFetch();
  return useSWR<string>(
    key,
    async () => {
      const res = await fetch(path);
      if (!res.ok) throw new Error('load failed');
      return URL.createObjectURL(await res.blob());
    },
    { revalidateOnFocus: false }
  );
};

// `version` changes whenever the picture would: the layout choice or the
// brand kit.
export const useCaptionGraphic = (captionId: string, version: string | null) =>
  useImage(version === null ? null : `ours-graphic-${captionId}-${version}`, `/ours/captions/${captionId}/graphic`);

export const useBrandLogo = (version: string | null) =>
  useImage(version === null ? null : `ours-brand-logo-${version}`, '/ours/brand-kit/logo');
