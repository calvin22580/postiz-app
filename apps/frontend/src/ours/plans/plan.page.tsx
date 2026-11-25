'use client';
// OURS: "Plan and usage" (Milestone 7). What the owner's plan includes, how
// much of it they've used this month, and the plans they can move to.
// Prices come from the backend's plan config, in GBP by default.
import { FC, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { legalFacts } from '@gitroom/frontend/ours/legal/legal';
import {
  MetricKey,
  PlanCard,
  PlanOverview,
  usePlanOverview,
} from '@gitroom/frontend/ours/plans/plans.hooks';

// calendar dates (YYYY-MM-DD), not instants
const formatDate = (date: string) => newDayjs(date).format('DD/MM/YYYY');

const money = (pence: number, pricing: PlanOverview['pricing']) =>
  new Intl.NumberFormat(pricing.locale, {
    style: 'currency',
    currency: pricing.currency,
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);

// "£79 a month", plus the VAT line when VAT is charged
const Price: FC<{ pence: number; pricing: PlanOverview['pricing'] }> = ({ pence, pricing }) => (
  <div className="flex flex-col">
    <span className="text-[15px]">
      <span className="text-[24px] font-[600] tabular-nums">{money(pence, pricing)}</span>
      {pricing.vatRegistered ? ' + VAT a month' : ' a month'}
    </span>
    {pricing.vatRegistered && (
      <span className="text-[13px] text-textItemBlur tabular-nums">
        {money(Math.round(pence * (1 + pricing.vatRate)), pricing)} including VAT
      </span>
    )}
  </div>
);

// what each limit means on a plan card
const included: Record<MetricKey | 'channels' | 'contacts', (n: number) => string> = {
  postsScheduled: (n) => `Up to ${n} scheduled posts a month`,
  captionWeeks: (n) => (n >= 5 ? 'A new week of posts every week' : `${n} weeks of posts a month`),
  rewrites: (n) => `${n} new versions of a post a month`,
  profileBuilds: (n) => `${n} website ${n === 1 ? 'read' : 'reads'} a month to refresh your profile`,
  channels: (n) => `Up to ${n} connected channels`,
  contacts: (n) => `Up to ${n} people on your email list`,
};
const INCLUDED_ORDER: (MetricKey | 'channels' | 'contacts')[] = [
  'postsScheduled',
  'captionWeeks',
  'channels',
  'contacts',
  'rewrites',
  'profileBuilds',
];

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 bg-newBgColorInner overflow-auto p-[40px] mobile:p-[16px]">
    <div className="max-w-[820px] mx-auto flex flex-col gap-[28px]">{children}</div>
  </div>
);

const Card: FC<{ children: React.ReactNode; className?: string; testId?: string }> = ({
  children,
  className,
  testId,
}) => (
  <section
    data-testid={testId}
    className={clsx('flex flex-col gap-[16px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px]', className)}
  >
    {children}
  </section>
);

const Notice: FC<{ children: React.ReactNode; tone?: 'plain' | 'attention'; testId?: string }> = ({
  children,
  tone = 'plain',
  testId,
}) => (
  <div
    role={tone === 'attention' ? 'alert' : undefined}
    data-testid={testId}
    className={clsx(
      'rounded-[10px] border px-[16px] py-[12px] text-[14px] leading-[1.6]',
      tone === 'attention' ? 'border-amber-500/40 bg-amber-500/10' : 'border-newBorder bg-newBgColor'
    )}
  >
    {children}
  </div>
);

const Meter: FC<{ title: string; used: number; limit: number; note?: string; testId: string }> = ({
  title,
  used,
  limit,
  note,
  testId,
}) => {
  const share = limit > 0 ? Math.min(1, used / limit) : 1;
  const full = used >= limit;
  return (
    <li className="flex flex-col gap-[8px]" data-testid={testId} data-used={used} data-limit={limit}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-[12px]">
        <span className="text-[15px]">{title}</span>
        <span className="text-[14px] tabular-nums text-textItemBlur">
          {used} of {limit}
          {full ? ', all used' : ''}
        </span>
      </div>
      <div
        className="h-[8px] rounded-full bg-newBgLineColor overflow-hidden"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <div
          className={clsx('h-full rounded-full', full ? 'bg-amber-500' : 'bg-btnPrimary')}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      {note && <span className="text-[13px] text-textItemBlur">{note}</span>}
    </li>
  );
};

const daysLeft = (date: string) =>
  Math.max(0, newDayjs(date).startOf('day').diff(newDayjs().startOf('day'), 'day'));

const CurrentPlan: FC<{ data: PlanOverview }> = ({ data }) => {
  const { plan, period, pricing } = data;
  return (
    <Card testId="plan-current">
      <div className="flex flex-wrap items-start justify-between gap-[16px]">
        <div className="flex flex-col gap-[4px]">
          <span className="text-[13px] text-textItemBlur">Your plan</span>
          <h2 className="text-[20px] font-[600]" data-testid="plan-current-name">
            {plan.name}
          </h2>
          <p className="text-[14px] text-textItemBlur">{plan.summary}</p>
        </div>
        {plan.monthlyPence !== null && <Price pence={plan.monthlyPence} pricing={pricing} />}
      </div>
      {plan.status === 'trial' && plan.trialEndsAt && (
        <p className="text-[14px]" data-testid="plan-trial">
          Your free trial ends on {formatDate(plan.trialEndsAt)} (
          {daysLeft(plan.trialEndsAt) === 1 ? '1 day' : `${daysLeft(plan.trialEndsAt)} days`} left). Choose a plan
          below whenever you’re ready.
        </p>
      )}
      {plan.status === 'trial-ended' && plan.trialEndsAt && (
        <Notice tone="attention" testId="plan-trial-ended">
          Your free trial ended on {formatDate(plan.trialEndsAt)}. Your posts already scheduled still go out.
          Choose a plan below to keep writing and scheduling new ones.
        </Notice>
      )}
      {plan.status === 'ended' && plan.trialEndsAt && (
        <Notice tone="attention" testId="plan-ended">
          Your plan ended on {formatDate(plan.trialEndsAt)}. Your posts already scheduled still go out. Choose a
          plan below to keep writing and scheduling new ones.
        </Notice>
      )}
      {plan.status === 'active' && period.resetsOn && (
        <p className="text-[14px] text-textItemBlur" data-testid="plan-resets">
          Your monthly allowance started again on {formatDate(period.start)} and next resets on{' '}
          {formatDate(period.resetsOn)}.
        </p>
      )}
      {data.billing.canManage && <ManageBilling />}
    </Card>
  );
};

// Card details, invoices and cancelling, on Stripe's own billing page
const ManageBilling: FC = () => {
  const fetch = useFetch();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/ours/plan/billing');
      if (!res.ok) {
        setMessage((await readError(res)) || 'We couldn’t open your billing page. Please try again.');
        setBusy(false);
        return;
      }
      window.location.href = (await res.json()).url;
    } catch {
      setMessage('We couldn’t open your billing page. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-[8px]">
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={open}
          data-testid="plan-manage-billing"
          className={clsx(
            'h-[40px] px-[16px] rounded-[10px] border border-newBorder text-[14px] font-[500]',
            busy && 'opacity-60'
          )}
        >
          {busy ? 'Opening…' : 'Card, invoices and cancelling'}
        </button>
      </div>
      {message && (
        <div role="alert" className="text-[14px]">
          {message}
        </div>
      )}
    </div>
  );
};

const Usage: FC<{ data: PlanOverview }> = ({ data }) => (
  <Card testId="plan-usage">
    <div className="flex flex-col gap-[4px]">
      <h2 className="text-[17px] font-[600]">
        {data.plan.key === 'trial' ? 'Used in your free trial' : 'Used this month'}
      </h2>
      <p className="text-[14px] leading-[1.6] text-textItemBlur">
        A week, website read or post that fails isn’t counted. A new version of a post counts once it’s
        written, even if we decide not to keep it.
      </p>
    </div>
    <ul className="flex flex-col gap-[18px]">
      {data.usage.map((u) => (
        <Meter key={u.key} title={u.title} used={u.used} limit={u.limit} testId={`plan-meter-${u.key}`} />
      ))}
      <Meter
        title="Connected channels"
        used={data.channels.used}
        limit={data.channels.limit}
        note="Channels you have connected now. Removing one frees a place."
        testId="plan-meter-channels"
      />
      <Meter
        title="People on your email list"
        used={data.contacts.used}
        limit={data.contacts.limit}
        note="Subscribed, or waiting to confirm. Removing someone frees a place."
        testId="plan-meter-contacts"
      />
    </ul>
    {data.fairUseReached && (
      <Notice tone="attention" testId="plan-fair-use">
        You’ve reached this period’s fair-use limit for AI writing, so new posts and rewrites are paused until
        your allowance resets. If you need more before then, please get in touch.
      </Notice>
    )}
  </Card>
);

const PlanOption: FC<{
  card: PlanCard;
  data: PlanOverview;
  busy: string | null;
  onChoose: (key: string) => void;
}> = ({ card, data, busy, onChoose }) => {
  const current = data.plan.key === card.key;
  return (
    <li
      className={clsx(
        'flex flex-col gap-[14px] rounded-[14px] border bg-newBgColor p-[20px]',
        current ? 'border-btnPrimary' : 'border-newBorder'
      )}
      data-testid="plan-option"
      data-plan={card.key}
    >
      <div className="flex flex-col gap-[4px]">
        <h3 className="text-[17px] font-[600]">{card.name}</h3>
        <p className="text-[14px] leading-[1.5] text-textItemBlur">{card.summary}</p>
      </div>
      {card.monthlyPence !== null && <Price pence={card.monthlyPence} pricing={data.pricing} />}
      <ul className="flex flex-col gap-[6px] text-[14px] leading-[1.5]">
        {INCLUDED_ORDER.map((k) => (
          <li key={k} className="flex gap-[8px]">
            <span aria-hidden="true" className="text-textItemBlur">
              ·
            </span>
            <span>{included[k](card.limits[k])}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        {current ? (
          <span className="inline-flex h-[40px] items-center text-[14px] font-[500]" data-testid="plan-option-current">
            Your plan
          </span>
        ) : (
          data.billing.canChange && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => onChoose(card.key)}
              data-testid="plan-option-choose"
              className={clsx(
                'h-[40px] px-[16px] rounded-[10px] bg-btnPrimary text-white text-[14px] font-[500] whitespace-nowrap',
                busy && 'opacity-60'
              )}
            >
              {busy === card.key
                ? data.billing.mode === 'stripe'
                  ? 'Opening payment…'
                  : 'Switching…'
                : data.billing.mode === 'stripe' && data.plan.status !== 'active'
                  ? `Choose ${card.name}`
                  : `Switch to ${card.name}`}
            </button>
          )
        )}
      </div>
    </li>
  );
};

const Plans: FC<{ data: PlanOverview; locked: boolean; onChanged: (next: PlanOverview) => void }> = ({
  data,
  locked,
  onChanged,
}) => {
  const fetch = useFetch();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const contact = legalFacts().contactEmail;

  const choose = async (key: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch('/ours/plan', { method: 'PUT', body: JSON.stringify({ plan: key }) });
      if (!res.ok) {
        setMessage((await readError(res)) || 'We couldn’t change your plan. Please try again.');
        return;
      }
      const next: PlanOverview = await res.json();
      if (next.redirect) {
        // pay first: the plan changes once Stripe confirms the payment
        window.location.href = next.redirect;
        return;
      }
      onChanged(next);
    } catch {
      setMessage('We couldn’t change your plan. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-[16px]" data-testid="plan-options">
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[17px] font-[600]">Plans</h2>
        <p className="text-[14px] leading-[1.6] text-textItemBlur">
          Every plan includes your business profile, branded graphics, UK dates and the review screen. Nothing
          is ever posted without your approval.
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-[16px] tablet:grid-cols-1 mobile:grid-cols-1">
        {data.plans.map((card) => (
          <PlanOption key={card.key} card={card} data={data} busy={locked ? 'locked' : busy} onChoose={choose} />
        ))}
      </ul>
      <p className="text-[13px] text-textItemBlur" data-testid="plan-vat">
        {data.pricing.vatRegistered
          ? `Prices are per month. VAT is added at ${Math.round(data.pricing.vatRate * 100)}%.`
          : 'Prices are per month. No VAT is added.'}
      </p>
      {message && (
        <div role="alert" className="text-[14px]">
          {message}
        </div>
      )}
      {data.billing.mode === 'off' && (
        <Notice testId="plan-contact">
          To change your plan, email{' '}
          <a href={`mailto:${contact}`} className="underline">
            {contact}
          </a>{' '}
          and we’ll sort it out for you.
        </Notice>
      )}
      {data.billing.mode === 'test' && !data.billing.canChange && (
        <Notice testId="plan-admin-only">Ask an admin of your team to change the plan.</Notice>
      )}
    </section>
  );
};

// Back from Stripe: ?checkout=success|cancelled, or ?billing=updated
// Read once, then taken out of the address, so a reload later doesn't say
// "thank you" again.
const useReturnFromPayment = () => {
  const params = useSearchParams();
  const router = useRouter();
  const [returned] = useState(
    () => params?.get('checkout') || (params?.get('billing') === 'updated' ? 'updated' : null)
  );
  useEffect(() => {
    if (returned) {
      router.replace('/plan');
    }
  }, [returned, router]);
  return returned;
};

export const PlanPage: FC = () => {
  const returned = useReturnFromPayment();
  const [waitedEnough, setWaitedEnough] = useState(false);
  // Just paid: keep checking until Stripe's confirmation reaches us, for up
  // to a minute. After a change on Stripe's billing page, check for half a
  // minute (we can't tell which plan was picked there).
  const waiting = (returned === 'success' || returned === 'updated') && !waitedEnough;
  const { data, error, mutate } = usePlanOverview(
    waiting
      ? (latest?: PlanOverview) => (returned === 'success' && latest?.plan.status === 'active' ? 0 : 3000)
      : 0
  );
  useEffect(() => {
    if (returned !== 'success' && returned !== 'updated') {
      return;
    }
    const timer = setTimeout(() => setWaitedEnough(true), returned === 'success' ? 60000 : 30000);
    return () => clearTimeout(timer);
  }, [returned]);
  // no second checkout while the first one is still being confirmed
  const confirming = returned === 'success' && !waitedEnough && data?.plan.status !== 'active';

  return (
    <Shell>
      <div className="flex flex-col gap-[6px]">
        <h1 className="text-[26px] font-[600]" data-testid="plan-heading">
          Plan and usage
        </h1>
        <p className="text-[15px] leading-[1.6] text-textItemBlur">
          What your plan includes and how much of it you’ve used.
        </p>
      </div>
      {error ? (
        <Notice testId="plan-error">
          We couldn’t load your plan.{' '}
          <button type="button" className="underline" onClick={() => mutate()}>
            Try again
          </button>
        </Notice>
      ) : !data ? (
        <div className="flex flex-col gap-[16px]" aria-busy="true">
          <div className="h-[140px] rounded-[14px] bg-newBgLineColor animate-pulse" />
          <div className="h-[260px] rounded-[14px] bg-newBgLineColor animate-pulse" />
        </div>
      ) : (
        <>
          {data.billing.mode === 'test' && (
            <Notice tone="attention" testId="plan-test-mode">
              Test mode: switching plan here is free and no payment is taken.
            </Notice>
          )}
          {data.billing.testPayments && (
            <Notice tone="attention" testId="plan-test-payments">
              Test payments: this is Stripe’s test mode. Use a test card. No real money is taken.
            </Notice>
          )}
          {returned === 'success' &&
            (data.plan.status === 'active' ? (
              <Notice testId="plan-checkout-done">Thank you. Your payment went through and your plan is ready.</Notice>
            ) : waitedEnough ? (
              <Notice tone="attention" testId="plan-checkout-slow">
                Your payment went through, but your plan hasn’t updated yet. Please refresh in a minute, or get in
                touch if it still hasn’t changed.
              </Notice>
            ) : (
              <Notice testId="plan-checkout-waiting">Thank you. We’re setting up your plan, which takes a moment.</Notice>
            ))}
          {returned === 'cancelled' && (
            <Notice testId="plan-checkout-cancelled">Payment cancelled. Nothing was charged.</Notice>
          )}
          {returned === 'updated' && (
            <Notice testId="plan-billing-updated">
              Your billing is up to date. A change of plan shows here as soon as Stripe confirms it.
            </Notice>
          )}
          <CurrentPlan data={data} />
          <Usage data={data} />
          <Plans data={data} locked={confirming} onChanged={(next) => mutate(next, { revalidate: false })} />
        </>
      )}
    </Shell>
  );
};
