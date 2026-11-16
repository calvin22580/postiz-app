// OURS: Milestone 8. Turns the numbers platforms report for each approved post
// into a short, honest "what worked" summary, and into preferences the
// caption writer may lean on. Results only ever choose between kinds of post
// the business profile already supports; they are never facts to state.
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SIMULATED_PREFIX } from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.config';
import {
  CAPTION_PLATFORMS,
  POSTING_DAYS,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  GRAPHIC_LAYOUTS,
  layoutForDay,
} from '@gitroom/nestjs-libraries/ours/graphics/graphic.content';

dayjs.extend(utc);
dayjs.extend(timezone);

// Below these, the screen says there isn't enough to go on yet. One week is
// 15 posts, so the summary starts after about two weeks of posting.
export const MIN_MEASURED_POSTS = 20;
export const MIN_GROUP_POSTS = 5;

// ---------------------------------------------------------------------------
// Reading what a platform reported
// ---------------------------------------------------------------------------

// Labels as upstream's providers name them. Reach: the first one found, in
// this order. Interactions: the sum of all found. Ratios and breakdowns
// ("Engagement", "Clicks by Type") are left out so nothing is counted twice.
const REACH_LABELS = ['reach', 'unique impressions', 'impressions', 'views'];
const INTERACTION_LABELS = [
  'reactions',
  'likes',
  'comments',
  'shares',
  'saves',
  'replies',
  'reposts',
  'retweets',
  'quotes',
  'bookmarks',
  'clicks',
];

export interface PostMetrics {
  reach: number | null;
  interactions: number | null;
  simulated: boolean;
  // every metric reported, by its label (the Simulated prefix removed)
  metrics: Record<string, number>;
}

export const readMetrics = (data: AnalyticsData[]): PostMetrics | null => {
  const metrics: Record<string, number> = {};
  let simulated = false;
  for (const item of data || []) {
    if (!item?.label) continue;
    let label = item.label;
    if (label.startsWith(SIMULATED_PREFIX)) {
      simulated = true;
      label = label.slice(SIMULATED_PREFIX.length);
    }
    const total = (item.data || []).reduce((sum, d) => {
      const n = Number(d?.total);
      return Number.isFinite(n) && n > 0 ? sum + n : sum;
    }, 0);
    metrics[label] = (metrics[label] || 0) + Math.round(total);
  }
  const byLower = new Map(Object.entries(metrics).map(([k, v]) => [k.toLowerCase(), v]));
  const reachLabel = REACH_LABELS.find((l) => byLower.has(l));
  const found = INTERACTION_LABELS.filter((l) => byLower.has(l));
  if (!reachLabel && !found.length) {
    return null;
  }
  return {
    reach: reachLabel ? byLower.get(reachLabel)! : null,
    interactions: found.length ? found.reduce((s, l) => s + byLower.get(l)!, 0) : null,
    simulated,
    metrics,
  };
};

// ---------------------------------------------------------------------------
// Kinds of post, from the profile facts a caption was built on
// ---------------------------------------------------------------------------

export const POST_KINDS = [
  { key: 'uk-date', label: 'UK dates and occasions', hint: 'posts tied to one of the UK dates you are given', fields: ['seasonal'] },
  { key: 'service', label: 'Spotlights on a service', hint: 'posts about one of the services', fields: ['services'] },
  { key: 'stand-out', label: 'What sets you apart', hint: 'posts built on one of the highlights', fields: ['highlights'] },
  { key: 'contact', label: 'How to get in touch', hint: 'posts sharing the phone number, email, address or opening hours', fields: ['phone', 'email', 'address', 'openingHours'] },
  { key: 'where', label: 'Where to find you', hint: 'posts about the location or the area served', fields: ['location', 'serviceArea'] },
  { key: 'about', label: 'About the business', hint: 'introductions to what the business does', fields: ['whatTheyDo'] },
] as const;

export type PostKind = (typeof POST_KINDS)[number]['key'] | 'other';

export const postKind = (facts: { field?: string }[]): PostKind => {
  const fields = new Set((facts || []).map((f) => f?.field));
  return POST_KINDS.find((k) => k.fields.some((f) => fields.has(f)))?.key || 'other';
};

export const kindLabel = (kind: string) =>
  POST_KINDS.find((k) => k.key === kind)?.label || 'Other posts';

// ---------------------------------------------------------------------------
// The summary
// ---------------------------------------------------------------------------

export interface MeasuredPost {
  draftId: string;
  platform: string;
  scheduledFor: Date;
  theme: string;
  facts: { field?: string }[];
  // the owner's layout choice (null = automatic, "none" = no graphic) and
  // whether a graphic was attached when it was approved
  graphicLayout: string | null;
  hadGraphic: boolean;
  reach: number | null;
  interactions: number;
  simulated: boolean;
}

export type Verdict = 'better' | 'worse' | 'no-difference' | 'too-few';

export interface InsightGroup {
  key: string;
  label: string;
  posts: number;
  // about how many times a typical post's interactions (1 = typical)
  ratio: number | null;
  verdict: Verdict;
}

export interface InsightDimension {
  key: 'kind' | 'day' | 'platform' | 'layout';
  title: string;
  groups: InsightGroup[];
}

const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

// Two-sided 99% t values for small samples (degrees of freedom → value).
// 99% rather than 95% because each summary makes about twenty comparisons,
// and a false "did better" would steer the writer.
const T_99: [number, number][] = [
  [1, 63.66], [2, 9.92], [3, 5.84], [4, 4.6], [5, 4.03], [6, 3.71], [7, 3.5],
  [8, 3.36], [9, 3.25], [10, 3.17], [15, 2.95], [20, 2.85], [30, 2.75], [60, 2.66],
];
const tValue = (df: number) =>
  [...T_99].reverse().find(([d]) => df >= d)?.[1] ?? T_99[0][1];

