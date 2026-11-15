// OURS: the label every sandbox surface carries.
import { FC } from 'react';

export const SandboxNotice: FC<{ compact?: boolean }> = ({ compact }) => (
  <div
    role="note"
    className={
      compact
        ? 'inline-flex items-center gap-[6px] rounded-[6px] px-[8px] py-[2px] text-[12px] font-[600] bg-[#FFF4D6] text-[#7A5200]'
        : 'flex items-start gap-[10px] rounded-[10px] px-[14px] py-[12px] text-[14px] bg-[#FFF4D6] text-[#5C3D00] border border-[#F0D58A]'
    }
  >
    <span className="font-[700] uppercase tracking-[0.04em]">Sandbox</span>
    {!compact && (
      <span>
        Test channel only. This post is recorded here and is never sent to any
        real social media platform.
      </span>
    )}
  </div>
);
