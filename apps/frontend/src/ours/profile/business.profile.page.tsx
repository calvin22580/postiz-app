'use client';
// OURS: "Your business profile". Enter a website, watch it being read, then
// check and edit what we found. Every detail shows where it came from.
import { FC, FormEvent, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  BusinessProfile,
  isBuilding,
  readError,
  useBusinessProfile,
} from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { ProfileFieldCard } from '@gitroom/frontend/ours/profile/profile.field';
import { PlanMessage } from '@gitroom/frontend/ours/plans/plan.message';
import type { ProfileFieldKey } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';

const GROUPS: {
  title: string;
  fields: { key: ProfileFieldKey; label: string; multiple?: boolean; long?: boolean }[];
}[] = [
  {
    title: 'The basics',
    fields: [
      { key: 'businessName', label: 'Business name' },
      { key: 'whatTheyDo', label: 'What you do', long: true },
      { key: 'location', label: 'Where you’re based' },
      { key: 'serviceArea', label: 'Areas you serve' },
    ],
  },
  {
    title: 'What you offer',
    fields: [
      { key: 'services', label: 'Services and products', multiple: true },
      { key: 'highlights', label: 'What sets you apart', multiple: true },
    ],
  },
  {
    title: 'Your customers and your voice',
    fields: [
      { key: 'audience', label: 'Who your customers are', long: true },
      { key: 'toneOfVoice', label: 'Tone of voice' },
    ],
  },
  {
    title: 'Contact details',
    fields: [
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Address', long: true },
      { key: 'openingHours', label: 'Opening hours', long: true },
      { key: 'socialLinks', label: 'Social media', multiple: true },
    ],
  },
];

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 bg-newBgColorInner overflow-auto p-[40px] mobile:p-[16px]">
    <div className="max-w-[720px] mx-auto flex flex-col gap-[28px]">{children}</div>
  </div>
);

const StartForm: FC<{
  initialUrl?: string;
  error?: string | null;
  onStarted: (p: BusinessProfile) => void;
}> = ({ initialUrl, error, onStarted }) => {
  const fetch = useFetch();
  const [url, setUrl] = useState(initialUrl || '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const res = await fetch('/ours/business-profile/build', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(
        (await readError(res)) || 'We could not start reading that website. Please try again.'
      );
      return;
    }
    onStarted((await res.json()).profile);
  };

  const shown = formError || error;
  return (
    <form onSubmit={submit} className="flex flex-col gap-[14px]" data-testid="profile-start">
      <label htmlFor="ours-website" className="text-[14px] font-[500]">
        Your website address
      </label>
      <div className="flex gap-[10px] mobile:flex-col">
        <input
          id="ours-website"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourbusiness.co.uk"
          inputMode="url"
          autoComplete="url"
          className="flex-1 h-[48px] rounded-[10px] border border-newBorder bg-newBgColor px-[16px] text-[16px] outline-none focus:border-btnPrimary"
        />
        <button
          type="submit"
          disabled={submitting || !url.trim()}
          className={clsx(
            'h-[48px] px-[22px] rounded-full bg-btnPrimary text-white text-[15px] font-[500] whitespace-nowrap',
            (submitting || !url.trim()) && 'opacity-60'
          )}
        >
          {submitting ? 'Starting…' : 'Read my website'}
        </button>
      </div>
      {shown && (
        <div
          role="alert"
          className="rounded-[10px] border border-newBorder bg-newBgColor px-[16px] py-[12px] text-[15px]"
          data-testid="profile-error"
        >
          <PlanMessage text={shown} />
        </div>
      )}
      <p className="text-[14px] leading-[1.6] text-textItemBlur">
        We read your homepage and up to 10 other pages on the same site, and
        we skip anything your site asks robots not to read. We only use what
        your website says, and we show you where each detail came from.
        Nothing is posted anywhere.
      </p>
    </form>
  );
};

const STEPS = [
  { key: 'checking', label: 'Checking your website' },
  { key: 'reading', label: 'Reading your pages' },
  { key: 'writing', label: 'Writing your profile' },
] as const;

