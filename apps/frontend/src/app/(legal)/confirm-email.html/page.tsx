// OURS: the page a sign-up's confirmation email links to (double opt-in,
// email campaigns EM2), served at /confirm-email.html?t=<signed token> (a
// top-level .html path, so the frontend proxy lets every visitor through).
// Opening it changes nothing; the button confirms, so link checkers in mail
// systems can't sign anyone up. Content: ours/email/email.public.tsx.
import { Metadata } from 'next';
import { ConfirmPage } from '@gitroom/frontend/ours/email/email.public';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

export default async function Page(props: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await props.searchParams;
  return (
    <ConfirmPage
      backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL!}
      token={typeof t === 'string' && t ? t : null}
    />
  );
}
