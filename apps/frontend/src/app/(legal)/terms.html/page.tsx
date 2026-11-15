// OURS: Terms of service page, served at /terms.html (a top-level .html path, so the frontend
// proxy lets every visitor through). Content: ours/legal/terms.of.service.tsx.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { legalFacts } from '@gitroom/frontend/ours/legal/legal';
import { TermsOfService } from '@gitroom/frontend/ours/legal/terms.of.service';

export const metadata: Metadata = {
  title: `Terms of service | ${brand.name}`,
  description:
    'The terms for businesses using our AI social media service.',
};

export default function Page() {
  return <TermsOfService facts={legalFacts()} />;
}
