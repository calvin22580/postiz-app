// OURS: replaces upstream's wordmark (components/ui/logo-text.component)
// through a module alias in ours/next/with-ours.mjs.
import React from 'react';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { StickerK } from '@gitroom/frontend/ours/brand/sticker.k';

export const LogoTextComponent = () => {
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logoUrl} alt={brand.name} className="h-[33px] w-auto" />
    );
  }
  return (
    <div className="flex items-center gap-[10px] h-[33px] select-none">
      <StickerK size={34} />
      <span className="k-display text-[23px]">{brand.name}</span>
    </div>
  );
};
