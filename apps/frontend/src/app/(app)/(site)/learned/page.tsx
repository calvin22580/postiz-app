export const dynamic = 'force-dynamic';
// OURS: the "What we've learned" screen. New route, see apps/frontend/src/ours/memory.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { MemoryPage } from '@gitroom/frontend/ours/memory/memory.page';

export const metadata: Metadata = {
  title: `${brand.name} What we’ve learned`,
  description: '',
};

export default function Page() {
  return <MemoryPage />;
}
