// OURS: slim footer with the "Source code" link our AGPL licence calls for.
import { brand } from '@gitroom/frontend/ours/brand/brand';

export const OursFooter = () => (
  <footer className="flex justify-end gap-[16px] px-[8px] pt-[8px] text-[12px] text-textItemBlur">
    <a
      href={brand.sourceCodeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-newTextColor underline-offset-2 hover:underline"
    >
      Source code
    </a>
  </footer>
);