const Progress: FC<{ profile: BusinessProfile }> = ({ profile }) => {
  const stage =
    profile.status === 'EXTRACTING' ? 'writing' : profile.progress?.stage || 'checking';
  const current = STEPS.findIndex((s) => s.key === stage);
  return (
    <div
      className="flex flex-col gap-[18px] rounded-[18px] border border-newBorder p-[28px]"
      data-testid="profile-progress"
      aria-live="polite"
    >
      <div className="text-[16px]">
        Reading <span className="font-[600]">{hostOf(profile.websiteUrl)}</span>
      </div>
      <ol className="flex flex-col gap-[14px]">
        {STEPS.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'active' : 'todo';
          return (
            <li key={step.key} className="flex items-center gap-[12px]">
              <span
                className={clsx(
                  'flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[12px]',
                  state === 'done' && 'border-btnPrimary bg-btnPrimary text-white',
                  state === 'active' && 'border-btnPrimary',
                  state === 'todo' && 'border-newBorder'
                )}
              >
                {state === 'done' ? '✓' : state === 'active' ? (
                  <span className="h-[8px] w-[8px] rounded-full bg-btnPrimary animate-pulse" />
                ) : null}
              </span>
              <span className={clsx('text-[15px]', state === 'todo' && 'text-textItemBlur')}>
                {step.label}
                {step.key === 'reading' && state === 'active' && profile.progress?.total
                  ? ` (${profile.progress.done} of ${profile.progress.total} pages)`
                  : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-[14px] text-textItemBlur">
        This usually takes under a minute. You can leave this page; we’ll keep going.
      </p>
    </div>
  );
};

const LoadingState = () => (
  <div className="flex flex-col gap-[16px]" aria-busy="true">
    <div className="h-[28px] w-[260px] rounded-[6px] bg-newBgLineColor animate-pulse" />
    <div className="h-[16px] w-[420px] max-w-full rounded-[6px] bg-newBgLineColor animate-pulse" />
    <div className="h-[220px] rounded-[18px] bg-newBgLineColor animate-pulse" />
  </div>
);

export const BusinessProfilePage: FC = () => {
  const { data, error, isLoading, mutate } = useBusinessProfile();
  const fetch = useFetch();
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const profile = data?.profile;
  const setProfile = (p: BusinessProfile) => mutate({ profile: p }, { revalidate: false });

  const rebuild = async () => {
    setRebuildError(null);
    const res = await fetch('/ours/business-profile/build', {
      method: 'POST',
      body: JSON.stringify({ url: profile!.websiteUrl }),
    });
    if (!res.ok) {
      setRebuildError((await readError(res)) || 'We could not start reading your website again.');
      return;
    }
    setProfile((await res.json()).profile);
  };

  if (isLoading) {
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <h1 className="k-display text-[28px] leading-[1.15]">Your business profile</h1>
        <div className="flex flex-col gap-[12px] rounded-[18px] border border-newBorder p-[24px]">
          <div className="text-[15px]">We couldn’t load your profile just now.</div>
          <button
            type="button"
            onClick={() => mutate()}
            className="self-start h-[38px] px-[18px] rounded-full bg-btnPrimary text-white text-[14px]"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (!profile || profile.status === 'FAILED') {
    return (
      <Shell>
        <div className="flex flex-col gap-[10px]">
          <h1 className="k-display text-[28px] leading-[1.15]">Let’s get to know your business</h1>
          <p className="text-[16px] leading-[1.6] text-textItemBlur">
            Start with your website. We’ll put together a short profile of your
            business for you to check, so everything we write later sounds like
            you and gets the facts right.
          </p>
        </div>
        <StartForm
          initialUrl={profile?.websiteUrl}
          error={profile?.errorMessage}
          onStarted={setProfile}
        />
      </Shell>
    );
  }

  if (isBuilding(profile)) {
    return (
      <Shell>
        <h1 className="k-display text-[28px] leading-[1.15]">Your business profile</h1>
        <Progress profile={profile} />
      </Shell>
    );
  }

  const found = Object.values(profile.fields).filter((f) => f.claims.length).length;
  return (
    <Shell>
      <div className="flex items-start justify-between gap-[16px] mobile:flex-col">
        <div className="flex flex-col gap-[8px]">
          <h1 className="k-display text-[28px] leading-[1.15]">Your business profile</h1>
          <p className="text-[15px] leading-[1.6] text-textItemBlur" data-testid="profile-summary">
            Built from {profile.pages.length} {profile.pages.length === 1 ? 'page' : 'pages'} on{' '}
            {hostOf(profile.websiteUrl)}. We found {found} of{' '}
            {Object.keys(profile.fields).length} details. Check each one and
            change anything that isn’t right.
          </p>
        </div>
        <button
          type="button"
          onClick={rebuild}
          title="Your own changes are kept"
          className="shrink-0 h-[38px] px-[16px] rounded-[8px] border border-newBorder text-[14px] hover:border-btnPrimary"
        >
          Read my website again
        </button>
      </div>
      {rebuildError && (
        <div role="alert" className="rounded-[10px] border border-newBorder px-[16px] py-[12px] text-[15px]">
          <PlanMessage text={rebuildError} />
        </div>
      )}
      {profile.demo && (
        <div
          className="rounded-[10px] border border-amber-500/40 bg-amber-500/10 px-[16px] py-[12px] text-[14px] leading-[1.6]"
          data-testid="profile-demo-notice"
        >
          Demo mode: no AI service is connected, so this profile was put
          together with simple rules instead of AI. It is less complete, but
          every detail still links to where it came from.
        </div>
      )}
      {GROUPS.map((group) => (
        <section
          key={group.title}
          className="flex flex-col rounded-[18px] border border-newBorder px-[24px] py-[8px]"
        >
          <h2 className="pt-[16px] pb-[4px] text-[18px] font-[600]">{group.title}</h2>
          {group.fields.map((f) => (
            <ProfileFieldCard
              key={f.key}
              fieldKey={f.key}
              label={f.label}
              multiple={!!f.multiple}
              long={f.long}
              field={profile.fields[f.key]}
              pages={profile.pages}
              onSaved={setProfile}
            />
          ))}
        </section>
      ))}
    </Shell>
  );
};
