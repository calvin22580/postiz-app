// OURS: right-hand panel of the sign-up and log-in pages. Replaces upstream's
// marketing claims and third-party testimonials, which are not ours to make.
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { legalPaths } from '@gitroom/frontend/ours/legal/legal';

export const OursAuthPanel = () => (
  <div className="flex flex-col items-center justify-center gap-[24px] max-w-[520px] h-full px-[20px] text-center">
    <div className="text-[36px] leading-[1.2] font-[600]">
      You approve.
      <br />
      <span style={{ color: '#7FC4BE' }}>We handle the rest.</span>
    </div>
    <div className="text-[18px] text-[#B5B5B5] leading-[1.5]">
      {brand.name} plans and schedules your social media posts. Nothing goes
      out until you have said yes.
    </div>
    <nav
      aria-label="About and legal"
      className="flex flex-wrap justify-center gap-x-[16px] gap-y-[6px] text-[12px] text-[#8A8A8A]"
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
          className="hover:text-white underline-offset-2 hover:underline"
        >
          {link.label}
        </a>
      ))}
      <a
        href={brand.sourceCodeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white underline-offset-2 hover:underline"
      >
        Source code
      </a>
    </nav>
  </div>
);
