'use client';
// OURS: the email list's public pages (email campaigns EM1 and EM2): a
// business's sign-up form (/subscribe.html?f=…), the page its confirmation
// email links to (/confirm-email.html?t=…) and the unsubscribe page
// (/unsubscribe.html?t=…). The people using them are the business's own
// customers, not signed in. They call the backend straight from the browser,
// so its per-visitor limits apply to each visitor.
import { FC, FormEvent, ReactNode, useState } from 'react';
import useSWR from 'swr';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { legalPaths } from '@gitroom/frontend/ours/legal/legal';

type Load<T> = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; data: T };

class NotFound extends Error {}

// Plain fetch: these pages sit outside the app's providers, so there is no
// useFetch (and no sign-in) here.
const getJson = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 404 || res.status === 400) throw new NotFound();
  if (!res.ok) throw new Error('load failed');
  return res.json();
};

const useInfo = <T,>(url: string | null): Load<T> => {
  const { data, error } = useSWR<T>(url, getJson, { revalidateOnFocus: false, shouldRetryOnError: false });
  if (!url || error instanceof NotFound) return { state: 'missing' };
  if (error) return { state: 'error' };
  return data ? { state: 'ready', data } : { state: 'loading' };
};

const Frame: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="flex min-h-screen flex-col bg-newBgColor text-newTextColor">
    <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-[16px] py-[40px]">
      <div className="flex flex-col gap-[20px] rounded-[16px] bg-newBgColorInner p-[32px] text-[15px] leading-[1.6] mobile:p-[20px]">
        <h1 className="text-[24px] font-[700] leading-[1.25]">{title}</h1>
        {children}
      </div>
    </main>
    <footer className="mx-auto flex w-full max-w-[520px] flex-wrap justify-between gap-[12px] px-[16px] pb-[32px] text-[13px] text-textItemBlur">
      <span>Email list run with {brand.name}</span>
      <a href={legalPaths.privacy} className="hover:text-newTextColor hover:underline">
        Privacy policy
      </a>
    </footer>
  </div>
);

const Note: FC<{ testId: string; children: ReactNode }> = ({ testId, children }) => (
  <p data-testid={testId} className="text-textItemBlur">
    {children}
  </p>
);

const Button: FC<{ busy: boolean; testId: string; children: ReactNode }> = ({ busy, testId, children }) => (
  <button
    type="submit"
    disabled={busy}
    data-testid={testId}
    className="h-[44px] rounded-[8px] bg-btnPrimary px-[20px] font-[600] text-white disabled:opacity-60"
  >
    {busy ? 'One moment…' : children}
  </button>
);

const inputClass =
  'h-[44px] w-full rounded-[8px] border border-newBorder bg-newBgColor px-[12px] text-newTextColor outline-none focus:border-btnPrimary';

const Unavailable: FC<{ state: 'loading' | 'missing' | 'error'; missing: string; title: string }> = ({
  state,
  missing,
  title,
}) => (
  <Frame title={state === 'loading' ? 'Loading…' : title}>
    {state === 'missing' && <Note testId="email-public-missing">{missing}</Note>}
    {state === 'error' && (
      <Note testId="email-public-error">Something went wrong on our side. Please try again in a few minutes.</Note>
    )}
  </Frame>
);

interface FormInfo {
  businessName: string;
  consent: string;
}

export const SubscribeForm: FC<{ backendUrl: string; formId: string | null }> = ({ backendUrl, formId }) => {
  const url = formId ? `${backendUrl}/ours/email/public/form/${encodeURIComponent(formId)}` : null;
  const info = useInfo<FormInfo>(url);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (info.state !== 'ready') {
    return <Unavailable state={info.state} title="Sign-up form" missing="This sign-up form isn’t available. The business may have turned it off." />;
  }
  const { businessName } = info.data;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!consent) {
      setError('Please tick the box to say you’d like these emails.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined, consent, website: website || undefined }),
      });
      if (res.ok) {
        setDone(true);
      } else if (res.status === 429) {
        setError('Too many sign-ups from here just now. Please try again later.');
      } else {
        const body = await res.json().catch(() => null);
        const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
        setError(typeof message === 'string' ? message : 'Please check your email address and try again.');
      }
    } catch {
      setError('We couldn’t reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Frame title="Check your inbox">
        <Note testId="email-subscribe-done">
          Thanks. If {businessName} can add you, you’ll get an email asking you to confirm. You won’t get anything else until
          you do.
        </Note>
      </Frame>
    );
  }

  return (
    <Frame title={`Get emails from ${businessName}`}>
      <form onSubmit={submit} className="flex flex-col gap-[14px]" noValidate>
        <label className="flex flex-col gap-[6px]">
          <span className="text-[14px] font-[600]">Email address</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="email-subscribe-address"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className="text-[14px] font-[600]">
            Name <span className="font-[400] text-textItemBlur">(optional)</span>
          </span>
          <input
            type="text"
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="email-subscribe-name"
            className={inputClass}
          />
        </label>
        {/* left empty by people; bots tend to fill it in */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute start-[-9999px] h-px w-px opacity-0"
        />
        <label className="flex items-start gap-[10px] text-[14px]">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            data-testid="email-subscribe-consent"
            className="mt-[4px] h-[16px] w-[16px] shrink-0 accent-btnPrimary"
          />
          <span>{info.data.consent}</span>
        </label>
        {error && (
          <p role="alert" data-testid="email-subscribe-error" className="text-[14px] text-red-600">
            {error}
          </p>
        )}
        <Button busy={busy} testId="email-subscribe-submit">
          Sign up
        </Button>
        <p className="text-[13px] text-textItemBlur">
          We’ll email you once to confirm. You can unsubscribe at any time from any email.
        </p>
      </form>
    </Frame>
  );
};

