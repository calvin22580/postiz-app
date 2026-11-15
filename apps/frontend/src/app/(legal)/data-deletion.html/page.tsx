// OURS: Data deletion instructions page, served at /data-deletion.html (a top-level .html path, so the frontend
// proxy lets every visitor through). Content: ours/legal/data.deletion.tsx.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { legalFacts } from '@gitroom/frontend/ours/legal/legal';
import { DataDeletion } from '@gitroom/frontend/ours/legal/data.deletion';

export const metadata: Metadata = {
  title: `How to delete your data | ${brand.name}`,
  description:
    'How to ask us to delete your data, including data from Facebook, Instagram and LinkedIn.',
};

export default function Page() {
  return <DataDeletion facts={legalFacts()} />;
}
