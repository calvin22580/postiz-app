export const dynamic = 'force-dynamic';
// OURS: the email list screen (email campaigns EM1). New route, see apps/frontend/src/ours/email.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { EmailPage } from '@gitroom/frontend/ours/email/email.page';

export const metadata: Metadata = {
  title: `${brand.name} Email`,
  description: '',
};

export default function Page() {
  return <EmailPage />;
}
