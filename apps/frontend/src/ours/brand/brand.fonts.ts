// OURS: Story Mode type (ours/design-language). Self-hosted Latin subsets, all
// under the SIL Open Font Licence (licence text beside each file in ./fonts).
// Loaded with next/font/local, the same way upstream loads Plus Jakarta Sans.
import localFont from 'next/font/local';

// interface text
export const instrumentSans = localFont({
  src: [{ path: './fonts/InstrumentSans-Variable-latin.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
});

// headings on our own screens
export const delaGothic = localFont({
  src: [{ path: './fonts/DelaGothicOne-Regular-latin.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
});

// short handwritten notes, four words at most
export const caveat = localFont({
  src: [{ path: './fonts/Caveat-Bold-latin.woff2', weight: '700', style: 'normal' }],
  display: 'swap',
  // only a few screens use it, so don't preload it on every page
  preload: false,
});
