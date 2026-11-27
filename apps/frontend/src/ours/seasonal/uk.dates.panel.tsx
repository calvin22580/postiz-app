'use client';
// OURS: "UK dates in your posts" (Milestone 6). The dates coming up for the
// owner's nation, each linked to where we checked it. The owner can pick
// their nation, turn dates off, or skip one they don't want mentioned.
import { FC, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { UkDate, useUkDates } from '@gitroom/frontend/ours/seasonal/seasonal.hooks';

// how many dates show before "Show all"
const FIRST_SHOWN = 4;

const KIND_LABELS: Record<UkDate['kind'], string> = {
  occasion: 'Occasion',
  shopping: 'Shopping day',
  'national-day': 'National day',
  'bank-holiday': 'Bank holiday',
};

// calendar dates (YYYY-MM-DD), not instants
const formatDate = (date: string) => newDayjs(date).format('ddd DD/MM/YYYY');

const DateRow: FC<{
  item: UkDate;
  disabled: boolean;
  busy: boolean;
  onToggle: () => void;
}> = ({ item, disabled, busy, onToggle }) => {
  const muted = item.skipped || !item.usedInPosts;
  return (
    <li
      className="flex items-start justify-between gap-[12px] border-t border-newBorder py-[12px] first:border-t-0 mobile:flex-col"
      data-testid="uk-date"
      data-key={item.key}
      data-skipped={item.skipped}
    >
      <div className={clsx('flex flex-col gap-[4px] min-w-0', muted && 'opacity-60')}>
        <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
          <span className="text-[14px] text-textItemBlur tabular-nums">{formatDate(item.date)}</span>
          <span className="text-[15px] font-[600]">{item.name}</span>
          <span className="text-[12px] text-textItemBlur">
            {KIND_LABELS[item.kind]}
            {item.bankHoliday && item.kind !== 'bank-holiday' ? ' · Bank holiday' : ''}
          </span>
        </div>
        <span className="text-[13px] leading-[1.5] text-textItemBlur">
          {item.about}{' '}
          {item.sources.map((s, i) => (
            <span key={s.url}>
              {i === 0 ? 'Source: ' : ', '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                data-testid="uk-date-source"
              >
                {s.name}
              </a>
            </span>
          ))}
        </span>
      </div>
      {item.usedInPosts ? (
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled || busy}
          data-testid="uk-date-toggle"
          className={clsx(
            'h-[32px] shrink-0 px-[12px] rounded-[8px] border border-newBorder text-[13px] whitespace-nowrap hover:bg-newBgColorInner',
            (disabled || busy) && 'opacity-60'
          )}
        >
          {busy ? 'Saving…' : item.skipped ? 'Use this date' : 'Don’t use'}
        </button>
      ) : (
        <span className="shrink-0 text-[13px] text-textItemBlur">Not suggested in posts</span>
      )}
    </li>
  );
};

export const UkDatesPanel: FC = () => {
  const { data, error, mutate } = useUkDates();
  const fetch = useFetch();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (error) {
    return (
      <div className="rounded-[18px] border border-newBorder bg-newBgColor p-[20px] text-[14px]">
        We couldn’t load UK dates.{' '}
        <button type="button" className="underline" onClick={() => mutate()}>
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return <div className="h-[132px] rounded-[18px] bg-newBgLineColor animate-pulse" />;
  }

  const save = async (kind: string, path: string, body: object) => {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(path, { method: 'PUT', body: JSON.stringify(body) });
      if (!res.ok) {
        setMessage((await readError(res)) || 'We couldn’t save that. Please try again.');
      } else {
        await mutate(await res.json(), { revalidate: false });
      }
    } catch {
      setMessage('We couldn’t save that. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const shown = showAll ? data.upcoming : data.upcoming.slice(0, FIRST_SHOWN);
  const labelOf = (key: string) => data.nations.find((n) => n.key === key)?.label || key;
  const nationLabel = labelOf(data.nation);
  const weeks = Math.round(data.upcomingDays / 7);

  return (
    <section
      className="flex flex-col gap-[16px] rounded-[18px] border border-newBorder bg-newBgColor p-[20px]"
      data-testid="uk-dates"
    >
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[17px] font-[600]">UK dates in your posts</h2>
        <p className="text-[14px] leading-[1.6] text-textItemBlur">
          When a bank holiday or an occasion like Mother’s Day is coming up, we
          may mention it in a post, but only where it fits your business, and
          never to say you’re open or have something on. Every date links to
          where we checked it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-[24px] gap-y-[12px]">
        <label className="flex items-center gap-[10px] text-[14px]">
          <span>Dates for</span>
          <select
            value={data.nation}
            disabled={busy === 'settings'}
            onChange={(e) => save('settings', '/ours/seasonal/settings', { nation: e.target.value })}
            data-testid="uk-dates-nation"
            className="h-[34px] rounded-[8px] border border-newBorder bg-newBgColorInner px-[10px] text-[14px]"
          >
            {data.nations.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-[8px] text-[14px] cursor-pointer">
          <input
            type="checkbox"
            checked={data.enabled}
            disabled={busy === 'settings'}
            onChange={(e) => save('settings', '/ours/seasonal/settings', { enabled: e.target.checked })}
            data-testid="uk-dates-enabled"
            className="h-[16px] w-[16px] accent-btnPrimary"
          />
          <span>Suggest UK dates in my posts</span>
        </label>
      </div>
      {!data.chosen && (
        <p className="text-[13px] text-textItemBlur" data-testid="uk-dates-default-note">
          We’ve assumed your business is in {labelOf(data.defaultNation)}. Change
          it above if not: bank holidays differ across the UK.
        </p>
      )}

      {!data.enabled ? (
        <p className="text-[14px] text-textItemBlur" data-testid="uk-dates-off">
          Your posts won’t mention UK dates. Tick the box to turn them back on.
        </p>
      ) : !data.upcoming.length ? (
        <p className="text-[14px] text-textItemBlur" data-testid="uk-dates-empty">
          {newDayjs().add(data.upcomingDays, 'day').format('YYYY-MM-DD') > data.coversUntil
            ? `We’ve checked dates up to ${newDayjs(data.coversUntil).format('DD/MM/YYYY')} so far, so there’s nothing to show for the next ${weeks} weeks yet.`
            : `No UK dates for ${nationLabel} in the next ${weeks} weeks.`}
        </p>
      ) : (
        <div className="flex flex-col">
          <span className="text-[13px] text-textItemBlur">
            Next {weeks} weeks in {nationLabel}
          </span>
          <ul>
            {shown.map((item) => (
              <DateRow
                key={item.id}
                item={item}
                disabled={!!busy && busy !== item.id}
                busy={busy === item.id}
                onToggle={() => save(item.id, `/ours/seasonal/dates/${item.key}`, { skip: !item.skipped })}
              />
            ))}
          </ul>
          {data.upcoming.length > FIRST_SHOWN && (
            <button
              type="button"
              className="self-start text-[14px] underline"
              onClick={() => setShowAll(!showAll)}
              data-testid="uk-dates-show-all"
            >
              {showAll ? 'Show fewer' : `Show all ${data.upcoming.length}`}
            </button>
          )}
        </div>
      )}

      <p className="text-[12px] text-textItemBlur">
        Dates checked on {newDayjs(data.checkedOn).format('DD/MM/YYYY')}. Skipping a date skips it every year, along with any substitute bank holiday of the same name.
      </p>
      {message && (
        <div role="alert" className="text-[14px]">
          {message}
        </div>
      )}
    </section>
  );
};
