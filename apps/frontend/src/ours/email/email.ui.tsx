'use client';
// OURS: the small building blocks the Email screen's sections share (email
// campaigns EM1 to EM3), so each section looks the same.
import { FC } from 'react';
import clsx from 'clsx';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

export const formatDate = (date: string) => newDayjs(date).format('DD/MM/YYYY');

export const inputClass =
  'h-[44px] rounded-[10px] border border-newBorder bg-newBgColor px-[14px] text-[15px] outline-none focus:border-btnPrimary';
export const primaryButton = 'h-[44px] px-[20px] rounded-[10px] bg-btnPrimary text-white text-[15px] font-[500] whitespace-nowrap';
export const primarySmallButton =
  'h-[36px] px-[14px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[500] whitespace-nowrap';
export const quietButton =
  'h-[36px] px-[14px] rounded-[8px] border border-newBorder text-[14px] whitespace-nowrap hover:bg-newBgColorInner';

export const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 bg-newBgColorInner overflow-auto p-[40px] mobile:p-[16px]">
    <div className="max-w-[880px] mx-auto flex flex-col gap-[28px]">{children}</div>
  </div>
);

export const Card: FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <section
    data-testid={testId}
    className="flex flex-col gap-[16px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px]"
  >
    {children}
  </section>
);

export const Heading: FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-[4px]">
    <h2 className="text-[17px] font-[600]">{title}</h2>
    {children && <p className="text-[14px] leading-[1.6] text-textItemBlur">{children}</p>}
  </div>
);

export const Message: FC<{ tone?: 'plain' | 'attention'; children: React.ReactNode; testId?: string }> = ({
  tone = 'plain',
  children,
  testId,
}) => (
  <div
    data-testid={testId}
    role={tone === 'attention' ? 'alert' : 'status'}
    className={clsx(
      'rounded-[10px] px-[14px] py-[12px] text-[14px] leading-[1.6]',
      tone === 'attention' ? 'bg-amber-500/10 border border-amber-500/40' : 'bg-newBgColorInner'
    )}
  >
    {children}
  </div>
);

