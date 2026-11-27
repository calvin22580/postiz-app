'use client';
// OURS: "Your graphics": the brand colour and logo every post graphic uses.
import { ChangeEvent, FC, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import {
  BrandKit,
  useBrandKit,
  useBrandLogo,
} from '@gitroom/frontend/ours/graphics/graphics.hooks';

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_LOGO_MB = 3;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const SmallButton: FC<{
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, primary, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'h-[34px] px-[14px] rounded-full text-[14px] font-[600] whitespace-nowrap',
      primary ? 'bg-btnPrimary text-white' : 'border border-newBorder',
      disabled && 'opacity-60'
    )}
  >
    {children}
  </button>
);

const LogoPreview: FC<{ kit: BrandKit }> = ({ kit }) => {
  const { data: src } = useBrandLogo(kit.hasLogo ? kit.updatedAt || 'logo' : null);
  if (!kit.hasLogo) {
    return (
      <div className="h-[56px] w-[96px] rounded-[8px] border border-dashed border-newBorder flex items-center justify-center text-[12px] text-textItemBlur">
        No logo
      </div>
    );
  }
  return (
    <div className="h-[56px] min-w-[56px] max-w-[160px] rounded-[8px] bg-white border border-newBorder flex items-center justify-center p-[6px]">
      {src ? (
        <img src={src} alt="Your logo" className="max-h-full max-w-full object-contain" data-testid="brand-logo" />
      ) : (
        <div className="h-full w-[60px] rounded-[4px] bg-newBgLineColor animate-pulse" />
      )}
    </div>
  );
};

export const BrandKitPanel: FC = () => {
  const { data: kit, error, mutate } = useBrandKit();
  const fetch = useFetch();
  const fileInput = useRef<HTMLInputElement>(null);
  const [colour, setColour] = useState('');
  const [busy, setBusy] = useState<'colour' | 'logo' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (kit) setColour(kit.colour);
  }, [kit?.colour]);

  if (error) {
    return (
      <div className="rounded-[18px] border border-newBorder bg-newBgColor p-[20px] text-[14px]">
        We couldn’t load your graphic settings.{' '}
        <button type="button" className="underline" onClick={() => mutate()}>
          Try again
        </button>
      </div>
    );
  }
  if (!kit) {
    return <div className="h-[132px] rounded-[18px] bg-newBgLineColor animate-pulse" />;
  }

  const saved = async (res: Response, fallback: string) => {
    if (!res.ok) {
      setMessage((await readError(res)) || fallback);
      return;
    }
    // previews redraw: their keys include the brand kit's version
    await mutate(await res.json(), { revalidate: false });
  };

  const saveColour = async () => {
    if (!HEX.test(colour)) {
      setMessage('Choose a colour like #1F5F5B.');
      return;
    }
    setBusy('colour');
    setMessage(null);
    const res = await fetch('/ours/brand-kit/colour', {
      method: 'PUT',
      body: JSON.stringify({ colour }),
    });
    await saved(res, 'We couldn’t save your colour. Please try again.');
    setBusy(null);
  };

  const uploadLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      setMessage(`Your logo is too big. Use an image under ${MAX_LOGO_MB} MB.`);
      return;
    }
    setBusy('logo');
    setMessage(null);
    const res = await fetch('/ours/brand-kit/logo', {
      method: 'PUT',
      body: JSON.stringify({ dataUrl: await readAsDataUrl(file) }),
    });
    await saved(res, 'We couldn’t use that image. Please try a PNG or JPEG.');
    setBusy(null);
  };

  const removeLogo = async () => {
    setBusy('logo');
    setMessage(null);
    const res = await fetch('/ours/brand-kit/logo', { method: 'DELETE' });
    await saved(res, 'We couldn’t remove your logo. Please try again.');
    setBusy(null);
  };

  return (
    <section
      className="flex flex-col gap-[16px] rounded-[18px] border border-newBorder bg-newBgColor p-[20px]"
      data-testid="brand-kit"
    >
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[17px] font-[600]">Your graphics</h2>
        <p className="text-[14px] leading-[1.6] text-textItemBlur">
          Each post comes with a graphic in your colour, with your logo and
          words taken only from your business profile.
          {!kit.chosen && ' Pick your brand colour so they look like yours. Until then they use a neutral grey.'}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-x-[32px] gap-y-[16px]">
        <div className="flex flex-col gap-[8px]">
          <span className="text-[13px] text-textItemBlur">Brand colour</span>
          <div className="flex items-center gap-[8px]">
            <input
              type="color"
              aria-label="Brand colour picker"
              value={HEX.test(colour) ? colour : kit.colour}
              onChange={(e) => setColour(e.target.value.toUpperCase())}
              className="h-[34px] w-[44px] cursor-pointer rounded-[8px] border border-newBorder bg-transparent p-[2px]"
            />
            <input
              type="text"
              aria-label="Brand colour"
              value={colour}
              maxLength={7}
              onChange={(e) => setColour(e.target.value.trim())}
              className="h-[34px] w-[96px] rounded-[8px] border border-newBorder bg-newBgColorInner px-[10px] text-[14px] uppercase"
            />
            {colour.toUpperCase() !== kit.colour.toUpperCase() && (
              <SmallButton primary onClick={saveColour} disabled={busy === 'colour'}>
                {busy === 'colour' ? 'Saving…' : 'Save colour'}
              </SmallButton>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-[8px]">
          <span className="text-[13px] text-textItemBlur">Logo</span>
          <div className="flex items-center gap-[10px]">
            <LogoPreview kit={kit} />
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              aria-label="Upload logo"
              data-testid="brand-logo-input"
              onChange={uploadLogo}
            />
            <SmallButton onClick={() => fileInput.current?.click()} disabled={busy === 'logo'}>
              {busy === 'logo' ? 'Saving…' : kit.hasLogo ? 'Change' : 'Upload logo'}
            </SmallButton>
            {kit.hasLogo && (
              <SmallButton onClick={removeLogo} disabled={busy === 'logo'}>
                Remove
              </SmallButton>
            )}
          </div>
        </div>
      </div>
      {message && (
        <div role="alert" className="text-[14px]">
          {message}
        </div>
      )}
    </section>
  );
};
