// OURS: right-hand panel of the sign-up and log-in pages. Replaces upstream's
// marketing claims and third-party testimonials, which are not ours to make.
// Story Mode (ours/design-language): violet panel, highlighted headline.
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { legalPaths } from '@gitroom/frontend/ours/legal/legal';
import { StickerK } from '@gitroom/frontend/ours/brand/sticker.k';

export const OursAuthPanel = () => (
  // the parent column has 88px of top padding
  // (upstream's auth/layout.tsx); the panel fills the column, in the brand colour
  <div
    className="-mt-[88px] flex w-full flex-1 items-center justify-center rounded-[12px] text-white"
    style={{ backgroundColor: brand.colour }}
  >
    <div className="flex flex-col items-center gap-[24px] max-w-[520px] px-[20px] text-center">
      <StickerK size={72} />
      <h2 className="k-display flex flex-col items-center gap-[6px] text-[34px] leading-[1.15]">
        <span className="rounded-[6px] bg-[#FFE15A] px-[10px] py-[2px] text-[#121212]">
          You approve.
        </span>
        <span className="rounded-[6px] bg-white px-[10px] py-[2px] text-[#121212]">
          We handle the rest.
        </span>
      </h2>
      <p className="text-[18px] leading-[1.5]">
        {brand.name} plans and schedules your social media posts. Nothing goes
        out until you have said yes.
      </p>
      <span className="k-hand -rotate-2 text-[26px] leading-none text-[#FFE15A]" aria-hidden="true">
        you’re always in charge
      </span>
      <nav
        aria-label="About and legal"
        className="flex flex-wrap justify-center gap-x-[16px] gap-y-[6px] pt-[8px] text-[13px]"
      >
        {[
          { href: legalPaths.about, label: 'About' },
          { href: legalPaths.privacy, label: 'Privacy policy' },
          { href: legalPaths.terms, label: 'Terms of service' },
          { href: legalPaths.dataDeletion, label: 'Delete your data' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-white underline-offset-2 hover:underline"
          >
            {link.label}
          </a>
        ))}
        <a
          href={brand.sourceCodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white underline-offset-2 hover:underline"
        >
          Source code
        </a>
      </nav>
    </div>
  </div>
);
