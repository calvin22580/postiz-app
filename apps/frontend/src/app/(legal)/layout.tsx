// OURS: root layout for our public legal pages (privacy, terms, data
// deletion). Kept apart from the app's layout so the pages load without
// sign-in, app scripts or trackers. New route group, no upstream files changed.
import '../global.scss';
import { ReactNode } from 'react';
import clsx from 'clsx';
import { jakartaSans } from '@gitroom/frontend/fonts/plus-jakarta-sans/plus.jakarta.sans.font';
import { BrandStyle } from '@gitroom/frontend/ours/brand/brand.style';
import { localeSettings } from '@gitroom/frontend/ours/locale/locale';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={localeSettings.locale || 'en'}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <BrandStyle />
      </head>
      <body className={clsx(jakartaSans.className, 'light')}>{children}</body>
    </html>
  );
}
