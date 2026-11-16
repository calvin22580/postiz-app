'use client';
// OURS: "Your posts for next week". Captions written from the business
// profile, grouped by day. Each one waits for the owner's approval; nothing is
// scheduled until they approve it, and for now only on a Sandbox channel.
import { FC, useEffect, useState } from 'react';
import Link from 'next/link';
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
import { CaptionGraphic } from '@gitroom/frontend/ours/graphics/caption.graphic';

const PLATFORMS: Record<Caption['platform'], string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
};

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

const CaptionCard: FC<{
  caption: Caption;
  channelId: string | null;
  channelName: string | null;
  brandVersion: string;
  onApproved: () => void;
}> = ({ caption, channelId, channelName, brandVersion, onApproved }) => {
  const fetch = useFetch();
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approved = caption.status === 'APPROVED';

  const approve = async () => {
    setApproving(true);
    setError(null);
    const res = await fetch(`/ours/captions/${caption.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ integrationId: channelId }),
    });
    setApproving(false);
    if (!res.ok) {
      setError((await readError(res)) || 'We couldn’t approve this post. Please try again.');
      return;
    }
    onApproved();
  };

  return (
    <article
      className="flex flex-col gap-[14px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px]"
      data-testid="caption-card"
      data-platform={caption.platform}
    >
      <div className="flex items-center justify-between gap-[12px]">
        <div className="flex items-center gap-[10px]">
          <img
            src={`/icons/platforms/${caption.platform}.png`}
            alt=""
            className="h-[24px] w-[24px] rounded-full"
          />
          <span className="text-[15px] font-[600]">{PLATFORMS[caption.platform]}</span>
          <span className="text-[14px] text-textItemBlur">
            {newDayjs(caption.scheduledFor).format('HH:mm')}
          </span>
        </div>
        <span
          data-testid="caption-status"
          className={clsx(
            'rounded-full px-[10px] py-[3px] text-[13px]',
            approved ? 'border border-btnPrimary text-btnPrimary' : 'border border-newBorder text-textItemBlur'
          )}
        >
          {approved ? 'Approved and scheduled' : 'Waiting for your approval'}
        </span>
      </div>
      <div className="flex gap-[20px] mobile:flex-col">
        <CaptionGraphic caption={caption} brandVersion={brandVersion} onChanged={onApproved} />
        <div className="flex flex-1 flex-col gap-[14px] min-w-0">
          <p className="whitespace-pre-wrap text-[15px] leading-[1.6]" data-testid="caption-text">
            {caption.text}
          </p>
          {caption.facts.length > 0 && (
            <p className="text-[13px] leading-[1.5] text-textItemBlur">
              Based on your profile: {caption.facts.map((f) => f.value).join(' · ')}
            </p>
          )}
        </div>
      </div>
      {error && (
        <div role="alert" className="text-[14px]">
          {error}
        </div>
      )}
      {approved ? (
        <p className="text-[13px] text-textItemBlur">
          Scheduled on a Sandbox channel (test only). It will not be published to any real account.
        </p>
      ) : (
        channelId && (
          <div>
            <button
              type="button"
              onClick={approve}
              disabled={approving}
              className={clsx(
                'h-[38px] px-[16px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[500]',
                approving && 'opacity-60'
              )}
            >
              {approving ? 'Scheduling…' : `Approve and schedule on ${channelName}`}
            </button>
          </div>
        )
      )}
    </article>
  );
};

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

const WeekList: FC<{ week: CaptionWeek; onChanged: () => void }> = ({ week, onChanged }) => {
  const { data: channels } = useCaptionChannels();
  const { data: brandKit } = useBrandKit();
  const brandVersion = brandKit ? `${brandKit.colour}-${brandKit.updatedAt}` : 'default';
  const [channelId, setChannelId] = useState<string | null>(null);
  useEffect(() => {
    if (!channelId && channels?.channels.length) setChannelId(channels.channels[0].id);
  }, [channels, channelId]);
  const channelName = channels?.channels.find((c) => c.id === channelId)?.name || null;

  const days = week.captions.reduce((all, c) => {
    const key = newDayjs(c.scheduledFor).format('YYYY-MM-DD');
    (all[key] = all[key] || []).push(c);
    return all;
  }, {} as Record<string, Caption[]>);
  const waiting = week.captions.filter((c) => c.status === 'PENDING_APPROVAL').length;

  return (
    <>
      <p className="text-[15px] leading-[1.6] text-textItemBlur" data-testid="captions-summary">
        {waiting
          ? `${waiting} of ${week.captions.length} posts are waiting for your approval.`
          : `All ${week.captions.length} posts are approved.`}{' '}
        Nothing is posted until you approve it.
      </p>
      {week.demo && (
        <Notice tone="demo" testId="captions-demo-notice">
          Demo mode: no AI service is connected, so these posts were written
          from simple templates instead of AI. They still use only details from
          your business profile.
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
      <ChannelBar channelId={channelId} setChannelId={setChannelId} />
      {Object.entries(days).map(([day, captions]) => (
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
              channelId={channelId}
              channelName={channelName}
              brandVersion={brandVersion}
              onApproved={onChanged}
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
          <Notice>{startError}</Notice>
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
    </Shell>
  );
};
