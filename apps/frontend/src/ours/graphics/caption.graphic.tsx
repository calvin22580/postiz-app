'use client';
// OURS: a caption's graphic. Before approval: a live preview and a choice of
// layout. After approval: the image that was attached to the scheduled post.
import { FC, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { useCaptionGraphic } from '@gitroom/frontend/ours/graphics/graphics.hooks';
import type { Caption } from '@gitroom/frontend/ours/captions/captions.hooks';

const LAYOUTS = [
  { key: 'statement', label: 'Statement' },
  { key: 'card', label: 'Card' },
  { key: 'details', label: 'Contact details' },
  { key: 'name', label: 'Name and logo' },
];
const labelOf = (key: string | null) => LAYOUTS.find((l) => l.key === key)?.label || '';

const Frame: FC<{ caption: Caption; children: React.ReactNode }> = ({ caption, children }) => {
  const size = caption.graphic.size;
  return (
    <div
      className="w-[180px] mobile:w-full overflow-hidden rounded-[10px] border border-newBorder bg-newBgColorInner flex items-center justify-center"
      style={{ aspectRatio: size ? `${size.width} / ${size.height}` : '4 / 5' }}
    >
      {children}
    </div>
  );
};

export const CaptionGraphic: FC<{
  caption: Caption;
  brandVersion: string;
  onChanged: () => void;
}> = ({ caption, brandVersion, onChanged }) => {
  const fetch = useFetch();
  const approved = caption.status === 'APPROVED';
  const hasGraphic = approved ? !!caption.graphic.path : !!caption.graphic.layout;
  const { data: preview, error } = useCaptionGraphic(
    caption.id,
    !approved && hasGraphic
      ? `${caption.graphic.layout}-${caption.graphic.profileVersion}-${brandVersion}`
      : null
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const size = caption.graphic.size;

  const choose = async (layout: string) => {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/ours/captions/${caption.id}/graphic`, {
      method: 'PUT',
      body: JSON.stringify({ layout }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage((await readError(res)) || 'We couldn’t change the graphic. Please try again.');
      return;
    }
    onChanged();
  };

  if (approved) {
    if (!caption.graphic.path) return null;
    return (
      <div className="flex flex-col gap-[8px]" data-testid="caption-graphic">
        <Frame caption={caption}>
          <img
            src={caption.graphic.path}
            alt="Graphic attached to this post"
            className="h-full w-full object-cover"
            data-testid="caption-graphic-image"
          />
        </Frame>
        <span className="text-[12px] text-textItemBlur">Attached to the post</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[8px]" data-testid="caption-graphic">
      {hasGraphic ? (
        <Frame caption={caption}>
          {preview ? (
            <img
              src={preview}
              alt={`${labelOf(caption.graphic.layout)} graphic for this post`}
              className="h-full w-full object-cover"
              data-testid="caption-graphic-image"
            />
          ) : error ? (
            <span className="px-[12px] text-center text-[12px] text-textItemBlur">
              We couldn’t draw this graphic.
            </span>
          ) : (
            <div className="h-full w-full bg-newBgLineColor animate-pulse" />
          )}
        </Frame>
      ) : (
        <Frame caption={caption}>
          <span className="px-[12px] text-center text-[13px] text-textItemBlur">No graphic</span>
        </Frame>
      )}
      <label className="flex flex-col gap-[4px] w-[180px] mobile:w-full">
        <span className="sr-only">Graphic layout</span>
        <select
          value={caption.graphic.choice}
          disabled={saving}
          onChange={(e) => choose(e.target.value)}
          data-testid="caption-graphic-layout"
          className="h-[32px] rounded-[8px] border border-newBorder bg-newBgColorInner px-[8px] text-[13px]"
        >
          <option value="auto">Automatic</option>
          {LAYOUTS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
          <option value="none">No graphic</option>
        </select>
        {size && hasGraphic && (
          <span className="text-[12px] text-textItemBlur" data-testid="caption-graphic-info">
            {labelOf(caption.graphic.layout)}, {size.width} × {size.height} px
          </span>
        )}
      </label>
      {message && (
        <div role="alert" className="text-[13px] w-[180px] mobile:w-full">
          {message}
        </div>
      )}
    </div>
  );
};
