export const dynamic = 'force-dynamic';
// OURS: the business profile screen. New route, see apps/frontend/src/ours/profile.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { BusinessProfilePage } from '@gitroom/frontend/ours/profile/business.profile.page';

export const metadata: Metadata = {
  title: `${brand.name} Business profile`,
  description: '',
};

export default function Page() {
  return <BusinessProfilePage />;
}
