'use client';
// OURS: "Your posts for next week", the review screen. Captions written from
// the business profile, grouped by day. Each one waits for the owner, who can
// approve, edit, rewrite or reject it (Milestone 5). Nothing is scheduled
// until they approve it, and for now only on a Sandbox channel.
import { FC, useEffect, useState } from 'react';
import Link from 'next/link';
import { listOf } from '@gitroom/frontend/ours/results/results.hooks';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import {
  Caption,
  CaptionWeek,
  useCaptionChannels,
  useCaptionWeek,
} from '@gitroom/frontend/ours/captions/captions.hooks';
import {
  readError,
  useBusinessProfile,
} from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { useBrandKit } from '@gitroom/frontend/ours/graphics/graphics.hooks';
import { BrandKitPanel } from '@gitroom/frontend/ours/graphics/brand.kit.panel';
import { UkDatesPanel } from '@gitroom/frontend/ours/seasonal/uk.dates.panel';
import { PlanMessage } from '@gitroom/frontend/ours/plans/plan.message';
import {
  CaptionCard,
  PLATFORMS,
  PrimarySmallButton,
  SecondaryButton,
} from '@gitroom/frontend/ours/captions/caption.card';

type Filter = 'all' | Caption['status'];
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'PENDING_APPROVAL', label: 'Waiting' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

// weekStart is a calendar date (YYYY-MM-DD), not an instant
const formatDay = (date: string) => newDayjs(date).format('dddd DD/MM/YYYY');

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 bg-newBgColorInner overflow-auto p-[40px] mobile:p-[16px]">
    <div className="max-w-[820px] mx-auto flex flex-col gap-[28px]">{children}</div>
  </div>
);

const Notice: FC<{ children: React.ReactNode; tone?: 'plain' | 'demo'; testId?: string }> = ({
  children,
  tone = 'plain',
  testId,
}) => (
  <div
    data-testid={testId}
    className={clsx(
      'rounded-[10px] border px-[16px] py-[12px] text-[14px] leading-[1.6]',
      tone === 'demo' ? 'border-amber-500/40 bg-amber-500/10' : 'border-newBorder bg-newBgColor'
    )}
  >
    {children}
  </div>
);

const PrimaryButton: FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'h-[44px] px-[20px] rounded-[10px] bg-btnPrimary text-white text-[15px] font-[500] whitespace-nowrap',
      disabled && 'opacity-60'
    )}
  >
    {children}
  </button>
);

const LoadingState = () => (
  <div className="flex flex-col gap-[16px]" aria-busy="true">
    <div className="h-[28px] w-[280px] rounded-[6px] bg-newBgLineColor animate-pulse" />
    <div className="h-[16px] w-[440px] max-w-full rounded-[6px] bg-newBgLineColor animate-pulse" />
    <div className="h-[180px] rounded-[14px] bg-newBgLineColor animate-pulse" />
    <div className="h-[180px] rounded-[14px] bg-newBgLineColor animate-pulse" />
  </div>
);

