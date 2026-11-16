export const dynamic = 'force-dynamic';
// OURS: the "What worked" screen. New route, see apps/frontend/src/ours/results.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { ResultsPage } from '@gitroom/frontend/ours/results/results.page';

export const metadata: Metadata = {
  title: `${brand.name} What worked`,
  description: '',
};

export default function Page() {
  return <ResultsPage />;
}
