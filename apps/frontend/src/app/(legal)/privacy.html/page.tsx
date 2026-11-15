// OURS: Privacy policy page, served at /privacy.html (a top-level .html path, so the frontend
// proxy lets every visitor through). Content: ours/legal/privacy.policy.tsx.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { legalFacts } from '@gitroom/frontend/ours/legal/legal';
import { PrivacyPolicy } from '@gitroom/frontend/ours/legal/privacy.policy';

export const metadata: Metadata = {
  title: `Privacy policy | ${brand.name}`,
  description:
    'What personal data we collect, why, how long we keep it, and your rights.',
};

export default function Page() {
  return <PrivacyPolicy facts={legalFacts()} />;
}
