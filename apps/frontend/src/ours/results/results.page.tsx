'use client';
// OURS: "What worked" (Milestone 8). How the owner's approved posts did, in
// plain words, and what next week's posts will lean towards. Says so plainly
// when there isn't enough to go on, and labels simulated Sandbox results.
import { FC } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import {
  listOf,
  PostResults,
  ResultGroup,
  usePostResults,
} from '@gitroom/frontend/ours/results/results.hooks';
import { SearchSection } from '@gitroom/frontend/ours/search/search.section';

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
};

const formatDate = (date: string) => newDayjs(date).format('DD/MM/YYYY');
const count = (n: number) => new Intl.NumberFormat('en-GB').format(n);

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 bg-newBgColorInner overflow-auto p-[40px] mobile:p-[16px]">
    <div className="max-w-[820px] mx-auto flex flex-col gap-[28px]">{children}</div>
  </div>
);

const Card: FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <section
    data-testid={testId}
    className="flex flex-col gap-[16px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px] mobile:p-[16px]"
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
    data-testid={testId}
    className={clsx(
      'rounded-[10px] border px-[16px] py-[12px] text-[14px] leading-[1.6]',
      tone === 'attention' ? 'border-amber-500/40 bg-amber-500/10' : 'border-newBorder bg-newBgColor'
    )}
  >
    {children}
  </div>
);

const verdictText = (g: ResultGroup, minGroup: number) => {
  switch (g.verdict) {
    case 'better':
      return `Did better: about ${g.ratio}× the interactions of your other posts`;
    case 'worse':
      return `Did worse: about ${g.ratio}× the interactions of your other posts`;
    case 'no-difference':
      return 'No clear difference yet';
    default:
      return `Too few posts to say (needs ${minGroup})`;
  }
};

