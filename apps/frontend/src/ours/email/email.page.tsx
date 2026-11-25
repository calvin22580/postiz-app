'use client';
// OURS: "Email" (email campaigns EM1). The business's email list: who's on
// it, how each person agreed to hear from them, adding people, the sign-up
// form, a download, and a test email to the owner (EM2). List emails come in EM3.
import { FC, FormEvent, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import {
  ContactFilter,
  ContactStatus,
  EmailContact,
  EmailOverview,
  ImportResult,
  useEmailContacts,
  useEmailSending,
  useEmailOverview,
} from '@gitroom/frontend/ours/email/email.hooks';

// the backend's limit for one upload (email.contacts.ts)
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const formatDate = (date: string) => newDayjs(date).format('DD/MM/YYYY');

const STATUS_LABELS: Record<ContactStatus, string> = {
  SUBSCRIBED: 'Subscribed',
  PENDING_CONFIRMATION: 'Waiting to confirm',
  UNSUBSCRIBED: 'Unsubscribed',
  BOUNCED: 'Address not working',
  COMPLAINED: 'Marked as spam',
};

const BASIS_LABELS: Record<EmailContact['basis'], string> = {
  CONSENT: 'Asked to hear from you',
  SOFT_OPT_IN: 'Customer, could opt out',
};

const SOURCE_LABELS: Record<EmailContact['source'], string> = {
  IMPORT: 'Uploaded',
  FORM: 'Sign-up form',
  MANUAL: 'Added by you',
};

const FILTERS: { key: ContactFilter; label: string }[] = [
  { key: '', label: 'Everyone' },
  { key: 'subscribed', label: 'Subscribed' },
  { key: 'waiting', label: 'Waiting to confirm' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
  { key: 'blocked', label: 'Blocked' },
];

// "bought list, or other": shown so the owner can say so, then refused
const REFUSED = 'OTHER';

const inputClass =
  'h-[44px] rounded-[10px] border border-newBorder bg-newBgColor px-[14px] text-[15px] outline-none focus:border-btnPrimary';
const primaryButton = 'h-[44px] px-[20px] rounded-[10px] bg-btnPrimary text-white text-[15px] font-[500] whitespace-nowrap';
const quietButton =
  'h-[36px] px-[14px] rounded-[8px] border border-newBorder text-[14px] whitespace-nowrap hover:bg-newBgColorInner';

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 bg-newBgColorInner overflow-auto p-[40px] mobile:p-[16px]">
    <div className="max-w-[880px] mx-auto flex flex-col gap-[28px]">{children}</div>
  </div>
);

const Card: FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <section
    data-testid={testId}
    className="flex flex-col gap-[16px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px]"
  >
    {children}
  </section>
);

const Heading: FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-[4px]">
    <h2 className="text-[17px] font-[600]">{title}</h2>
    {children && <p className="text-[14px] leading-[1.6] text-textItemBlur">{children}</p>}
  </div>
);

const Message: FC<{ tone?: 'plain' | 'attention'; children: React.ReactNode; testId?: string }> = ({
  tone = 'plain',
  children,
  testId,
}) => (
  <div
    data-testid={testId}
    role={tone === 'attention' ? 'alert' : 'status'}
    className={clsx(
      'rounded-[10px] px-[14px] py-[12px] text-[14px] leading-[1.6]',
      tone === 'attention' ? 'bg-amber-500/10 border border-amber-500/40' : 'bg-newBgColorInner'
    )}
  >
    {children}
  </div>
);

const Counts: FC<{ data: EmailOverview }> = ({ data }) => {
  const tiles = [
    { key: 'subscribed', label: 'Subscribed', value: data.counts.subscribed },
    { key: 'waiting', label: 'Waiting to confirm', value: data.counts.waiting },
    { key: 'unsubscribed', label: 'Unsubscribed', value: data.counts.unsubscribed },
    { key: 'blocked', label: 'Blocked', value: data.counts.blocked },
  ];
  return (
    <div className="flex flex-col gap-[10px]">
      <ul className="grid grid-cols-4 gap-[12px] mobile:grid-cols-2">
        {tiles.map((t) => (
          <li
            key={t.key}
            data-testid={`email-count-${t.key}`}
            data-value={t.value}
            className="flex flex-col gap-[2px] rounded-[12px] border border-newBorder bg-newBgColor px-[16px] py-[14px]"
          >
            <span className="text-[24px] font-[600] tabular-nums">{t.value}</span>
            <span className="text-[13px] text-textItemBlur">{t.label}</span>
          </li>
        ))}
      </ul>
      <span className="text-[13px] text-textItemBlur tabular-nums" data-testid="email-limit">
        {data.limit.used} of {data.limit.limit} places on your plan used.
      </span>
    </div>
  );
};