interface UnsubscribeInfo {
  businessName: string;
  unsubscribed: boolean;
}

export const UnsubscribePage: FC<{ backendUrl: string; token: string | null }> = ({ backendUrl, token }) => {
  const url = token ? `${backendUrl}/ours/email/public/unsubscribe?t=${encodeURIComponent(token)}` : null;
  const info = useInfo<UnsubscribeInfo>(url);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (info.state !== 'ready') {
    return <Unavailable state={info.state} title="Unsubscribe" missing="We couldn’t find this subscription. It may have been removed from the list already. If not, try the link in a more recent email." />;
  }
  const { businessName } = info.data;

  if (done || info.data.unsubscribed) {
    return (
      <Frame title="You’re unsubscribed">
        <Note testId="email-unsubscribe-done">
          You won’t get any more emails from {businessName} through {brand.name}.
        </Note>
      </Frame>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(url!, { method: 'POST' });
      const body = res.ok ? await res.json().catch(() => null) : null;
      if (body?.unsubscribed) {
        setDone(true);
      } else {
        setError('That didn’t work. Please try again in a few minutes.');
      }
    } catch {
      setError('We couldn’t reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame title={`Unsubscribe from ${businessName}`}>
      <p>Press the button and you won’t get any more emails from {businessName}.</p>
      <form onSubmit={submit} className="flex flex-col gap-[12px]">
        {error && (
          <p role="alert" data-testid="email-unsubscribe-error" className="text-[14px] text-red-600">
            {error}
          </p>
        )}
        <Button busy={busy} testId="email-unsubscribe-submit">
          Unsubscribe
        </Button>
      </form>
    </Frame>
  );
};

interface ConfirmInfo {
  businessName: string;
  confirmed: boolean;
  // unsubscribed or blocked since signing up: confirming can't bring them back
  closed: boolean;
}

export const ConfirmPage: FC<{ backendUrl: string; token: string | null }> = ({ backendUrl, token }) => {
  const url = token ? `${backendUrl}/ours/email/public/confirm?t=${encodeURIComponent(token)}` : null;
  const info = useInfo<ConfirmInfo>(url);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (info.state !== 'ready') {
    return <Unavailable state={info.state} title="Confirm your email" missing="We couldn’t find this sign-up. It may have been removed from the list. You can sign up again on the business’s form." />;
  }
  const { businessName } = info.data;

  if (info.data.closed) {
    return (
      <Frame title="This sign-up is closed">
        <Note testId="email-confirm-closed">
          This address has been unsubscribed from {businessName}, so you won’t get their emails.
        </Note>
      </Frame>
    );
  }

  if (done || info.data.confirmed) {
    return (
      <Frame title="You’re on the list">
        <Note testId="email-confirm-done">
          Thanks for confirming. You’ll now get emails from {businessName}, and every one has a link to unsubscribe.
        </Note>
      </Frame>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(url!, { method: 'POST' });
      const body = res.ok ? await res.json().catch(() => null) : null;
      if (body?.confirmed) {
        setDone(true);
      } else if (res.status === 429) {
        setError('Too many tries from here just now. Please try again later.');
      } else {
        setError('That didn’t work. Please try again in a few minutes.');
      }
    } catch {
      setError('We couldn’t reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame title={`Confirm your email for ${businessName}`}>
      <p>Press the button to start getting emails from {businessName}. If you didn’t sign up, just close this page.</p>
      <form onSubmit={submit} className="flex flex-col gap-[12px]">
        {error && (
          <p role="alert" data-testid="email-confirm-error" className="text-[14px] text-red-600">
            {error}
          </p>
        )}
        <Button busy={busy} testId="email-confirm-submit">
          Yes, sign me up
        </Button>
      </form>
    </Frame>
  );
};