// The headline findings, as sentences.
const Findings: FC<{ data: PostResults }> = ({ data }) => {
  const notable = data.dimensions.flatMap((d) =>
    d.groups.filter((g) => g.verdict === 'better' || g.verdict === 'worse').map((g) => ({ ...g, dimension: d.key }))
  );
  const subject = (g: (typeof notable)[number]) =>
    g.dimension === 'kind'
      ? `“${g.label}” posts`
      : g.dimension === 'day'
      ? `Posts on ${g.label}s`
      : g.key === 'none'
      ? 'Posts without a graphic'
      : `Posts with the “${g.label}” graphic`;
  return (
    <Card testId="results-findings">
      <h2 className="text-[17px] font-[600]">What we found</h2>
      {notable.length ? (
        <ul className="flex flex-col gap-[10px]">
          {notable.map((g) => (
            <li key={`${g.dimension}-${g.key}`} className="flex gap-[10px] text-[15px] leading-[1.6]">
              <span
                aria-hidden
                className={clsx(
                  'mt-[9px] h-[8px] w-[8px] shrink-0 rounded-full',
                  g.verdict === 'better' ? 'bg-btnPrimary' : 'bg-amber-500'
                )}
              />
              <span>
                {subject(g)} got about {g.ratio}× the interactions of your other posts ({g.posts} posts).
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] leading-[1.6]" data-testid="results-no-difference">
          No clear differences yet. Your posts are doing about the same as each other so far, so we’re not
          changing anything.
        </p>
      )}
      <p className="text-[13px] leading-[1.6] text-textItemBlur">
        We only call something better or worse when the difference is clear across at least{' '}
        {data.minGroupPosts} posts, and big enough that it’s very unlikely to be chance. Each post is first
        compared with your usual post on the same platform. Days and
        graphics can overlap (each day has its own automatic graphic), so read them together.
      </p>
    </Card>
  );
};

const NextWeek: FC<{ data: PostResults }> = ({ data }) => {
  const prefs = data.preferences;
  return (
    <Card testId="results-next-week">
      <h2 className="text-[17px] font-[600]">Next week’s posts</h2>
      {prefs && prefs.applied ? (
        <p className="text-[15px] leading-[1.6]">
          {prefs.favour.length > 0 &&
            `We’ll aim for more ${listOf(prefs.favour.map((k) => `“${k.label}”`))} posts where your profile has something to say. `}
          {prefs.avoid.length > 0 && `We’ll aim for fewer ${listOf(prefs.avoid.map((k) => `“${k.label}”`))} posts. `}
          You still approve every post.
        </p>
      ) : (
        <p className="text-[15px] leading-[1.6]">
          {prefs && !prefs.applied
            ? 'These simulated results won’t change your posts.'
            : 'Nothing changes yet: we write next week’s posts as usual.'}
        </p>
      )}
      <p className="text-[13px] leading-[1.6] text-textItemBlur">
        Results only help us choose between ideas from your business profile. They never add new claims, and we
        never mention likes or results in your posts.
      </p>
    </Card>
  );
};

const Breakdown: FC<{ data: PostResults }> = ({ data }) => (
  <Card testId="results-breakdown">
    <h2 className="text-[17px] font-[600]">In detail</h2>
    {data.dimensions
      .filter((d) => d.groups.length)
      .map((d) => (
        <div key={d.key} className="flex flex-col gap-[8px]">
          <h3 className="text-[14px] font-[600] text-textItemBlur">{d.title}</h3>
          <ul className="flex flex-col divide-y divide-newBorder rounded-[10px] border border-newBorder">
            {d.groups.map((g) => (
              <li
                key={g.key}
                data-testid={`results-group-${d.key}-${g.key}`}
                data-verdict={g.verdict}
                className="flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[2px] px-[14px] py-[10px]"
              >
                <span className="text-[15px]">
                  {g.label}{' '}
                  <span className="text-[13px] text-textItemBlur tabular-nums">
                    · {g.posts} {g.posts === 1 ? 'post' : 'posts'}
                  </span>
                </span>
                <span
                  className={clsx(
                    'text-[14px]',
                    g.verdict === 'better' ? 'text-btnPrimary' : g.verdict === 'worse' ? 'text-amber-600' : 'text-textItemBlur'
                  )}
                >
                  {verdictText(g, data.minGroupPosts)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    <div className="flex flex-col gap-[8px]">
      <h3 className="text-[14px] font-[600] text-textItemBlur">Platforms</h3>
      <ul className="flex flex-col divide-y divide-newBorder rounded-[10px] border border-newBorder">
        {data.platforms.map((p) => (
          <li
            key={p.key}
            className="flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[2px] px-[14px] py-[10px]"
          >
            <span className="text-[15px]">
              {p.label}{' '}
              <span className="text-[13px] text-textItemBlur tabular-nums">· {p.posts} posts</span>
            </span>
            <span className="text-[14px] text-textItemBlur tabular-nums">
              A usual post: {count(p.typicalInteractions)} interactions
              {p.typicalReach !== null ? `, seen by ${count(p.typicalReach)}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[13px] leading-[1.6] text-textItemBlur">
        Each platform posts at its own fixed time, so platforms aren’t compared with each other.
      </p>
    </div>
  </Card>
);

const Recent: FC<{ data: PostResults }> = ({ data }) => (
  <Card testId="results-recent">
    <h2 className="text-[17px] font-[600]">Latest results</h2>
    <ul className="flex flex-col divide-y divide-newBorder">
      {data.recent.map((p) => (
        <li key={p.draftId} className="flex flex-col gap-[4px] py-[10px]" data-testid="results-post">
          <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px] text-[13px] text-textItemBlur">
            <span>{formatDate(p.scheduledFor)}</span>
            <span>{PLATFORM_LABELS[p.platform] || p.platform}</span>
            <span>{p.kind}</span>
            {p.simulated && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-[8px] text-amber-700">
                Simulated
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-[16px]">
            <span className="text-[15px]">{p.theme}</span>
            <span className="text-[14px] tabular-nums" data-testid="results-post-numbers">
              {count(p.interactions)} interactions
              {p.reach !== null ? ` · seen by ${count(p.reach)}` : ''}
            </span>
          </div>
        </li>
      ))}
    </ul>
  </Card>
);

const Progress: FC<{ data: PostResults }> = ({ data }) => {
  const share = Math.min(1, data.measuredPosts / data.minPosts);
  return (
    <Card testId="results-not-enough">
      <h2 className="text-[17px] font-[600]">Not enough results yet</h2>
      <p className="text-[15px] leading-[1.6]">
        We have results for {data.measuredPosts} {data.measuredPosts === 1 ? 'post' : 'posts'}. We need about{' '}
        {data.minPosts} (around two weeks of posting) before we can say what works for you, so for now we won’t
        change anything.
      </p>
      <div
        className="h-[8px] rounded-full bg-newBgLineColor overflow-hidden"
        role="progressbar"
        aria-label="Posts with results"
        aria-valuemin={0}
        aria-valuemax={data.minPosts}
        aria-valuenow={data.measuredPosts}
      >
        <div className="h-full rounded-full bg-btnPrimary" style={{ width: `${share * 100}%` }} />
      </div>
    </Card>
  );
};

const Results: FC<{ data: PostResults }> = ({ data }) => {
  if (!data.approvedPosts) {
    return (
      <Card testId="results-empty">
        <h2 className="text-[17px] font-[600]">Nothing to look at yet</h2>
        <p className="text-[15px] leading-[1.6]">
          Once posts you’ve approved have gone out, we check how each one did and show you here what worked.
        </p>
        <Link href="/captions" className="text-[15px] underline w-fit">
          Go to your weekly posts
        </Link>
      </Card>
    );
  }
  if (!data.measuredPosts) {
    return (
      <Card testId="results-waiting">
        <h2 className="text-[17px] font-[600]">Waiting for the first results</h2>
        <p className="text-[15px] leading-[1.6]">
          You’ve approved {data.approvedPosts} {data.approvedPosts === 1 ? 'post' : 'posts'}. Platforms usually
          report how a post did within a day of it going out. We check again each time you open this page.
        </p>
      </Card>
    );
  }
  return (
    <>
      {data.enough ? <Findings data={data} /> : <Progress data={data} />}
      <NextWeek data={data} />
      {data.enough && <Breakdown data={data} />}
      <Recent data={data} />
    </>
  );
};

export const ResultsPage: FC = () => {
  const { data, error, mutate } = usePostResults();

  return (
    <Shell>
      <div className="flex flex-col gap-[6px]">
        <h1 className="text-[26px] font-[600]" data-testid="results-heading">
          What worked
        </h1>
        <p className="text-[15px] leading-[1.6] text-textItemBlur">
          How your approved posts did, and what we’ll lean towards next.
        </p>
      </div>
      {/* "How people find you" (D1): hidden unless OURS_SEARCH_REPORT is on */}
      <SearchSection />
      {error ? (
        <Notice testId="results-error">
          We couldn’t load your results.{' '}
          <button type="button" className="underline" onClick={() => mutate()}>
            Try again
          </button>
        </Notice>
      ) : !data ? (
        <div className="flex flex-col gap-[16px]" aria-busy="true">
          <div className="h-[120px] rounded-[14px] bg-newBgLineColor animate-pulse" />
          <div className="h-[220px] rounded-[14px] bg-newBgLineColor animate-pulse" />
        </div>
      ) : (
        <>
          {data.source === 'simulated' && (
            <Notice tone="attention" testId="results-simulated">
              Simulated results: these numbers come from the Sandbox channel and are made up for testing. No real
              people saw these posts.
            </Notice>
          )}
          {data.simulatedLeftOut > 0 && (
            <Notice testId="results-simulated-left-out">
              {data.simulatedLeftOut} simulated Sandbox {data.simulatedLeftOut === 1 ? 'result is' : 'results are'}{' '}
              left out, because you have real results now.
            </Notice>
          )}
          <Results data={data} />
        </>
      )}
    </Shell>
  );
};
