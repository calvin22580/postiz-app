// OURS: the shared frame and building blocks of our public pages (about,
// privacy, terms, data deletion; `plain` drops the legal date and draft notice). Server components only, no client JavaScript.
import { FC, ReactNode } from 'react';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import {
  LegalFacts,
  legalPaths,
  missingFacts,
} from '@gitroom/frontend/ours/legal/legal';

// A visible marker for a detail only the company can supply. Never guessed.
export const FillIn: FC<{ label: string }> = ({ label }) => (
  <mark
    data-testid="legal-fill-in"
    className="rounded-[4px] bg-[#FFF4D6] px-[4px] text-[#5C3D00]"
  >
    [FILL IN: {label}]
  </mark>
);

// A company fact from legal.ts, or its marker when it has not been set yet.
export const Fact: FC<{ value: string; label: string }> = ({ value, label }) =>
  value ? <>{value}</> : <FillIn label={label} />;

export const Email: FC<{ address: string }> = ({ address }) => (
  <a
    href={`mailto:${address}`}
    className="text-btnPrimary underline underline-offset-2"
  >
    {address}
  </a>
);

export const Section: FC<{ id: string; title: string; children: ReactNode }> = ({
  id,
  title,
  children,
}) => (
  <section id={id} className="flex flex-col gap-[12px] scroll-mt-[24px]">
    <h2 className="text-[20px] font-[600] leading-[1.3]">{title}</h2>
    {children}
  </section>
);

export const List: FC<{ children: ReactNode }> = ({ children }) => (
  <ul className="flex list-disc flex-col gap-[6px] ps-[22px]">{children}</ul>
);

export const Steps: FC<{ children: ReactNode }> = ({ children }) => (
  <ol className="flex list-decimal flex-col gap-[6px] ps-[22px]">{children}</ol>
);

export const Table: FC<{ head: string[]; rows: ReactNode[][] }> = ({
  head,
  rows,
}) => (
  <div className="overflow-x-auto rounded-[10px] border border-newBorder">
    <table className="w-full border-collapse text-start text-[14px]">
      <thead>
        <tr className="bg-newBgColor">
          {head.map((h) => (
            <th key={h} className="px-[12px] py-[10px] text-start font-[600]">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-newBorder align-top">
            {row.map((cell, j) => (
              <td key={j} className="px-[12px] py-[10px]">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const nav = [
  { href: legalPaths.about, label: 'About' },
  { href: legalPaths.privacy, label: 'Privacy policy' },
  { href: legalPaths.terms, label: 'Terms of service' },
  { href: legalPaths.dataDeletion, label: 'Delete your data' },
];

export const LegalPage: FC<{
  title: string;
  current: string;
  facts: LegalFacts;
  children: ReactNode;
  // An ordinary public page (About): no "last updated" line or draft notice.
  plain?: boolean;
}> = ({ title, current, facts, children, plain }) => {
  const draft = !plain && (!facts.inForce || missingFacts(facts).length > 0);
  return (
    <div className="min-h-screen bg-newBgColor text-newTextColor">
      <header className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-[12px] px-[16px] pt-[32px]">
        <a href="/" className="text-[20px] font-[700] text-btnPrimary">
          {brand.name}
        </a>
        <nav aria-label="Legal" className="flex flex-wrap gap-[16px] text-[14px]">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.href === current ? 'page' : undefined}
              className={
                item.href === current
                  ? 'font-[600] text-newTextColor'
                  : 'text-textItemBlur hover:text-newTextColor'
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[760px] px-[16px] py-[24px]">
        <article className="flex flex-col gap-[28px] rounded-[16px] bg-newBgColorInner p-[40px] text-[15px] leading-[1.7] mobile:p-[20px]">
          <div className="flex flex-col gap-[8px]">
            <h1 className="k-display text-[30px] leading-[1.2]">{title}</h1>
            {!plain && (
              <p className="text-[14px] text-textItemBlur">
                Effective from:{' '}
                <Fact value={facts.effectiveDate} label="date in force (DD/MM/YYYY)" />
                . Last updated:{' '}
                <Fact value={facts.lastUpdated} label="date published (DD/MM/YYYY)" />
                .
              </p>
            )}
          </div>
          {draft && (
            <div
              role="note"
              data-testid="legal-draft"
              className="rounded-[10px] border border-[#F0D58A] bg-[#FFF4D6] px-[14px] py-[12px] text-[14px] text-[#5C3D00]"
            >
              Draft. This page is not yet in force.
            </div>
          )}
          {children}
        </article>
      </main>
      <footer className="mx-auto flex max-w-[760px] flex-wrap justify-between gap-[12px] px-[16px] pb-[40px] text-[13px] text-textItemBlur">
        <span>
          {brand.name} is a service of {facts.companyName}.
        </span>
        <a
          href={brand.sourceCodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-newTextColor hover:underline"
        >
          Source code
        </a>
      </footer>
    </div>
  );
};
