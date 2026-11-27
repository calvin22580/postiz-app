// OURS: a business's email sign-up form, served at /subscribe.html?f=<form id>
// (a top-level .html path, so the frontend proxy lets every visitor through).
// Content: ours/email/email.public.tsx.
import { Metadata } from 'next';
import { SubscribeForm } from '@gitroom/frontend/ours/email/email.public';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign up for emails',
  robots: { index: false, follow: false },
};

export default async function Page(props: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await props.searchParams;
  return (
    <SubscribeForm
      backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL!}
      formId={typeof f === 'string' && f ? f : null}
    />
  );
}
