// OURS: public About page, served at /about.html (a top-level .html path, so the frontend
// proxy lets every visitor through). The website address for the Meta and LinkedIn apps.
// Content: ours/legal/about.tsx.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { legalFacts } from '@gitroom/frontend/ours/legal/legal';
import { About } from '@gitroom/frontend/ours/legal/about';

export const metadata: Metadata = {
  title: `About | ${brand.name}`,
  description: `${brand.name} plans, writes and schedules social media posts for small businesses. Nothing is published until you approve it.`,
};

export default function Page() {
  return <About facts={legalFacts()} />;
}
