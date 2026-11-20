'use client';

import { FC } from 'react';
import { fromUtc } from '@gitroom/frontend/components/layout/set.timezone';

export const RenderPreviewDate: FC<{ date: string }> = ({ date }) => {
  console.log(date);
  // OURS (2026-11-20): locale formats (en-GB by default: DD/MM/YYYY HH:mm) instead of a hard-coded US format
  return <>{fromUtc(date).format('L LT')}</>;
};
