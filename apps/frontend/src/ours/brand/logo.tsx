'use client';
// OURS: replaces upstream's square logo (components/new-layout/logo) through a
// module alias in ours/next/with-ours.mjs. Same footprint (60x60).
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { StickerK } from '@gitroom/frontend/ours/brand/sticker.k';

export const Logo = () => {
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logoUrl}
        alt={brand.name}
        width={60}
        height={60}
        className="mt-[8px] min-w-[60px] min-h-[60px] object-contain"
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={brand.name}
      title={brand.name}
      className="mt-[8px] w-[60px] h-[60px] flex items-center justify-center select-none"
    >
      <StickerK size={52} />
    </div>
  );
};
