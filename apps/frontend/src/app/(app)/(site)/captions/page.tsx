export const dynamic = 'force-dynamic';
// OURS: the weekly captions screen. New route, see apps/frontend/src/ours/captions.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { CaptionsPage } from '@gitroom/frontend/ours/captions/captions.page';

export const metadata: Metadata = {
  title: `${brand.name} Weekly posts`,
  description: '',
};

export default function Page() {
  return <CaptionsPage />;
}
