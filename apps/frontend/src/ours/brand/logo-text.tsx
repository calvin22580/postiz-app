// OURS: replaces upstream's wordmark (components/ui/logo-text.component)
// through a module alias in ours/next/with-ours.mjs.
import React from 'react';
import { brand } from '@gitroom/frontend/ours/brand/brand';

export const LogoTextComponent = () => {
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logoUrl} alt={brand.name} className="h-[33px] w-auto" />
    );
  }
  return (
    <div className="flex items-center gap-[10px] h-[33px] select-none">
      <span
        className="w-[28px] h-[28px] rounded-[7px] flex items-center justify-center text-white text-[16px] font-[700]"
        style={{ backgroundColor: brand.colour }}
        aria-hidden="true"
      >
        {brand.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="text-[24px] font-[600] tracking-[-0.01em]">
        {brand.name}
      </span>
    </div>
  );
};
