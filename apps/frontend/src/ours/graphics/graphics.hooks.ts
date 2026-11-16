'use client';
// OURS: data for post graphics: the brand kit and graphic previews. Previews
// are images from our API, fetched with the signed-in session.
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

// Images come back as data URLs rather than object URLs: nothing to free by
// hand, and an older version still in SWR's cache keeps working.
const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const useImage = (key: string | null, path: string) => {
  const fetch = useFetch();
  return useSWR<string>(
    key,
    async () => {
      const res = await fetch(path);
      if (!res.ok) throw new Error('load failed');
      return toDataUrl(await res.blob());
    },
    { revalidateOnFocus: false }
  );
};

// `version` changes whenever the picture would: the layout, the profile or
// the brand kit.
export const useCaptionGraphic = (captionId: string, version: string | null) =>
  useImage(version === null ? null : `ours-graphic-${captionId}-${version}`, `/ours/captions/${captionId}/graphic`);

export const useBrandLogo = (version: string | null) =>
  useImage(version === null ? null : `ours-brand-logo-${version}`, '/ours/brand-kit/logo');