const ChannelBar: FC<{
  channelId: string | null;
  setChannelId: (id: string) => void;
}> = ({ channelId, setChannelId }) => {
  const { data } = useCaptionChannels();
  if (!data) return null;
  if (!data.sandboxEnabled) {
    return (
      <Notice testId="captions-channel-note">
        These posts are saved for you to read through. Approving and scheduling
        will be switched on once your social media accounts are connected.
      </Notice>
    );
  }
  if (!data.channels.length) {
    return (
      <Notice testId="captions-channel-note">
        To try approving and scheduling, connect the Sandbox test channel from{' '}
        <Link href="/launches" className="underline">
          your calendar
        </Link>
        . It never publishes anything.
      </Notice>
    );
  }
  return (
    <Notice testId="captions-channel-note">
      <label className="flex flex-wrap items-center gap-[10px]">
        <span>Approved posts are scheduled on</span>
        <select
          value={channelId || ''}
          onChange={(e) => setChannelId(e.target.value)}
          className="h-[34px] rounded-[8px] border border-newBorder bg-newBgColorInner px-[10px] text-[14px]"
        >
          {data.channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-textItemBlur">(test only, never published)</span>
      </label>
    </Notice>
  );
};

// Approving everything at once goes through the same approve call, one post
// at a time, so each one is checked (and counted) exactly like a single click.
const ApproveAll: FC<{
  waiting: Caption[];
  channelId: string;
  channelName: string | null;
  onChanged: () => void;
}> = ({ waiting, channelId, channelName, onChanged }) => {
  const fetch = useFetch();
  const [confirming, setConfirming] = useState(false);
  const toCheck = waiting.filter((c) => c.notInProfile.length > 0).length;
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok: number; failed: { caption: Caption; reason: string }[] } | null>(null);
  const [limitReached, setLimitReached] = useState<{ reason: string; notTried: number } | null>(null);

  const run = async () => {
    setConfirming(false);
    setResult(null);
    setLimitReached(null);
    const failed: { caption: Caption; reason: string }[] = [];
    let ok = 0;
    for (const [i, caption] of waiting.entries()) {
      setProgress(i + 1);
      const res = await fetch(`/ours/captions/${caption.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ integrationId: channelId }),
      });
      if (res.ok) {
        ok++;
      } else {
        const reason = (await readError(res)) || 'We couldn’t schedule it.';
        failed.push({ caption, reason });
        // Milestone 7: the plan has no scheduled posts left, so the rest
        // would fail the same way; stop and say so once
        if (res.status === 403) {
          setLimitReached({ reason, notTried: waiting.length - i - 1 });
          break;
        }
      }
    }
    setProgress(null);
    setResult({ ok, failed });
    onChanged();
  };

  if (!waiting.length && progress === null && !result) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[10px]">
      {progress !== null ? (
        <span className="text-[14px]" aria-live="polite" data-testid="captions-approve-all-progress">
          Approving {progress} of {waiting.length}…
        </span>
      ) : confirming ? (
        <div className="flex flex-wrap items-center gap-[10px]" data-testid="captions-approve-all-confirm">
          <span className="text-[14px]">
            Schedule {waiting.length} {waiting.length === 1 ? 'post' : 'posts'} on {channelName}?
            {toCheck > 0 &&
              ` ${toCheck} ${toCheck === 1 ? 'has' : 'have'} details marked “Check before approving”.`}
          </span>
          <PrimarySmallButton testId="captions-approve-all-yes" onClick={run}>
            Yes, approve {waiting.length === 1 ? 'it' : 'all'}
          </PrimarySmallButton>
          <SecondaryButton onClick={() => setConfirming(false)}>Cancel</SecondaryButton>
        </div>
      ) : (
        waiting.length > 0 && (
          <div>
            <PrimarySmallButton testId="captions-approve-all" onClick={() => setConfirming(true)}>
              Approve all {waiting.length} waiting
            </PrimarySmallButton>
          </div>
        )
      )}
      {result && (
        <div role="status" className="text-[14px] leading-[1.6]" data-testid="captions-approve-all-result">
          {result.ok > 0 && `Approved and scheduled ${result.ok} ${result.ok === 1 ? 'post' : 'posts'}. `}
          {limitReached ? (
            <span data-testid="captions-approve-all-limit">
              <PlanMessage text={limitReached.reason} />
              {` ${limitReached.notTried + 1} ${limitReached.notTried === 0 ? 'post is' : 'posts are'} still waiting for you.`}
            </span>
          ) : result.failed.length > 0 && (
            <>
              {result.failed.length} couldn’t be scheduled:
              <ul className="list-disc pl-[20px]">
                {result.failed.map(({ caption, reason }) => (
                  <li key={caption.id}>
                    {newDayjs(caption.scheduledFor).format('dddd')} {PLATFORMS[caption.platform].label}:{' '}
                    <PlanMessage text={reason} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const ReviewBar: FC<{
  week: CaptionWeek;
  filter: Filter;
  setFilter: (f: Filter) => void;
  channelId: string | null;
  channelName: string | null;
  onChanged: () => void;
}> = ({ week, filter, setFilter, channelId, channelName, onChanged }) => {
  const count = (status: Filter) =>
    status === 'all' ? week.captions.length : week.captions.filter((c) => c.status === status).length;
  const waiting = week.captions.filter(
    // a post whose time has passed can't be scheduled any more
    (c) => c.status === 'PENDING_APPROVAL' && new Date(c.scheduledFor).getTime() > Date.now() + week.minLeadMs
  );
  return (
    <div
      className="flex flex-col gap-[14px] rounded-[14px] border border-newBorder bg-newBgColor p-[16px]"
      data-testid="captions-review-bar"
    >
      <div role="tablist" aria-label="Show posts" className="flex flex-wrap gap-[8px]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            data-testid={`captions-filter-${f.key}`}
            onClick={() => setFilter(f.key)}
            className={clsx(
              'h-[34px] px-[14px] rounded-full border text-[14px]',
              filter === f.key
                ? 'border-btnPrimary bg-btnPrimary text-white'
                : 'border-newBorder hover:bg-newBgColorInner'
            )}
          >
            {f.label} <span className={clsx(filter === f.key ? 'opacity-80' : 'text-textItemBlur')}>{count(f.key)}</span>
          </button>
        ))}
      </div>
      {channelId && (
        <ApproveAll waiting={waiting} channelId={channelId} channelName={channelName} onChanged={onChanged} />
      )}
    </div>
  );
};

const WeekList: FC<{ week: CaptionWeek; onChanged: () => void }> = ({ week, onChanged }) => {
  const { data: channels } = useCaptionChannels();
  const { data: brandKit } = useBrandKit();
  const brandVersion = brandKit ? `${brandKit.colour}-${brandKit.updatedAt}` : 'default';
  const [channelId, setChannelId] = useState<string | null>(null);
  useEffect(() => {
    if (!channelId && channels?.channels.length) setChannelId(channels.channels[0].id);
  }, [channels, channelId]);
  const channelName = channels?.channels.find((c) => c.id === channelId)?.name || null;
  const [filter, setFilter] = useState<Filter>('all');

  const days = week.captions.reduce((all, c) => {
    const key = newDayjs(c.scheduledFor).format('YYYY-MM-DD');
    (all[key] = all[key] || []).push(c);
    return all;
  }, {} as Record<string, Caption[]>);
  const waiting = week.captions.filter((c) => c.status === 'PENDING_APPROVAL').length;
  const approvedCount = week.captions.filter((c) => c.status === 'APPROVED').length;
  const shown = Object.entries(days)
    .map(([day, captions]) => [day, captions.filter((c) => filter === 'all' || c.status === filter)] as const)
    .filter(([, captions]) => captions.length);

  return (
    <>
      <p className="text-[15px] leading-[1.6] text-textItemBlur" data-testid="captions-summary">
        {waiting
          ? `${waiting} of ${week.captions.length} posts are waiting for your approval.`
          : approvedCount === week.captions.length
          ? `All ${week.captions.length} posts are approved.`
          : `Nothing is waiting for you. ${approvedCount} of ${week.captions.length} posts are approved.`}{' '}
        Nothing is posted until you approve it.
      </p>
      {week.demo && (
        <Notice tone="demo" testId="captions-demo-notice">
          Demo mode: no AI service is connected, so these posts were written
          from simple templates instead of AI. They still use only details from
          your business profile.
        </Notice>
      )}
      {week.preferences && (
        <Notice tone={week.preferences.simulated ? 'demo' : 'plain'} testId="captions-learning-notice">
          {week.preferences.favour.length > 0 &&
            `This week leans towards ${listOf(week.preferences.favour.map((k) => `“${k.label}”`))} posts, which did better than your usual ones. `}
          {week.preferences.avoid.length > 0 &&
            `It has fewer ${listOf(week.preferences.avoid.map((k) => `“${k.label}”`))} posts, which did worse. `}
          {week.preferences.simulated
            ? 'These results are simulated Sandbox numbers, not real ones. '
            : ''}
          Every post still uses only details from your business profile.{' '}
          <Link href="/results" className="underline">
            See what worked
          </Link>
        </Notice>
      )}
      {week.droppedCount > 0 && (
        <Notice testId="captions-dropped-notice">
          We left out {week.droppedCount}{' '}
          {week.droppedCount === 1 ? 'post that mentions' : 'posts that mention'}{' '}
          details we couldn’t find in your business profile.
        </Notice>
      )}
      {Object.keys(days).length < 5 && (
        <Notice testId="captions-short-week-notice">
          Your profile had enough for {Object.keys(days).length} of 5 weekdays.
          Add more services or what sets you apart to your{' '}
          <Link href="/business-profile" className="underline">
            business profile
          </Link>{' '}
          to fill the week next time.
        </Notice>
      )}
      <BrandKitPanel />
      <UkDatesPanel />
      <ChannelBar channelId={channelId} setChannelId={setChannelId} />
      <ReviewBar
        week={week}
        filter={filter}
        setFilter={setFilter}
        channelId={channelId}
        channelName={channelName}
        onChanged={onChanged}
      />
      {!shown.length && (
        <p className="text-[15px] text-textItemBlur" data-testid="captions-filter-empty">
          {filter === 'REJECTED'
            ? 'You haven’t rejected any posts.'
            : filter === 'APPROVED'
            ? 'You haven’t approved any posts yet.'
            : 'Nothing is waiting for your approval.'}
        </p>
      )}
      {shown.map(([day, captions]) => (
        <section key={day} className="flex flex-col gap-[12px]" data-testid="caption-day">
          <div className="flex flex-col gap-[2px]">
            <h2 className="text-[18px] font-[600]">{formatDay(day)}</h2>
            {captions[0].theme && (
              <span className="text-[14px] text-textItemBlur">{captions[0].theme}</span>
            )}
          </div>
          {captions.map((c) => (
            <CaptionCard
              key={c.id}
              caption={c}
              week={week}
              channelId={channelId}
              channelName={channelName}
              brandVersion={brandVersion}
              onChanged={onChanged}
            />
          ))}
        </section>
      ))}
    </>
  );
};

export const CaptionsPage: FC = () => {
  const profile = useBusinessProfile();
  const { data, error, isLoading, mutate } = useCaptionWeek();
  const fetch = useFetch();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const write = async () => {
    setStarting(true);
    setStartError(null);
    const res = await fetch('/ours/captions/write', { method: 'POST' });
    setStarting(false);
    if (!res.ok) {
      setStartError((await readError(res)) || 'We couldn’t start writing your posts. Please try again.');
      return;
    }
    mutate(await res.json(), { revalidate: false });
  };

  if (isLoading || profile.isLoading) {
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
  }

  if (error || profile.error || !data) {
    return (
      <Shell>
        <h1 className="text-[26px] font-[600]">Your posts</h1>
        <div className="flex flex-col gap-[12px] rounded-[14px] border border-newBorder p-[24px]">
          <div className="text-[15px]">We couldn’t load your posts just now.</div>
          <button
            type="button"
            onClick={() => {
              mutate();
              profile.mutate();
            }}
            className="self-start h-[38px] px-[18px] rounded-[8px] bg-btnPrimary text-white text-[14px]"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const { week, nextWeekStart } = data;

  if (profile.data?.profile?.status !== 'READY' && !week) {
    return (
      <Shell>
        <div className="flex flex-col gap-[10px]">
          <h1 className="text-[26px] font-[600]">Your posts</h1>
          <p className="text-[16px] leading-[1.6] text-textItemBlur">
            We write a week of posts for Facebook, Instagram and LinkedIn from
            your business profile, so they only say things that are true about
            your business. Start by setting up your profile.
          </p>
        </div>
        <Link
          href="/business-profile"
          className="self-start h-[44px] px-[20px] rounded-[10px] bg-btnPrimary text-white text-[15px] font-[500] flex items-center"
          data-testid="captions-profile-link"
        >
          Set up your business profile
        </Link>
      </Shell>
    );
  }

  const canWrite =
    week?.status !== 'WRITING' &&
    !(week?.status === 'READY' && week.weekStart === nextWeekStart);
  const heading =
    week?.status === 'READY'
      ? `Your posts for the week of ${formatDay(week.weekStart)}`
      : 'Your posts';

  return (
    <Shell>
      <div className="flex items-start justify-between gap-[16px] mobile:flex-col">
        <div className="flex flex-col gap-[8px]">
          <h1 className="text-[26px] font-[600]" data-testid="captions-heading">
            {heading}
          </h1>
          {!week && (
            <p className="text-[16px] leading-[1.6] text-textItemBlur">
              We’ll write a post for each weekday of the week starting{' '}
              {formatDay(nextWeekStart)}, in a version for Facebook, Instagram
              and LinkedIn. We only use details from your business profile, and
              nothing is posted until you approve it.
            </p>
          )}
        </div>
        {canWrite && (
          <div className="shrink-0">
            <PrimaryButton onClick={write} disabled={starting}>
              {starting
                ? 'Starting…'
                : week?.status === 'FAILED'
                ? 'Try again'
                : 'Write next week’s posts'}
            </PrimaryButton>
          </div>
        )}
      </div>

      {startError && (
        <div role="alert" data-testid="captions-error">
          <Notice>
            <PlanMessage text={startError} />
          </Notice>
        </div>
      )}

      {week?.status === 'FAILED' && (
        <div role="alert" data-testid="captions-error">
          <Notice>{week.errorMessage || 'Something went wrong while writing your posts.'}</Notice>
        </div>
      )}

      {week?.status === 'WRITING' && (
        <div
          className="flex items-center gap-[14px] rounded-[14px] border border-newBorder p-[28px]"
          data-testid="captions-writing"
          aria-live="polite"
        >
          <span className="h-[10px] w-[10px] rounded-full bg-btnPrimary animate-pulse" />
          <div className="flex flex-col gap-[4px]">
            <span className="text-[16px]">
              Writing your posts for the week of {formatDay(week.weekStart)}
            </span>
            <span className="text-[14px] text-textItemBlur">
              This usually takes under a minute. You can leave this page; we’ll keep going.
            </span>
          </div>
        </div>
      )}

      {week?.status === 'READY' && <WeekList week={week} onChanged={() => mutate()} />}

      {/* before the first week, so the owner can set their nation first */}
      {!week && <UkDatesPanel />}
    </Shell>
  );
};