const weekdayIndex = (date: Date, tz: string) => (dayjs(date).tz(tz).day() + 6) % 7;

const layoutKey = (p: MeasuredPost, tz: string) =>
  p.hadGraphic ? layoutForDay(p.graphicLayout, weekdayIndex(p.scheduledFor, tz)) || 'none' : 'none';

// How a group compares with the rest of the business's posts. Each post is
// first compared with the typical post on its own platform (platforms differ
// a lot in size), on a log scale so one viral post can't decide everything.
// The group is then compared with all the other posts (Welch's t-test): it
// only "did better" or "did worse" when the whole 99% range is on one side.
const meanAndVariance = (xs: number[]) => {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.length > 1 ? xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1) : 0;
  return { mean, variance };
};

export const compareGroup = (
  scores: number[],
  rest: number[]
): Pick<InsightGroup, 'ratio' | 'verdict'> => {
  if (scores.length < MIN_GROUP_POSTS || rest.length < MIN_GROUP_POSTS) {
    return { ratio: null, verdict: 'too-few' };
  }
  const a = meanAndVariance(scores);
  const b = meanAndVariance(rest);
  const va = a.variance / scores.length;
  const vb = b.variance / rest.length;
  const diff = a.mean - b.mean;
  const se = Math.sqrt(va + vb);
  const df = se > 0 ? (va + vb) ** 2 / ((va ** 2) / (scores.length - 1) + (vb ** 2) / (rest.length - 1)) : 1;
  const margin = tValue(Math.floor(df)) * se;
  const ratio = Math.round(Math.exp(diff) * 10) / 10;
  if (diff - margin > 0 && ratio > 1) return { ratio, verdict: 'better' };
  if (diff + margin < 0 && ratio < 1) return { ratio, verdict: 'worse' };
  return { ratio, verdict: 'no-difference' };
};

export const summarise = (posts: MeasuredPost[], tz: string) => {
  // a post is compared with the typical (median) post on its platform
  const typical = new Map<string, number>();
  for (const platform of new Set(posts.map((p) => p.platform))) {
    typical.set(platform, median(posts.filter((p) => p.platform === platform).map((p) => p.interactions)));
  }
  const score = (p: MeasuredPost) => Math.log((p.interactions + 1) / (typical.get(p.platform)! + 1));

  const dimension = (
    key: InsightDimension['key'],
    title: string,
    order: { key: string; label: string }[],
    of: (p: MeasuredPost) => string
  ): InsightDimension => ({
    key,
    title,
    groups: order
      .map(({ key: groupKey, label }) => {
        const scores = posts.filter((p) => of(p) === groupKey).map(score);
        const rest = posts.filter((p) => of(p) !== groupKey).map(score);
        return { key: groupKey, label, posts: scores.length, ...compareGroup(scores, rest) };
      })
      .filter((g) => g.posts > 0),
  });

  const dimensions: InsightDimension[] = [
    dimension(
      'kind',
      'Kinds of post',
      [...POST_KINDS.map((k) => ({ key: k.key as string, label: k.label as string })), { key: 'other', label: 'Other posts' }],
      (p) => postKind(p.facts)
    ),
    dimension(
      'day',
      'Days',
      POSTING_DAYS.map((d, i) => ({ key: String(i), label: d as string })),
      (p) => String(weekdayIndex(p.scheduledFor, tz))
    ),
    dimension(
      'platform',
      'Platforms',
      CAPTION_PLATFORMS.map((p) => ({ key: p.key as string, label: p.label as string })),
      (p) => p.platform
    ),
    dimension(
      'layout',
      'Graphics',
      [...GRAPHIC_LAYOUTS.map((l) => ({ key: l.key as string, label: l.label as string })), { key: 'none', label: 'No graphic' }],
      (p) => layoutKey(p, tz)
    ),
  ];

  // Platforms are compared within themselves above, so across platforms we
  // show the typical numbers instead of a verdict.
  const platforms = CAPTION_PLATFORMS.filter((p) => typical.has(p.key)).map((p) => {
    const mine = posts.filter((x) => x.platform === p.key);
    const reaches = mine.map((x) => x.reach).filter((r): r is number => r !== null);
    return {
      key: p.key,
      label: p.label,
      posts: mine.length,
      typicalInteractions: Math.round(typical.get(p.key)!),
      typicalReach: reaches.length ? Math.round(median(reaches)) : null,
    };
  });

  return {
    enough: posts.length >= MIN_MEASURED_POSTS,
    dimensions: dimensions.filter((d) => d.key !== 'platform'),
    platforms,
  };
};

// What the caption writer may lean on: kinds of post that clearly did better
// or worse. Nothing when there isn't enough data.
export interface WriterPreferences {
  favour: { key: string; label: string; hint: string }[];
  avoid: { key: string; label: string; hint: string }[];
  simulated: boolean;
  basedOn: number;
}

export const preferencesFrom = (
  summary: ReturnType<typeof summarise>,
  simulated: boolean,
  basedOn: number
): WriterPreferences | null => {
  if (!summary.enough) return null;
  const kinds = summary.dimensions.find((d) => d.key === 'kind')?.groups || [];
  const pick = (verdict: Verdict) =>
    kinds
      .filter((g) => g.verdict === verdict && g.key !== 'other')
      .map((g) => {
        const kind = POST_KINDS.find((k) => k.key === g.key)!;
        return { key: kind.key, label: kind.label, hint: kind.hint };
      });
  const favour = pick('better');
  const avoid = pick('worse');
  if (!favour.length && !avoid.length) return null;
  return { favour, avoid, simulated, basedOn };
};
