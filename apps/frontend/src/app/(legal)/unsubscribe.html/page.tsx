// OURS: the unsubscribe page every list email links to, served at
// /unsubscribe.html?t=<signed token> (a top-level .html path, so the frontend
// proxy lets every visitor through). Opening it changes nothing; the button
// does, so link checkers in mail systems can't unsubscribe anyone.
// Content: ours/email/email.public.tsx.
import { Metadata } from 'next';
import { UnsubscribePage } from '@gitroom/frontend/ours/email/email.public';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

export default async function Page(props: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await props.searchParams;
  return (
    <UnsubscribePage
      backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL!}
      token={typeof t === 'string' && t ? t : null}
    />
  );
}
