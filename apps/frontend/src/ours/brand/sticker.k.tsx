// OURS: the Kanosena mark, a butter sticker with an ink K (ours/design-language).
import { FC } from 'react';

export const StickerK: FC<{ size: number; tilt?: boolean }> = ({ size, tilt = true }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="flex-none">
    <g transform={tilt ? 'rotate(-6 50 50)' : undefined}>
      <rect x="8" y="14" width="84" height="72" rx="17" fill="#FFE15A" stroke="#121212" strokeWidth="5" />
      <path
        fill="#121212"
        transform="translate(-10 -9) scale(.11)"
        d="M324 305h108v191l173-191h150L556 520l209 253H617L466 587l-34 35v151H324z"
      />
    </g>
  </svg>
);
