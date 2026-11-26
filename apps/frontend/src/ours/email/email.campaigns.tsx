'use client';
// OURS: "Your emails" on the Email screen (email campaigns EM3). We write an
// email from the business profile; the owner reads it, edits it, asks for a
// new version, or approves it for a time. Nothing goes to the list until
// they approve it, and a scheduled email can be stopped until it starts.
import { FC, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { describeDetails } from '@gitroom/frontend/ours/captions/caption.card';
import {
  CampaignStatus,
  EmailCampaign,
  EmailCampaigns as Overview,
  useEmailCampaigns,
} from '@gitroom/frontend/ours/email/email.hooks';
import {
  Card,
  formatDate,
  Heading,
  inputClass,
  Message,
  primaryButton,
  primarySmallButton,
  quietButton,
} from '@gitroom/frontend/ours/email/email.ui';

// "Tuesday 01/12/2026 at 10:00", in the owner's time zone
const formatWhen = (date: string) => {
  const d = newDayjs(date);
  return `${d.format('dddd')} ${d.format('DD/MM/YYYY')} at ${d.format('HH:mm')}`;
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

const FINISHED_LABELS: Partial<Record<CampaignStatus, string>> = {
  SENT: 'Sent',
  FAILED: 'Couldn’t be sent',
  REJECTED: 'Not sent: you rejected it',
  CANCELLED: 'Not sent: you stopped it',
};

// One request that answers with the whole section, as every action here does.
const useCampaignAction = (onDone: (data: Overview) => Promise<unknown>) => {
  const fetch = useFetch();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (name: string, path: string, init: RequestInit, fallback: string) => {
    setBusy(name);
    setError(null);
    try {
      const res = await fetch(path, init);
      if (!res.ok) {
        setError((await readError(res)) || fallback);
        return false;
      }
      await onDone(await res.json());
      return true;
    } catch {
      setError(fallback);
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
};

// The email as the customer will read it: subject, preview line and body.
const EmailPreview: FC<{ campaign: Pick<EmailCampaign, 'subject' | 'previewText' | 'body'>; from: string }> = ({
  campaign,
  from,
}) => (
  <div className="flex flex-col gap-[12px] rounded-[12px] border border-newBorder bg-newBgColorInner p-[18px]">
    <div className="flex flex-col gap-[2px]">
      <span className="text-[13px] text-textItemBlur">From {from}</span>
      <span className="text-[17px] font-[600] leading-[1.4]" data-testid="email-campaign-subject">
        {campaign.subject}
      </span>
      {campaign.previewText && (
        <span className="text-[14px] text-textItemBlur" data-testid="email-campaign-preview">
          {campaign.previewText}
        </span>
      )}
    </div>
    <div
      className="whitespace-pre-wrap text-[15px] leading-[1.7] border-t border-newBorder pt-[12px]"
      data-testid="email-campaign-body"
    >
      {campaign.body}
    </div>
    <span className="text-[12px] text-textItemBlur">
      Your business’s address, why they’re getting it and an unsubscribe link are added at the bottom.
    </span>
  </div>
);

type Mode = 'view' | 'edit' | 'rewrite' | 'approve';

const Draft: FC<{ campaign: EmailCampaign; data: Overview; from: string; onChanged: (d: Overview) => Promise<unknown> }> = ({
  campaign,
  data,
  from,
  onChanged,
}) => {
  const { busy, error, run } = useCampaignAction(onChanged);
  const [mode, setMode] = useState<Mode>('view');
  const [subject, setSubject] = useState(campaign.subject);
  const [previewText, setPreviewText] = useState(campaign.previewText);
  const [body, setBody] = useState(campaign.body);
  const [note, setNote] = useState('');
  const [sendAt, setSendAt] = useState(newDayjs(data.suggestedSendAt).format('YYYY-MM-DDTHH:mm'));
  const profileFacts = campaign.facts.filter((f) => f.field !== 'seasonal');
  const ukDates = campaign.facts.filter((f) => f.field === 'seasonal');
  const demo = campaign.writer === 'demo';
  const allowanceLeft = data.allowance.limit - data.allowance.used;
  const path = `/ours/email/campaigns/${campaign.id}`;

  const startEdit = () => {
    setSubject(campaign.subject);
    setPreviewText(campaign.previewText);
    setBody(campaign.body);
    setMode('edit');
  };
  const save = async () => {
    if (
      await run('save', path, { method: 'PUT', body: JSON.stringify({ subject, previewText, body }) }, 'We couldn’t save your changes. Please try again.')
    ) {
      setMode('view');
    }
  };
  const rewrite = async () => {
    if (
      await run(
        'rewrite',
        `${path}/rewrite`,
        { method: 'POST', body: JSON.stringify(note.trim() ? { note: note.trim() } : {}) },
        'We couldn’t write a new version just now. Please try again.'
      )
    ) {
      setNote('');
      setMode('view');
    }
  };
  const approve = () =>
    run(
      'approve',
      `${path}/approve`,
      { method: 'POST', body: JSON.stringify({ sendAt: newDayjs(sendAt).toISOString() }) },
      'We couldn’t schedule this email. Please try again.'
    );
  const reject = () => run('reject', `${path}/reject`, { method: 'POST' }, 'We couldn’t reject this email. Please try again.');

  return (
    <div className="flex flex-col gap-[14px]" data-testid="email-campaign-draft" data-id={campaign.id}>
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="text-[14px] font-[600]">Waiting for your approval</span>
        {demo && (
          <span
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-[10px] py-[2px] text-[12px]"
            data-testid="email-campaign-demo"
          >
            Demo: written without the AI service
          </span>
        )}
      </div>

      {mode === 'edit' ? (
        <div className="flex flex-col gap-[12px]" data-testid="email-campaign-edit">
          <label className="flex flex-col gap-[6px] text-[14px]">
            Subject
            <input className={inputClass} value={subject} maxLength={90} onChange={(e) => setSubject(e.target.value)} data-testid="email-edit-subject" />
          </label>
          <label className="flex flex-col gap-[6px] text-[14px]">
            Preview line <span className="text-[13px] text-textItemBlur">Shown after the subject in most inboxes.</span>
            <input className={inputClass} value={previewText} maxLength={150} onChange={(e) => setPreviewText(e.target.value)} data-testid="email-edit-preview" />
          </label>
          <label className="flex flex-col gap-[6px] text-[14px]">
            Email
            <textarea
              value={body}
              rows={12}
              maxLength={4000}
              onChange={(e) => setBody(e.target.value)}
              data-testid="email-edit-body"
              className="rounded-[10px] border border-newBorder bg-newBgColor px-[14px] py-[10px] text-[15px] leading-[1.6] outline-none focus:border-btnPrimary"
            />
          </label>
          <div className="flex flex-wrap gap-[8px]">
            <button type="button" className={clsx(primarySmallButton, busy && 'opacity-60')} disabled={!!busy} onClick={save} data-testid="email-edit-save">
              {busy === 'save' ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className={quietButton} disabled={busy === 'save'} onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <EmailPreview campaign={campaign} from={from} />
      )}

      {mode !== 'edit' && profileFacts.length > 0 && (
        <p className="text-[13px] leading-[1.5] text-textItemBlur">
          {campaign.edited ? 'Original idea from your profile: ' : 'Based on your profile: '}
          {profileFacts.map((f) => f.value).join(' · ')}
        </p>
      )}
      {mode !== 'edit' && ukDates.length > 0 && (
        <p className="text-[13px] leading-[1.5] text-textItemBlur">UK date: {ukDates.map((f) => f.value).join(' · ')}</p>
      )}
      {mode === 'view' && campaign.unsupported.length > 0 && (
        <div
          data-testid="email-campaign-check"
          className="rounded-[8px] border border-amber-500/40 bg-amber-500/10 px-[12px] py-[8px] text-[13px] leading-[1.5]"
        >
          Check before approving: {describeDetails(campaign.unsupported)}{' '}
          {campaign.unsupported.length === 1 ? 'isn’t' : 'aren’t'} in your business profile. That’s fine if it’s true.
        </div>
      )}

      {mode === 'rewrite' && (
        <div className="flex flex-col gap-[10px] rounded-[12px] border border-newBorder p-[14px]" data-testid="email-rewrite-panel">
          <label className="flex flex-col gap-[6px] text-[14px]">
            What would you like changed? <span className="text-[13px] text-textItemBlur">Optional, for example “shorter” or “more about our opening hours”.</span>
            <textarea
              value={note}
              rows={2}
              maxLength={300}
              disabled={demo}
              onChange={(e) => setNote(e.target.value)}
              data-testid="email-rewrite-note"
              className="rounded-[10px] border border-newBorder bg-newBgColor px-[14px] py-[10px] text-[15px] outline-none focus:border-btnPrimary"
            />
          </label>
          <span className="text-[13px] text-textItemBlur">
            {demo
              ? 'Demo mode: no AI service is connected, so you’ll get another prepared version, and notes can’t be used. '
              : ''}
            {campaign.rewritesLeft === 1 ? '1 new version left for this email.' : `${campaign.rewritesLeft} new versions left for this email.`}
          </span>
          <div className="flex flex-wrap gap-[8px]">
            <button type="button" className={clsx(primarySmallButton, busy && 'opacity-60')} disabled={!!busy} onClick={rewrite} data-testid="email-rewrite-go">
              {busy === 'rewrite' ? 'Writing a new version…' : 'Write a new version'}
            </button>
            <button type="button" className={quietButton} disabled={busy === 'rewrite'} onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'approve' && (
        <div className="flex flex-col gap-[10px] rounded-[12px] border border-newBorder p-[14px]" data-testid="email-approve-panel">
          <label className="flex flex-col gap-[6px] text-[14px]">
            When should it go?
            <input
              type="datetime-local"
              className={clsx(inputClass, 'self-start')}
              value={sendAt}
              onChange={(e) => setSendAt(e.target.value)}
              data-testid="email-approve-when"
            />
          </label>
          <span className="text-[14px] leading-[1.6]">
            It goes to everyone subscribed at that time: {plural(data.recipients, 'person', 'people')} now.
            {data.sender === 'simulated' && ' Test mode: it will be recorded, never actually sent.'}
          </span>
          <span className="text-[13px] text-textItemBlur">
            After this you’ll have {allowanceLeft - 1} of your {plural(data.allowance.limit, 'email', 'emails')} left
            {data.allowance.resetsOn ? ' this month' : ' in your free trial'}. You can stop it until it starts sending, and
            then it isn’t counted.
          </span>
          <div className="flex flex-wrap gap-[8px]">
            <button
              type="button"
              className={clsx(primarySmallButton, (busy || !sendAt) && 'opacity-60')}
              disabled={!!busy || !sendAt}
              onClick={approve}
              data-testid="email-approve-go"
            >
              {busy === 'approve' ? 'Scheduling…' : sendAt ? `Send ${formatWhen(newDayjs(sendAt).toISOString())}` : 'Send'}
            </button>
            <button type="button" className={quietButton} disabled={busy === 'approve'} onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'view' && (
        <div className="flex flex-wrap gap-[8px]">
          <button
            type="button"
            className={clsx(primarySmallButton, (busy || allowanceLeft < 1 || data.recipients < 1) && 'opacity-60')}
            disabled={!!busy || allowanceLeft < 1 || data.recipients < 1}
            onClick={() => setMode('approve')}
            data-testid="email-approve"
          >
            Approve and choose when
          </button>
          <button type="button" className={quietButton} disabled={!!busy} onClick={startEdit} data-testid="email-edit">
            Edit
          </button>
          <button
            type="button"
            className={quietButton}
            disabled={!!busy || campaign.rewritesLeft < 1}
            onClick={() => setMode('rewrite')}
            data-testid="email-rewrite"
          >
            {campaign.rewritesLeft < 1 ? 'No rewrites left' : 'Rewrite'}
          </button>
          <button type="button" className={quietButton} disabled={!!busy} onClick={reject} data-testid="email-reject">
            {busy === 'reject' ? 'Rejecting…' : 'Don’t send'}
          </button>
        </div>
      )}
      {mode === 'view' && data.recipients < 1 && (
        <p className="text-[13px] text-textItemBlur">Add people who have agreed to hear from you before approving.</p>
      )}
      {mode === 'view' && allowanceLeft < 1 && (
        <p className="text-[13px] text-textItemBlur">
          You’ve used {data.allowance.limit === 1 ? 'the 1 email' : `all ${data.allowance.limit} emails`} your plan includes
          {data.allowance.resetsOn ? `. It resets on ${formatDate(data.allowance.resetsOn)}` : ''}. See Plan and usage.
        </p>
      )}
      {error && (
        <Message tone="attention" testId="email-campaign-error">
          {error}
        </Message>
      )}
    </div>
  );
};

const Scheduled: FC<{ campaign: EmailCampaign; data: Overview; onChanged: (d: Overview) => Promise<unknown> }> = ({
  campaign,
  data,
  onChanged,
}) => {
  const { busy, error, run } = useCampaignAction(onChanged);
  const sending = campaign.status === 'SENDING';
  const stop = () =>
    run('cancel', `/ours/email/campaigns/${campaign.id}/cancel`, { method: 'POST' }, 'We couldn’t stop this email. Please try again.');
  return (
    <div
      className="flex flex-col gap-[10px] rounded-[12px] border border-newBorder p-[16px]"
      data-testid="email-campaign-scheduled"
      data-status={campaign.status}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
        <span className="text-[15px] font-[600]">{campaign.subject}</span>
        <span className="text-[14px]" data-testid="email-campaign-when">
          {sending
            ? `Sending now: ${campaign.recipients ? `${campaign.sent + campaign.failed} of ${plural(campaign.recipients, 'person', 'people')}` : 'getting ready'}`
            : campaign.scheduledAt && `Scheduled for ${formatWhen(campaign.scheduledAt)}`}
        </span>
      </div>
      {!sending && (
        <div className="flex flex-wrap items-center gap-[12px]">
          <span className="text-[13px] text-textItemBlur">
            Goes to everyone subscribed at that time ({plural(data.recipients, 'person', 'people')} now).
            {data.sender === 'simulated' && ' Test mode: recorded, never actually sent.'}
          </span>
          <button type="button" className={quietButton} disabled={!!busy} onClick={stop} data-testid="email-cancel">
            {busy === 'cancel' ? 'Stopping…' : 'Don’t send'}
          </button>
        </div>
      )}
      {error && (
        <Message tone="attention" testId="email-campaign-error">
          {error}
        </Message>
      )}
    </div>
  );
};

const finishedLine = (c: EmailCampaign) => {
  if (c.status === 'SENT') {
    const when = c.finishedAt ? ` on ${formatDate(c.finishedAt)}` : '';
    const who = plural(c.sent, 'person', 'people');
    return c.sentWith === 'simulated' ? `Sent${when} to ${who} (simulated, not delivered)` : `Sent${when} to ${who}`;
  }
  return FINISHED_LABELS[c.status] || c.status;
};

export const EmailCampaigns: FC<{ from: string }> = ({ from }) => {
  const fetch = useFetch();
  const { data, error: loadError, mutate } = useEmailCampaigns();
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = (next: Overview) => mutate(next, { revalidate: false });

  const write = async () => {
    setWriting(true);
    setError(null);
    try {
      const res = await fetch('/ours/email/campaigns', { method: 'POST' });
      if (!res.ok) {
        setError((await readError(res)) || 'We couldn’t write an email just now. Please try again.');
      } else {
        await changed(await res.json());
      }
    } catch {
      setError('We couldn’t write an email just now. Please try again.');
    } finally {
      setWriting(false);
    }
  };

  if (loadError && !data) {
    return (
      <Card testId="email-campaigns">
        <Message tone="attention">
          We couldn’t load your emails.{' '}
          <button type="button" className="underline" onClick={() => mutate()}>
            Try again
          </button>
        </Message>
      </Card>
    );
  }
  if (!data) {
    return <div className="h-[160px] rounded-[14px] bg-newBgLineColor animate-pulse" />;
  }
  // sending is off: nothing to write or approve yet (the screen says so)
  if (data.sender === 'off') {
    return null;
  }

  const drafts = data.campaigns.filter((c) => c.status === 'WAITING');
  const scheduled = data.campaigns.filter((c) => c.status === 'APPROVED' || c.status === 'SENDING');
  const finished = data.campaigns.filter((c) => !['WAITING', 'APPROVED', 'SENDING'].includes(c.status));

  return (
    <Card testId="email-campaigns">
      <Heading title="Your emails">
        We write each email from your business profile, using only what it says about you. Read it, change anything
        you like, then choose when it goes. Nothing reaches your list until you approve it.
      </Heading>
      <p className="text-[14px] text-textItemBlur tabular-nums" data-testid="email-campaigns-summary">
        {plural(data.recipients, 'person', 'people')} subscribed · {data.allowance.used} of{' '}
        {plural(data.allowance.limit, 'email', 'emails')} used
        {data.allowance.resetsOn ? ` this month (resets ${formatDate(data.allowance.resetsOn)})` : ' in your free trial'}
      </p>
      {data.sender === 'simulated' && (
        <Message tone="attention" testId="email-campaigns-simulated">
          Test mode: approved emails are recorded here, never actually sent.
        </Message>
      )}

      {drafts.map((c) => (
        <Draft key={c.id} campaign={c} data={data} from={from} onChanged={changed} />
      ))}

      {!drafts.length && (
        <div className="flex flex-col gap-[10px]">
          {!scheduled.length && !finished.length && (
            <p className="text-[15px] leading-[1.6]">
              You haven’t sent an email yet. We’ll write the first one from your profile, ready for you to check.
            </p>
          )}
          <button
            type="button"
            onClick={write}
            disabled={writing}
            data-testid="email-write"
            className={clsx(primaryButton, 'self-start', writing && 'opacity-60')}
          >
            {writing ? 'Writing your email…' : scheduled.length || finished.length ? 'Write the next email' : 'Write this week’s email'}
          </button>
          {writing && <span className="text-[13px] text-textItemBlur">This can take up to a minute.</span>}
          {data.writer === 'demo' && !writing && (
            <span className="text-[13px] text-textItemBlur" data-testid="email-write-demo">
              Demo mode: no AI service is connected, so we’ll use a prepared email made from your profile.
            </span>
          )}
        </div>
      )}
      {error && (
        <Message tone="attention" testId="email-write-error">
          {error}
        </Message>
      )}

      {scheduled.length > 0 && (
        <div className="flex flex-col gap-[10px]">
          <h3 className="text-[15px] font-[600]">Scheduled</h3>
          {scheduled.map((c) => (
            <Scheduled key={c.id} campaign={c} data={data} onChanged={changed} />
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          <h3 className="text-[15px] font-[600]">Earlier emails</h3>
          <ul className="flex flex-col divide-y divide-newBorder">
            {finished.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-[8px] py-[10px]"
                data-testid="email-campaign-finished"
                data-status={c.status}
              >
                <span className="text-[15px]">{c.subject}</span>
                <span className="text-[13px] text-textItemBlur">{finishedLine(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
