'use client';
// OURS: "How people find you" D1, the searches that matter. We suggest Google
// searches from the business profile, each with how many people make it a
// month; the owner chooses which ones we watch, and can add their own.
// Simulated figures (no DataForSEO login) are labelled as such.
import { FC, FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { SearchOverview, TrackedSearch, useSearchOverview } from '@gitroom/frontend/ours/search/search.hooks';

type Ready = Extract<SearchOverview, { enabled: true }>;

const count = (n: number) => new Intl.NumberFormat('en-GB').format(n);

// wider topics shown before "Show all"
const FIRST_TOPICS = 5;

const demandText = (s: TrackedSearch, market: string) =>
  s.searchVolume !== null
    ? `About ${count(s.searchVolume)} searches a month in ${market}`
    : s.origin === 'owner'
    ? 'Monthly searches not checked yet'
    : 'Too few searches to measure';

const SearchRow: FC<{
  item: TrackedSearch;
  market: string;
  action: string;
  busy: boolean;
  disabled: boolean;
  onAction: () => void;
  picker?: { checked: boolean; onChange: (checked: boolean) => void };
}> = ({ item, market, action, busy, disabled, onAction, picker }) => (
  <li
    className="flex items-center justify-between gap-[12px] border-t border-newBorder py-[12px] first:border-t-0"
    data-testid="search-row"
    data-keyword={item.keyword}
  >
    <label className={clsx('flex items-start gap-[12px] min-w-0', picker && 'cursor-pointer')}>
      {picker && (
        <input
          type="checkbox"
          checked={picker.checked}
          disabled={disabled}
          onChange={(e) => picker.onChange(e.target.checked)}
          data-testid="search-pick"
          className="mt-[3px] h-[16px] w-[16px] shrink-0 accent-btnPrimary"
        />
      )}
      <span className="flex flex-col gap-[2px] min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
          <span className="text-[15px] font-[600] break-words">{item.keyword}</span>
          {item.kind === 'local' && !picker && <span className="text-[12px] text-textItemBlur">Local</span>}
        </span>
        <span className="text-[13px] text-textItemBlur">{demandText(item, market)}</span>
      </span>
    </label>
    <button
      type="button"
      onClick={onAction}
      disabled={disabled || busy}
      data-testid="search-remove"
      className={clsx(
        'h-[32px] shrink-0 px-[12px] rounded-[8px] border border-newBorder text-[13px] whitespace-nowrap hover:bg-newBgColorInner',
        (disabled || busy) && 'opacity-60'
      )}
    >
      {busy ? 'Saving…' : action}
    </button>
  </li>
);

const Searches: FC<{ data: Ready }> = ({ data }) => {
  const fetch = useFetch();
  const { mutate } = useSearchOverview();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [own, setOwn] = useState('');
  // null until the owner changes a tick: local searches start ticked, as many
  // as the plan has room for
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [allTopics, setAllTopics] = useState(false);

  const room = Math.max(0, data.limit - data.tracked.length);
  const defaultPicked = useMemo(
    () => new Set(data.suggestions.filter((s) => s.kind === 'local').slice(0, room).map((s) => s.id)),
    [data.suggestions, room]
  );
  const chosen = picked ?? defaultPicked;

  const send = async (kind: string, path: string, method: string, body?: object) => {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!res.ok) {
        setMessage((await readError(res)) || 'We couldn’t do that. Please try again.');
        return false;
      }
      await mutate(await res.json(), { revalidate: false });
      return true;
    } catch {
      setMessage('We couldn’t do that. Please try again.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const suggest = async () => {
    if (await send('suggest', '/ours/search/suggest', 'POST')) setPicked(null);
  };
  const track = async () => {
    if (await send('track', '/ours/search/track', 'POST', { ids: [...chosen] })) setPicked(null);
  };
  const addOwn = async (e: FormEvent) => {
    e.preventDefault();
    if (own.trim() && (await send('add', '/ours/search/add', 'POST', { keyword: own }))) setOwn('');
  };
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(chosen);
    if (checked) next.add(id);
    else next.delete(id);
    setPicked(next);
  };

  const canSuggest = !data.nextSuggestAt;
  const suggestLater = data.nextSuggestAt
    ? `You can ask for fresh suggestions again after ${newDayjs(data.nextSuggestAt).format('DD/MM/YYYY HH:mm')}.`
    : null;

  return (
    <>
      <div className="flex flex-col gap-[4px]" data-testid="search-tracked">
        <h3 className="text-[15px] font-[600]">
          Watching {data.tracked.length} of {data.limit}
        </h3>
        {data.tracked.length ? (
          <ul>
            {data.tracked.map((s) => (
              <SearchRow
                key={s.id}
                item={s}
                market={data.market}
                action="Stop watching"
                busy={busy === s.id}
                disabled={!!busy && busy !== s.id}
                onAction={() => send(s.id, `/ours/search/${s.id}`, 'DELETE')}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-textItemBlur" data-testid="search-none-tracked">
            You’re not watching any searches yet. Choose some below.
          </p>
        )}
      </div>

      {!data.profile.ready ? (
        <p className="text-[15px] leading-[1.6]" data-testid="search-no-profile">
          We suggest searches from the services and town in your business profile.{' '}
          <Link href="/business-profile" className="underline">
            Build your business profile
          </Link>{' '}
          first, or add your own searches below.
        </p>
      ) : !data.suggestions.length && !data.profile.services ? (
        <p className="text-[15px] leading-[1.6]" data-testid="search-no-services">
          Your business profile doesn’t list any services yet, so we can’t suggest searches.{' '}
          <Link href="/business-profile" className="underline">
            Add your services
          </Link>{' '}
          and come back, or add your own searches below.
        </p>
      ) : data.suggestions.length ? (
        <div className="flex flex-col gap-[8px]" data-testid="search-suggestions">
          <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
            <h3 className="text-[15px] font-[600]">Suggested for you</h3>
            {canSuggest && (
              <button
                type="button"
                className="text-[14px] underline"
                disabled={!!busy}
                onClick={suggest}
                data-testid="search-suggest-again"
              >
                {busy === 'suggest' ? 'Looking up searches…' : 'Get fresh suggestions'}
              </button>
            )}
          </div>
          {[
            { key: 'local', title: 'Near you', rows: data.suggestions.filter((s) => s.kind === 'local') },
            { key: 'topic', title: 'Wider topics people search for', rows: data.suggestions.filter((s) => s.kind !== 'local') },
          ]
            .filter((group) => group.rows.length)
            .map((group) => {
              const shown = group.key === 'topic' && !allTopics ? group.rows.slice(0, FIRST_TOPICS) : group.rows;
              return (
                <div key={group.key} className="flex flex-col" data-testid={`search-group-${group.key}`}>
                  <span className="text-[13px] text-textItemBlur">{group.title}</span>
                  <ul>
                    {shown.map((s) => (
                      <SearchRow
                        key={s.id}
                        item={s}
                        market={data.market}
                        action="Not for me"
                        busy={busy === s.id}
                        disabled={!!busy && busy !== s.id}
                        onAction={() => send(s.id, `/ours/search/${s.id}`, 'DELETE')}
                        picker={{ checked: chosen.has(s.id), onChange: (checked) => toggle(s.id, checked) }}
                      />
                    ))}
                  </ul>
                  {group.rows.length > shown.length || (group.key === 'topic' && allTopics && group.rows.length > FIRST_TOPICS) ? (
                    <button
                      type="button"
                      className="self-start text-[14px] underline"
                      onClick={() => setAllTopics(!allTopics)}
                      data-testid="search-show-all"
                    >
                      {allTopics ? 'Show fewer' : `Show all ${group.rows.length}`}
                    </button>
                  ) : null}
                </div>
              );
            })}
          <div className="flex flex-wrap items-center gap-[12px]">
            <button
              type="button"
              onClick={track}
              disabled={!!busy || !chosen.size || chosen.size > room}
              data-testid="search-track"
              className={clsx(
                'h-[44px] px-[20px] rounded-[10px] bg-btnPrimary text-white text-[15px] font-[500] whitespace-nowrap',
                (!!busy || !chosen.size || chosen.size > room) && 'opacity-60'
              )}
            >
              {busy === 'track'
                ? 'Saving…'
                : !chosen.size
                ? 'Tick searches to watch'
                : `Watch ${chosen.size} ${chosen.size === 1 ? 'search' : 'searches'}`}
            </button>
            <span className="text-[13px] text-textItemBlur">
              {chosen.size > room ? data.limitMessage : `Room for ${room} more on your plan.`}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[10px]" data-testid="search-suggest-start">
          <p className="text-[15px] leading-[1.6]">
            We’ll look up searches for the{' '}
            {data.profile.services === 1 ? 'service' : `${data.profile.services} services`} in your profile
            {data.profile.town ? `, in and around ${data.profile.town}` : ''}, and how many people make each
            one.
          </p>
          <button
            type="button"
            onClick={suggest}
            disabled={!!busy || !canSuggest}
            data-testid="search-suggest"
            className={clsx(
              'self-start h-[44px] px-[20px] rounded-[10px] bg-btnPrimary text-white text-[15px] font-[500] whitespace-nowrap',
              (!!busy || !canSuggest) && 'opacity-60'
            )}
          >
            {busy === 'suggest' ? 'Looking up searches…' : 'Suggest searches'}
          </button>
        </div>
      )}
      {suggestLater && <p className="text-[13px] text-textItemBlur">{suggestLater}</p>}

      <form onSubmit={addOwn} className="flex flex-col gap-[8px]" data-testid="search-add">
        <label htmlFor="ours-own-search" className="text-[14px] font-[500]">
          Add a search of your own
        </label>
        <div className="flex gap-[10px] mobile:flex-col">
          <input
            id="ours-own-search"
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            placeholder={
              data.profile.town
                ? `for example, florist ${data.profile.town.toLowerCase()}`
                : 'for example, florist near me'
            }
            maxLength={200}
            className="flex-1 mobile:flex-none h-[44px] rounded-[10px] border border-newBorder bg-newBgColor px-[14px] text-[15px] outline-none focus:border-btnPrimary"
          />
          <button
            type="submit"
            disabled={!!busy || !own.trim()}
            className={clsx(
              'h-[44px] px-[18px] rounded-[10px] border border-newBorder text-[15px] whitespace-nowrap hover:bg-newBgColorInner',
              (!!busy || !own.trim()) && 'opacity-60'
            )}
          >
            {busy === 'add' ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      {message && (
        <div role="alert" className="text-[14px]" data-testid="search-message">
          {message}
        </div>
      )}
      <p className="text-[12px] leading-[1.6] text-textItemBlur">
        Monthly searches are Google’s average for {data.market}
        {data.simulated ? ' (simulated here)' : ', from DataForSEO'}. Small local searches often have too few to
        measure, but they can still bring you customers. Searches only guide what we watch and write about: they
        never become claims about your business.
      </p>
    </>
  );
};

export const SearchSection: FC = () => {
  const { data, error, mutate } = useSearchOverview();

  if (error) {
    return (
      <div className="rounded-[14px] border border-newBorder bg-newBgColor p-[20px] text-[14px]" data-testid="search-error">
        We couldn’t load your searches.{' '}
        <button type="button" className="underline" onClick={() => mutate()}>
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return <div className="h-[160px] rounded-[14px] bg-newBgLineColor animate-pulse" aria-busy="true" />;
  }
  if (!data.enabled) {
    return null;
  }
  return (
    <section
      className="flex flex-col gap-[16px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px] mobile:p-[16px]"
      data-testid="search-section"
    >
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[17px] font-[600]">Searches that matter</h2>
        <p className="text-[14px] leading-[1.6] text-textItemBlur">
          The Google searches we’ll watch for you, to see whether people can find you. We suggest them from your
          business profile; you choose.
        </p>
      </div>
      {data.simulated && (
        <div
          className="rounded-[10px] border border-amber-500/40 bg-amber-500/10 px-[16px] py-[12px] text-[14px] leading-[1.6]"
          data-testid="search-simulated"
        >
          Simulated search figures: these numbers are made up for testing. They don’t show what real people search
          for.
        </div>
      )}
      <Searches data={data} />
    </section>
  );
};