type AddMode = 'upload' | 'paste' | 'one';

const AddPeople: FC<{ data: EmailOverview; onChanged: (overview: EmailOverview) => void }> = ({
  data,
  onChanged,
}) => {
  const fetch = useFetch();
  const [mode, setMode] = useState<AddMode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<string>('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const chosen = data.bases.find((b) => b.key === basis);
  const refused = basis === REFUSED;
  const hasInput = mode === 'upload' ? !!file : mode === 'paste' ? !!text.trim() : !!email.trim();
  const ready = hasInput && !!chosen && (mode === 'one' || confirmed) && !busy;

  const reset = () => {
    setError(null);
    setResult(null);
    setAdded(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    reset();
    try {
      let res: Response;
      if (mode === 'one') {
        res = await fetch('/ours/email/contacts', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, basis }),
        });
      } else {
        if (mode === 'upload' && file!.size > MAX_UPLOAD_BYTES) {
          setError('That file is too big. Please upload up to 5 MB at a time.');
          return;
        }
        const body = new FormData();
        body.append('basis', basis);
        body.append('confirmed', String(confirmed));
        if (mode === 'upload') {
          body.append('file', file!);
        } else {
          body.append('text', text);
        }
        res = await fetch('/ours/email/contacts/import', { method: 'POST', body });
      }
      if (!res.ok) {
        setError((await readError(res)) || 'We couldn’t add those. Please try again.');
        return;
      }
      const json = await res.json();
      if (mode === 'one') {
        onChanged(json);
        setAdded(email.trim());
        setEmail('');
        setName('');
      } else {
        onChanged(json.overview);
        setResult(json.result);
        setFile(null);
        setText('');
        setConfirmed(false);
      }
    } catch {
      setError('We couldn’t add those. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const modes: { key: AddMode; label: string }[] = [
    { key: 'upload', label: 'Upload a file' },
    { key: 'paste', label: 'Paste addresses' },
    { key: 'one', label: 'Add one person' },
  ];

  return (
    <Card testId="email-add">
      <Heading title="Add people">
        Only add people who asked to hear from you, or recent customers who were given the chance to say no to
        marketing. Never add a bought or borrowed list.
      </Heading>

      <div className="flex flex-wrap gap-[8px]" role="tablist">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            data-testid={`email-add-${m.key}`}
            onClick={() => {
              setMode(m.key);
              reset();
            }}
            className={clsx(
              'h-[36px] px-[14px] rounded-[8px] border text-[14px]',
              mode === m.key ? 'border-btnPrimary bg-btnPrimary text-white' : 'border-newBorder hover:bg-newBgColorInner'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-[16px]">
        {mode === 'upload' && (
          <label className="flex flex-col gap-[6px]">
            <span className="text-[14px] font-[500]">A spreadsheet saved as CSV</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              data-testid="email-file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-[14px] file:mr-[12px] file:h-[36px] file:px-[14px] file:rounded-[8px] file:border file:border-newBorder file:bg-newBgColor file:text-newTextColor file:text-[14px] file:cursor-pointer"
            />
            <span className="text-[13px] text-textItemBlur">
              It needs a column headed “Email”. A “Name” column is used if there is one. Up to 5 MB.
            </span>
          </label>
        )}
        {mode === 'paste' && (
          <label className="flex flex-col gap-[6px]">
            <span className="text-[14px] font-[500]">Email addresses</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              data-testid="email-paste"
              placeholder={'jane@example.co.uk\nsam@example.com'}
              className="rounded-[10px] border border-newBorder bg-newBgColor px-[14px] py-[10px] text-[15px] outline-none focus:border-btnPrimary"
            />
            <span className="text-[13px] text-textItemBlur">One per line, or separated by commas.</span>
          </label>
        )}
        {mode === 'one' && (
          <div className="flex gap-[10px] mobile:flex-col">
            <label className="flex flex-1 flex-col gap-[6px]">
              <span className="text-[14px] font-[500]">Email address</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="off"
                data-testid="email-one-address"
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-[6px]">
              <span className="text-[14px] font-[500]">Name (optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                data-testid="email-one-name"
                className={inputClass}
              />
            </label>
          </div>
        )}

        <fieldset className="flex flex-col gap-[8px]">
          <legend className="text-[14px] font-[500] mb-[6px]">
            How did {mode === 'one' ? 'this person' : 'these people'} give you their email address?
          </legend>
          {[...data.bases.map((b) => ({ key: b.key as string, label: b.label })), { key: REFUSED, label: 'Bought a list, or something else' }].map(
            (b) => (
              <label key={b.key} className="flex items-start gap-[10px] text-[15px] cursor-pointer">
                <input
                  type="radio"
                  name="ours-email-basis"
                  value={b.key}
                  checked={basis === b.key}
                  data-testid={`email-basis-${b.key}`}
                  onChange={() => {
                    setBasis(b.key);
                    setConfirmed(false);
                    reset();
                  }}
                  className="mt-[4px] accent-btnPrimary"
                />
                <span>{b.label}</span>
              </label>
            )
          )}
        </fieldset>

        {refused && (
          <Message tone="attention" testId="email-refused">
            We can’t add these. UK law only allows marketing emails to people who asked to hear from you, or to
            your own recent customers who could opt out. Bought or borrowed lists never count, even if the seller
            says they do.
          </Message>
        )}

        {chosen && mode !== 'one' && (
          <label className="flex items-start gap-[10px] text-[14px] leading-[1.6] cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              data-testid="email-confirm"
              className="mt-[4px] accent-btnPrimary"
            />
            <span>{chosen.statement}</span>
          </label>
        )}

        {!refused && (
          <button
            type="submit"
            disabled={!ready}
            data-testid="email-add-submit"
            className={clsx(primaryButton, 'self-start', !ready && 'opacity-60')}
          >
            {busy ? 'Adding…' : 'Add to my list'}
          </button>
        )}
      </form>

      {error && (
        <Message tone="attention" testId="email-add-error">
          {error}
        </Message>
      )}
      {added && <Message testId="email-added">{added} is on your list.</Message>}
      {result && <ImportSummary result={result} />}
    </Card>
  );
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const ImportSummary: FC<{ result: ImportResult }> = ({ result }) => {
  const lines = [
    result.alreadyOnList ? `${plural(result.alreadyOnList, 'was', 'were')} already on your list.` : '',
    result.blocked
      ? `${plural(result.blocked, 'person has', 'people have')} unsubscribed or had an address that stopped working before, so we left them out.`
      : '',
    result.invalid ? `${plural(result.invalid, 'line didn’t', 'lines didn’t')} have a usable email address.` : '',
    result.duplicatesInFile ? `${plural(result.duplicatesInFile, 'address was', 'addresses were')} in the file more than once.` : '',
  ].filter(Boolean);
  return (
    <Message tone={result.overLimit ? 'attention' : 'plain'} testId="email-import-result">
      <div className="flex flex-col gap-[4px]">
        <span className="font-[600]" data-testid="email-import-added" data-value={result.added}>
          Added {plural(result.added, 'person', 'people')}.
        </span>
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
        {result.overLimit > 0 && (
          <span>
            {plural(result.overLimit, 'person wasn’t', 'people weren’t')} added because your list is full.{' '}
            {result.limitMessage}
          </span>
        )}
      </div>
    </Message>
  );
};

const SignUpForm: FC<{ data: EmailOverview; onChanged: (overview: EmailOverview) => void }> = ({
  data,
  onChanged,
}) => {
  const fetch = useFetch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/ours/email/form', {
        method: 'PUT',
        body: JSON.stringify({ enabled: !data.form.enabled }),
      });
      if (!res.ok) {
        setError((await readError(res)) || 'We couldn’t save that. Please try again.');
      } else {
        onChanged(await res.json());
      }
    } catch {
      setError('We couldn’t save that. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Your browser wouldn’t copy that. Select it and copy it instead.');
    }
  };

  const snippet = data.form.url
    ? `<a href="${data.form.url}">Get our news and offers by email</a>`
    : '';

  return (
    <Card testId="email-form">
      <Heading title="Your sign-up form">
        A simple page where customers can join your list. They confirm by email before they’re added, so you
        know every address is real and wanted.
      </Heading>
      <div className="flex flex-wrap items-center gap-[12px]">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          data-testid="email-form-toggle"
          className={clsx(data.form.enabled ? quietButton : primaryButton, busy && 'opacity-60')}
        >
          {busy ? 'Saving…' : data.form.enabled ? 'Turn off the form' : 'Turn on the form'}
        </button>
        <span className="text-[14px] text-textItemBlur" data-testid="email-form-state">
          {data.form.enabled ? 'Your form is on.' : 'Your form is off.'}
        </span>
      </div>
      {data.form.enabled && data.form.url && (
        <div className="flex flex-col gap-[12px]">
          <div className="flex flex-col gap-[6px]">
            <span className="text-[14px] font-[500]">Link to share</span>
            <div className="flex gap-[8px] mobile:flex-col">
              <input readOnly value={data.form.url} className={clsx(inputClass, 'flex-1 text-[14px]')} data-testid="email-form-url" />
              <button type="button" className={quietButton} onClick={() => copy('link', data.form.url!)}>
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <span className="text-[13px] text-textItemBlur">
              Put it in your Instagram bio, on your receipts or at the till.
            </span>
          </div>
          <div className="flex flex-col gap-[6px]">
            <span className="text-[14px] font-[500]">For your website</span>
            <div className="flex gap-[8px] mobile:flex-col">
              <input readOnly value={snippet} className={clsx(inputClass, 'flex-1 font-mono text-[13px]')} />
              <button type="button" className={quietButton} onClick={() => copy('snippet', snippet)}>
                {copied === 'snippet' ? 'Copied' : 'Copy code'}
              </button>
            </div>
          </div>
          <span className="text-[13px] text-textItemBlur">What people agree to: “{data.form.consent}”</span>
        </div>
      )}
      {error && <Message tone="attention">{error}</Message>}
    </Card>
  );
};

const TEST_STATUS: Record<string, string> = {
  APPROVED: 'On its way…',
  SENDING: 'On its way…',
  SENT: 'Sent',
  FAILED: 'It couldn’t be sent. Please try again later.',
};

const Sending: FC = () => {
  const fetch = useFetch();
  const { data, error: loadError, mutate } = useEmailSending();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTest = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/ours/email/test', { method: 'POST' });
      if (!res.ok) {
        setError((await readError(res)) || 'We couldn’t send a test just now. Please try again.');
      } else {
        await mutate(await res.json(), { revalidate: false });
      }
    } catch {
      setError('We couldn’t send a test just now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError && !data) {
    return (
      <Card testId="email-sending">
        <Message tone="attention">
          We couldn’t load your sending settings.{' '}
          <button type="button" className="underline" onClick={() => mutate()}>
            Try again
          </button>
        </Message>
      </Card>
    );
  }
  if (!data) {
    return <div className="h-[120px] rounded-[14px] bg-newBgLineColor animate-pulse" />;
  }
  const test = data.latestTest;
  const simulated = data.sender === 'simulated';
  return (
    <Card testId="email-sending">
      <Heading title="See how your emails look">
        Send a test email to yourself. It goes out the same way your customers’ emails will, with your business’s
        name, address and an unsubscribe link at the bottom.
      </Heading>
      {data.sender === 'off' ? (
        <p className="text-[14px] text-textItemBlur" data-testid="email-sending-off">
          Sending isn’t switched on yet. Your list is saved and ready.
        </p>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {simulated && (
            <Message tone="attention" testId="email-simulated">
              Test mode: emails are recorded here, never actually sent.
            </Message>
          )}
          <button
            type="button"
            onClick={sendTest}
            disabled={busy}
            data-testid="email-test-send"
            className={clsx(primaryButton, 'self-start', busy && 'opacity-60')}
          >
            {busy ? 'Sending…' : 'Send me a test email'}
          </button>
          {test && (
            <p className="text-[14px]" data-testid="email-test-status" data-status={test.status}>
              Test to {test.to}: {TEST_STATUS[test.status] || test.status}
              {test.status === 'SENT' && test.sentWith === 'simulated' ? ' (simulated, not delivered)' : ''}
            </p>
          )}
        </div>
      )}
      {error && (
        <Message tone="attention" testId="email-test-error">
          {error}
        </Message>
      )}
    </Card>
  );
};

const ContactList: FC<{ onChanged: (overview: EmailOverview) => void; total: number }> = ({ onChanged, total }) => {
  const fetch = useFetch();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContactFilter>('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadError, mutate } = useEmailContacts(query, filter, page);

  const remove = async (contact: EmailContact) => {
    if (
      !(await deleteDialog(
        `${contact.email} will be taken off your list. If they unsubscribed, they still can’t be added back.`,
        'Remove',
        'Remove this person?',
        'Keep',
        true
      ))
    )
      return;
    setBusy(contact.id);
    setError(null);
    try {
      const res = await fetch(`/ours/email/contacts/${contact.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError((await readError(res)) || 'We couldn’t remove them. Please try again.');
      } else {
        onChanged(await res.json());
        await mutate();
      }
    } catch {
      setError('We couldn’t remove them. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setError(null);
    try {
      const res = await fetch('/ours/email/contacts/export');
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'email-list.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('We couldn’t download your list. Please try again.');
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card testId="email-list">
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <Heading title="Your list" />
        {total > 0 && (
          <button type="button" className={quietButton} onClick={download} data-testid="email-export">
            Download as CSV
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className="text-[15px] leading-[1.6] text-textItemBlur" data-testid="email-list-empty">
          No one on your list yet. Add people above, or turn on your sign-up form.
        </p>
      ) : (
        <>
          <form
            className="flex flex-wrap gap-[10px]"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setQuery(search.trim());
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name"
              aria-label="Search by email or name"
              data-testid="email-search"
              className={clsx(inputClass, 'flex-1 min-w-[200px]')}
            />
            <select
              value={filter}
              aria-label="Show"
              data-testid="email-filter"
              onChange={(e) => {
                setPage(0);
                setFilter(e.target.value as ContactFilter);
              }}
              className={clsx(inputClass, 'pr-[10px]')}
            >
              {FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </form>

          {loadError && (
            <Message tone="attention">
              We couldn’t load your list.{' '}
              <button type="button" className="underline" onClick={() => mutate()}>
                Try again
              </button>
            </Message>
          )}
          {!data && !loadError && <div className="h-[160px] rounded-[10px] bg-newBgLineColor animate-pulse" />}
          {data && data.contacts.length === 0 && (
            <p className="text-[14px] text-textItemBlur">No one matches that.</p>
          )}
          {data && data.contacts.length > 0 && (
            <ul className="flex flex-col" data-testid="email-contacts">
              {data.contacts.map((c) => (
                <li
                  key={c.id}
                  data-testid="email-contact"
                  data-email={c.email}
                  data-status={c.status}
                  className="flex items-start justify-between gap-[12px] border-t border-newBorder py-[12px] first:border-t-0 mobile:flex-col"
                >
                  <div className="flex flex-col gap-[2px] min-w-0">
                    <span className="text-[15px] font-[500] break-all">{c.email}</span>
                    <span className="text-[13px] text-textItemBlur">
                      {[c.name, BASIS_LABELS[c.basis], `${SOURCE_LABELS[c.source]} ${formatDate(c.createdAt)}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-[12px]">
                    <span
                      className={clsx(
                        'text-[13px] whitespace-nowrap',
                        c.status === 'SUBSCRIBED' ? 'text-textColor' : 'text-textItemBlur'
                      )}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      disabled={busy === c.id}
                      className={clsx(quietButton, busy === c.id && 'opacity-60')}
                      data-testid="email-contact-remove"
                    >
                      {busy === c.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data && pages > 1 && (
            <div className="flex items-center justify-between gap-[12px] text-[14px]">
              <button type="button" className={quietButton} disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="text-textItemBlur tabular-nums">
                Page {page + 1} of {pages}
              </span>
              <button
                type="button"
                className={quietButton}
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      {error && <Message tone="attention">{error}</Message>}
    </Card>
  );
};

export const EmailPage: FC = () => {
  const { data, error, mutate } = useEmailOverview();
  const contacts = useEmailContacts('', '', 0);

  const changed = async (overview: EmailOverview) => {
    await mutate(overview, { revalidate: false });
    await contacts.mutate();
  };

  const header = (
    <div className="flex flex-col gap-[10px]">
      <h1 className="text-[26px] font-[600]" data-testid="email-heading">
        Your email list
      </h1>
      <p className="text-[16px] leading-[1.6] text-textItemBlur">
        Your customers’ email addresses, and how each person agreed to hear from you. Soon we’ll write an email
        for them each week, for you to approve like your posts. Nothing goes to your list until you approve it.
      </p>
    </div>
  );

  if (error) {
    return (
      <Shell>
        {header}
        <div className="flex flex-col gap-[12px] rounded-[14px] border border-newBorder p-[24px]">
          <div className="text-[15px]">We couldn’t load your email list just now.</div>
          <button type="button" onClick={() => mutate()} className={clsx(primaryButton, 'self-start h-[38px] text-[14px]')}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        {header}
        <div className="h-[88px] rounded-[14px] bg-newBgLineColor animate-pulse" />
        <div className="h-[260px] rounded-[14px] bg-newBgLineColor animate-pulse" />
      </Shell>
    );
  }

  const total = data.counts.subscribed + data.counts.waiting + data.counts.unsubscribed + data.counts.blocked;

  return (
    <Shell>
      {header}
      <Counts data={data} />
      <AddPeople data={data} onChanged={changed} />
      <SignUpForm data={data} onChanged={changed} />
      <Sending />
      <ContactList onChanged={changed} total={total} />
    </Shell>
  );
};
