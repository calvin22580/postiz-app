'use client';
// OURS: one post on the review screen. While it waits for the owner it can be
// approved, edited, rewritten or rejected; a rejected post can be brought
// back; an approved post is scheduled and no longer changes here.
import { FC, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import type { Caption, CaptionWeek } from '@gitroom/frontend/ours/captions/captions.hooks';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { CaptionGraphic } from '@gitroom/frontend/ours/graphics/caption.graphic';

export const PLATFORMS: Record<Caption['platform'], { label: string; maxLength: number }> = {
  facebook: { label: 'Facebook', maxLength: 2000 },
  instagram: { label: 'Instagram', maxLength: 2200 },
  linkedin: { label: 'LinkedIn', maxLength: 3000 },
};

const NOTE_MAX = 300;

export const SecondaryButton: FC<{
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, testId, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
    className={clsx(
      'h-[38px] px-[14px] rounded-[8px] border border-newBorder text-[14px] whitespace-nowrap hover:bg-newBgColorInner',
      disabled && 'opacity-60'
    )}
  >
    {children}
  </button>
);

export const PrimarySmallButton: FC<{
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, testId, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
    className={clsx(
      'h-[38px] px-[16px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[500]',
      disabled && 'opacity-60'
    )}
  >
    {children}
  </button>
);

const describeDetails = (details: string[]) => {
  const named = details.map((d) => (d === 'price or percentage' ? 'a price or percentage' : `“${d}”`));
  return named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}` : named[0];
};

type Mode = 'view' | 'edit' | 'rewrite';

export const CaptionCard: FC<{
  caption: Caption;
  week: Pick<CaptionWeek, 'demoRewrites'>;
  channelId: string | null;
  channelName: string | null;
  brandVersion: string;
  onChanged: () => void;
}> = ({ caption, week, channelId, channelName, brandVersion, onChanged }) => {
  const fetch = useFetch();
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState<null | 'approve' | 'save' | 'rewrite' | 'reject' | 'restore'>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(caption.text);
  const [note, setNote] = useState('');
  const approved = caption.status === 'APPROVED';
  const rejected = caption.status === 'REJECTED';
  const platform = PLATFORMS[caption.platform];

  const act = async (
    kind: NonNullable<typeof busy>,
    path: string,
    init: RequestInit,
    fallback: string
  ) => {
    setBusy(kind);
    setError(null);
    const res = await fetch(`/ours/captions/${caption.id}/${path}`, init);
    setBusy(null);
    if (!res.ok) {
      setError((await readError(res)) || fallback);
      return false;
    }
    onChanged();
    return true;
  };

  const approve = () =>
    act(
      'approve',
      'approve',
      { method: 'POST', body: JSON.stringify({ integrationId: channelId }) },
      'We couldn’t approve this post. Please try again.'
    );

  const save = async () => {
    if (
      await act(
        'save',
        'text',
        { method: 'PUT', body: JSON.stringify({ text: draft }) },
        'We couldn’t save your changes. Please try again.'
      )
    ) {
      setMode('view');
    }
  };

  const rewrite = async () => {
    if (
      await act(
        'rewrite',
        'rewrite',
        { method: 'POST', body: JSON.stringify(note.trim() ? { note: note.trim() } : {}) },
        'We couldn’t write a new version. Please try again.'
      )
    ) {
      setMode('view');
      setNote('');
    }
  };

  const header = (
    <div className="flex items-center justify-between gap-[12px] flex-wrap">
      <div className="flex items-center gap-[10px]">
        <img
          src={`/icons/platforms/${caption.platform}.png`}
          alt=""
          className={clsx('h-[24px] w-[24px] rounded-full', rejected && 'grayscale')}
        />
        <span className="text-[15px] font-[600]">{platform.label}</span>
        <span className="text-[14px] text-textItemBlur">
          {newDayjs(caption.scheduledFor).format('HH:mm')}
        </span>
        {caption.editedAt && !rejected && (
          <span className="text-[13px] text-textItemBlur" data-testid="caption-edited">
            · Edited by you
          </span>
        )}
      </div>
      <span
        data-testid="caption-status"
        className={clsx(
          'rounded-full px-[10px] py-[3px] text-[13px] border',
          approved
            ? 'border-btnPrimary text-btnPrimary'
            : 'border-newBorder text-textItemBlur'
        )}
      >
        {approved ? 'Approved and scheduled' : rejected ? 'Rejected' : 'Waiting for your approval'}
      </span>
    </div>
  );

  if (rejected) {
    return (
      <article
        className="flex flex-col gap-[10px] rounded-[14px] border border-dashed border-newBorder p-[16px]"
        data-testid="caption-card"
        data-platform={caption.platform}
        data-status={caption.status}
      >
        {header}
        <p className="line-clamp-2 text-[14px] leading-[1.5] text-textItemBlur" data-testid="caption-text">
          {caption.text}
        </p>
        <div className="flex items-center justify-between gap-[12px] flex-wrap">
          <span className="text-[13px] text-textItemBlur">This post won’t be scheduled.</span>
          <SecondaryButton
            testId="caption-restore"
            disabled={!!busy}
            onClick={() =>
              act('restore', 'restore', { method: 'POST' }, 'We couldn’t bring this post back. Please try again.')
            }
          >
            {busy === 'restore' ? 'Bringing back…' : 'Bring back'}
          </SecondaryButton>
        </div>
        {error && (
          <div role="alert" className="text-[14px]">
            {error}
          </div>
        )}
      </article>
    );
  }

  return (
    <article
      className="flex flex-col gap-[14px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px]"
      data-testid="caption-card"
      data-platform={caption.platform}
      data-status={caption.status}
    >
      {header}
      <div className="flex gap-[20px] mobile:flex-col">
        <CaptionGraphic caption={caption} brandVersion={brandVersion} onChanged={onChanged} />
        <div className="flex flex-1 flex-col gap-[14px] min-w-0">
          {mode === 'edit' ? (
            <div className="flex flex-col gap-[8px]">
              <label className="sr-only" htmlFor={`caption-edit-${caption.id}`}>
                Post text
              </label>
              <textarea
                id={`caption-edit-${caption.id}`}
                data-testid="caption-edit-text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(14, Math.max(5, draft.split('\n').length + 2))}
                className="w-full rounded-[10px] border border-newBorder bg-newBgColorInner p-[12px] text-[15px] leading-[1.6] outline-none focus:border-btnPrimary"
              />
              <span
                className={clsx(
                  'self-end text-[12px]',
                  draft.trim().length > platform.maxLength ? 'text-red-500' : 'text-textItemBlur'
                )}
              >
                {draft.trim().length.toLocaleString('en-GB')} / {platform.maxLength.toLocaleString('en-GB')}
              </span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-[1.6]" data-testid="caption-text">
              {caption.text}
            </p>
          )}
          {caption.facts.length > 0 && mode !== 'edit' && (
            <p className="text-[13px] leading-[1.5] text-textItemBlur">
              {caption.editedAt ? 'Written from your profile: ' : 'Based on your profile: '}
              {caption.facts.map((f) => f.value).join(' · ')}
            </p>
          )}
          {caption.notInProfile.length > 0 && mode === 'view' && !approved && (
            <div
              data-testid="caption-check-note"
              className="rounded-[8px] border border-amber-500/40 bg-amber-500/10 px-[12px] py-[8px] text-[13px] leading-[1.5]"
            >
              Check before approving: {describeDetails(caption.notInProfile)}{' '}
              {caption.notInProfile.length === 1 ? 'isn’t' : 'aren’t'} in your business profile.
              That’s fine if it’s true.
            </div>
          )}
        </div>
      </div>

      {mode === 'rewrite' && (
        <div
          className="flex flex-col gap-[10px] rounded-[10px] border border-newBorder bg-newBgColorInner p-[14px]"
          data-testid="caption-rewrite-panel"
        >
          <label className="flex flex-col gap-[6px]">
            <span className="text-[14px]">What would you like changed? (optional)</span>
            <input
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: shorter, more relaxed, mention it’s family-run"
              data-testid="caption-rewrite-note"
              disabled={week.demoRewrites}
              className="h-[38px] rounded-[8px] border border-newBorder bg-newBgColor px-[10px] text-[14px] outline-none focus:border-btnPrimary"
            />
          </label>
          <p className="text-[13px] leading-[1.5] text-textItemBlur">
            {week.demoRewrites
              ? 'Demo mode: no AI service is connected, so you’ll get another prepared version of this post, and notes can’t be used.'
              : 'We only use details from your business profile. To mention something new, add it to your profile first.'}{' '}
            {caption.rewritesLeft === 1
              ? '1 new version left for this post.'
              : `${caption.rewritesLeft} new versions left for this post.`}
          </p>
          <div className="flex gap-[10px] flex-wrap">
            <PrimarySmallButton testId="caption-rewrite-go" onClick={rewrite} disabled={!!busy}>
              {busy === 'rewrite' ? 'Writing a new version…' : 'Write a new version'}
            </PrimarySmallButton>
            <SecondaryButton onClick={() => setMode('view')} disabled={busy === 'rewrite'}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="text-[14px]" data-testid="caption-error">
          {error}
        </div>
      )}

      {approved ? (
        <p className="text-[13px] text-textItemBlur">
          Scheduled on a Sandbox channel (test only). It will not be published to any real account.
        </p>
      ) : mode === 'edit' ? (
        <div className="flex gap-[10px] flex-wrap">
          <PrimarySmallButton
            testId="caption-edit-save"
            onClick={save}
            disabled={!!busy || !draft.trim() || draft.trim().length > platform.maxLength}
          >
            {busy === 'save' ? 'Saving…' : 'Save changes'}
          </PrimarySmallButton>
          <SecondaryButton onClick={() => setMode('view')} disabled={busy === 'save'}>
            Cancel
          </SecondaryButton>
        </div>
      ) : (
        mode === 'view' && (
          <div className="flex gap-[10px] flex-wrap">
            {channelId && (
              <PrimarySmallButton testId="caption-approve" onClick={approve} disabled={!!busy}>
                {busy === 'approve' ? 'Scheduling…' : `Approve and schedule on ${channelName}`}
              </PrimarySmallButton>
            )}
            <SecondaryButton
              testId="caption-edit"
              disabled={!!busy}
              onClick={() => {
                setDraft(caption.text);
                setError(null);
                setMode('edit');
              }}
            >
              Edit
            </SecondaryButton>
            <SecondaryButton
              testId="caption-rewrite"
              disabled={!!busy || caption.rewritesLeft < 1}
              onClick={() => {
                setError(null);
                setMode('rewrite');
              }}
            >
              {caption.rewritesLeft < 1 ? 'No rewrites left' : 'Rewrite'}
            </SecondaryButton>
            <SecondaryButton
              testId="caption-reject"
              disabled={!!busy}
              onClick={() =>
                act('reject', 'reject', { method: 'POST' }, 'We couldn’t reject this post. Please try again.')
              }
            >
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </SecondaryButton>
          </div>
        )
      )}
    </article>
  );
};
