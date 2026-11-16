// OURS: Milestone 8 unit tests. Run from the repo root:
//   pnpm exec vitest run --config ours/vitest.config.mts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  compareGroup,
  MeasuredPost,
  MIN_MEASURED_POSTS,
  postKind,
  preferencesFrom,
  readMetrics,
  summarise,
} from '@gitroom/nestjs-libraries/ours/performance/performance.insights';
import { simulatedAnalytics } from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.config';
import { SandboxProvider } from '@gitroom/nestjs-libraries/ours/sandbox/sandbox.provider';
import { PerformanceService } from '@gitroom/nestjs-libraries/ours/performance/performance.service';
import { DemoCaptionWriter } from '@gitroom/nestjs-libraries/ours/captions/writers/demo.caption.writer';
import { buildCaptionMessage } from '@gitroom/nestjs-libraries/ours/captions/writers/anthropic.caption.writer';
import { CaptionFact } from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import {
  assertDirectPostingAllowed,
  DIRECT_POSTING_REFUSED,
} from '@gitroom/nestjs-libraries/ours/approval/direct.posting';
import { DirectPostingGuard } from '../../../../../apps/backend/src/ours/direct.posting.guard';

vi.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({ PostsService: class {} }));

const series = (label: string, ...totals: (number | string)[]) => ({
  label,
  data: totals.map((total, i) => ({ total: String(total), date: `2026-11-0${i + 1}` })),
  percentageChange: 0,
});

describe('reading what a platform reported', () => {
  it('reads Facebook-style results without counting breakdowns twice', () => {
    const m = readMetrics([
      series('Impressions', 210),
      series('Reactions', 12),
      series('Clicks', 5),
      series('Clicks by Type', 5),
    ]);
    expect(m).toMatchObject({ reach: 210, interactions: 17, simulated: false });
  });

  it('prefers reach to impressions and leaves out engagement ratios', () => {
    const m = readMetrics([
      series('Views', 900),
      series('Reach', 300),
      series('Likes', 20),
      series('Comments', 3),
      series('Shares', 1),
      series('Saves', 2),
      series('Engagement', 26),
    ]);
    expect(m).toMatchObject({ reach: 300, interactions: 26 });
  });

  it('adds up daily series (LinkedIn) and ignores values that are not numbers', () => {
    const m = readMetrics([series('Unique Impressions', 40, 25), series('Likes', 2, 'x', -3, 1)]);
    expect(m).toMatchObject({ reach: 65, interactions: 3 });
  });

  it('marks Sandbox results as simulated and strips the label prefix', () => {
    const m = readMetrics(simulatedAnalytics('sandbox-abc', '2026-11-16'))!;
    expect(m.simulated).toBe(true);
    expect(Object.keys(m.metrics).sort()).toEqual(['Comments', 'Reach', 'Reactions', 'Shares']);
    expect(m.interactions).toBe(m.metrics.Reactions + m.metrics.Comments + m.metrics.Shares);
  });

  it('returns nothing when no metric it knows was reported', () => {
    expect(readMetrics([])).toBeNull();
    expect(readMetrics([series('Engagement', 0.4)])).toBeNull();
  });
});

describe('Sandbox simulated results', () => {
  it('are the same every time for a post, labelled Simulated, and look plausible', async () => {
    const a = simulatedAnalytics('sandbox-one', '2026-11-16');
    expect(simulatedAnalytics('sandbox-one', '2026-11-16')).toEqual(a);
    expect(simulatedAnalytics('sandbox-two', '2026-11-16')).not.toEqual(a);
    expect(a.every((x) => x.label.startsWith('Simulated '))).toBe(true);
    for (let i = 0; i < 50; i++) {
      const m = readMetrics(simulatedAnalytics(`sandbox-${i}`, '2026-11-16'))!;
      expect(m.reach).toBeGreaterThanOrEqual(40);
      expect(m.reach).toBeLessThanOrEqual(400);
      expect(m.interactions).toBeLessThan(m.reach!);
    }
    const fromProvider = await new SandboxProvider().postAnalytics('int', 'sandbox', 'sandbox-one');
    expect(fromProvider.map((x) => x.label)).toEqual(a.map((x) => x.label));
  });
});

describe('kinds of post', () => {
  it('come from the facts a caption was built on', () => {
    expect(postKind([{ field: 'businessName' }, { field: 'whatTheyDo' }, { field: 'seasonal' }])).toBe('uk-date');
    expect(postKind([{ field: 'businessName' }, { field: 'services' }])).toBe('service');
    expect(postKind([{ field: 'businessName' }, { field: 'phone' }, { field: 'openingHours' }])).toBe('contact');
    expect(postKind([{ field: 'businessName' }, { field: 'location' }])).toBe('where');
    expect(postKind([{ field: 'businessName' }, { field: 'whatTheyDo' }])).toBe('about');
    expect(postKind([{ field: 'businessName' }])).toBe('other');
    expect(postKind([])).toBe('other');
  });
});

describe('comparing a group with the rest', () => {
  const rest = [0.1, -0.1, 0.05, -0.05, 0, 0.2, -0.2];
  it('says nothing about fewer than five posts on either side', () => {
    expect(compareGroup([2, 2, 2, 2], rest)).toEqual({ ratio: null, verdict: 'too-few' });
    expect(compareGroup(rest, [1, 1, 1, 1])).toEqual({ ratio: null, verdict: 'too-few' });
  });

  it('only calls a difference when the whole 99% range is on one side', () => {
    expect(compareGroup([0.9, 1.0, 1.1, 0.8, 1.2], rest).verdict).toBe('better');
    expect(compareGroup([-0.9, -1.0, -1.1, -0.8, -1.2], rest).verdict).toBe('worse');
    // a big average driven by one post isn't enough
    expect(compareGroup([3, -0.4, 0.1, -0.3, 0.2], rest).verdict).toBe('no-difference');
  });

  it('compares with the other posts, not with zero, so a skewed business is not all "worse"', () => {
    // every score is below the platform median, as with many zero-interaction posts
    const others = [-0.5, -0.6, -0.4, -0.55, -0.45, -0.5];
    expect(compareGroup([-0.5, -0.45, -0.55, -0.6, -0.4], others).verdict).toBe('no-difference');
  });

  it('gives the ratio to the other posts', () => {
    expect(compareGroup([0.7, 0.69, 0.7, 0.69, 0.7], [0.01, 0, -0.01, 0, 0.01]).ratio).toBe(2);
  });
});

// A run of posts on Mondays to Fridays from 02/11/2026; services posts get
// three times the interactions of the rest.
const posts = (count: number, opts: { simulated?: boolean } = {}): MeasuredPost[] =>
  Array.from({ length: count }, (_, i) => {
    const platform = ['facebook', 'instagram', 'linkedin'][i % 3];
    const day = Math.floor(i / 3) % 5;
    const week = Math.floor(i / 15);
    const kind = Math.floor(i / 3) % 2 === 0 ? 'services' : 'location';
    const base = { facebook: 10, instagram: 20, linkedin: 4 }[platform]!;
    return {
      draftId: `d${i}`,
      platform,
      scheduledFor: new Date(Date.UTC(2026, 10, 2 + day + week * 7, 12, 30)),
      theme: kind,
      facts: [{ field: 'businessName' }, { field: kind }],
      graphicLayout: null,
      hadGraphic: true,
      reach: base * 20,
      interactions: (kind === 'services' ? base * 3 : base) + (i % 2),
      simulated: !!opts.simulated,
    };
  });

describe('the summary', () => {
  it('waits for enough posts before drawing conclusions', () => {
    const s = summarise(posts(MIN_MEASURED_POSTS - 1), 'Europe/London');
    expect(s.enough).toBe(false);
    expect(preferencesFrom(s, false, MIN_MEASURED_POSTS - 1)).toBeNull();
  });

  it('finds the kind of post that clearly did better, and the one that did worse', () => {
    const s = summarise(posts(30), 'Europe/London');
    expect(s.enough).toBe(true);
    const kinds = s.dimensions.find((d) => d.key === 'kind')!.groups;
    expect(kinds.find((g) => g.key === 'service')).toMatchObject({ verdict: 'better', posts: 15 });
    expect(kinds.find((g) => g.key === 'where')).toMatchObject({ verdict: 'worse', posts: 15 });
    const prefs = preferencesFrom(s, false, 30)!;
    expect(prefs.favour.map((k) => k.key)).toEqual(['service']);
    expect(prefs.avoid.map((k) => k.key)).toEqual(['where']);
  });

  it('compares posts within their own platform and shows typical numbers per platform', () => {
    const s = summarise(posts(30), 'Europe/London');
    expect(s.platforms.map((p) => p.key)).toEqual(['facebook', 'instagram', 'linkedin']);
    expect(s.platforms.find((p) => p.key === 'linkedin')).toMatchObject({ posts: 10, typicalReach: 80 });
    expect(s.dimensions.map((d) => d.key)).toEqual(['kind', 'day', 'layout']);
  });

  it('groups by UK weekday and by the graphic that was attached', () => {
    const list = posts(30).map((p, i) => (i < 3 ? { ...p, hadGraphic: false } : p));
    const s = summarise(list, 'Europe/London');
    const days = s.dimensions.find((d) => d.key === 'day')!.groups;
    expect(days.map((d) => d.label)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(days.every((d) => d.posts === 6)).toBe(true);
    const layouts = s.dimensions.find((d) => d.key === 'layout')!.groups;
    expect(layouts.find((g) => g.key === 'none')?.posts).toBe(3);
  });
});

describe('PerformanceService', () => {
  const NOW = new Date('2026-12-01T12:00:00Z').getTime();
  const HOUR = 60 * 60 * 1000;
  const approved = (i: number, daysAgo = 2) => ({
    id: `d${i}`,
    postId: `p${i}`,
    platform: 'facebook',
    scheduledFor: new Date(NOW - daysAgo * 24 * HOUR),
    theme: 'Spotlight',
    facts: [{ field: 'services' }],
    graphicLayout: null,
    graphicPath: null,
  });
  const make = (drafts: any[], results: any[] = []) => {
    const repo = {
      approvedPosts: vi.fn(async () => drafts),
      results: vi.fn(async () => results),
      markChecked: vi.fn(async () => undefined),
      saveResult: vi.fn(async () => undefined),
    };
    const posts = {
      checkPostAnalytics: vi.fn(async (_o: string, postId: string): Promise<any> => simulatedAnalytics(postId, '2026-12-01')),
    };
    return { repo, posts, service: new PerformanceService(repo as never, posts as never) };
  };
  afterEach(() => {
    delete process.env.SANDBOX_CHANNEL_ENABLED;
  });

  it('asks only for posts that are due, at most 10 a visit, past posts and never-asked first', async () => {
    // d19 is planned for later: asked about after the ones whose time has come
    const drafts = [...Array.from({ length: 19 }, (_, i) => approved(i)), approved(19, -3)];
    const results = [
      // asked 30 minutes ago, nothing yet: not due
      { draftId: 'd0', checkedAt: new Date(NOW - HOUR / 2), measuredAt: null },
      // measured 2 hours ago: not due
      { draftId: 'd1', checkedAt: new Date(NOW - 2 * HOUR), measuredAt: new Date(NOW - 2 * HOUR) },
      // measured 7 hours ago: due, but after the never-asked ones
      { draftId: 'd2', checkedAt: new Date(NOW - 7 * HOUR), measuredAt: new Date(NOW - 7 * HOUR) },
    ];
    const { service, posts } = make(drafts, results);
    await service.collect('org-1', NOW);
    const asked = posts.checkPostAnalytics.mock.calls.map((c) => c[1]);
    expect(asked).toHaveLength(10);
    expect(asked).not.toContain('p19');
    expect(asked).not.toContain('p0');
    expect(asked).not.toContain('p1');
    expect(asked).not.toContain('p2');
    expect(posts.checkPostAnalytics.mock.calls[0]).toEqual(['org-1', 'p3', 30]);
  });

  it('stops asking about settled posts, and posts that never reported anything', async () => {
    const { service, posts } = make(
      [approved(1, 40), approved(2, 35)],
      [
        { draftId: 'd1', checkedAt: new Date(NOW - 10 * HOUR), measuredAt: new Date(NOW - 10 * HOUR) },
        { draftId: 'd2', checkedAt: new Date(NOW - 10 * HOUR), measuredAt: null },
      ]
    );
    await service.collect('org-1', NOW);
    expect(posts.checkPostAnalytics).not.toHaveBeenCalled();
  });

  it('saves results, remembers empty answers, and carries on after a failure', async () => {
    const { service, repo, posts } = make([approved(1), approved(2), approved(3)]);
    posts.checkPostAnalytics
      .mockResolvedValueOnce(simulatedAnalytics('p1', '2026-12-01'))
      .mockResolvedValueOnce({ missing: true })
      .mockRejectedValueOnce(new Error('token expired'));
    await service.collect('org-1', NOW);
    expect(repo.saveResult).toHaveBeenCalledWith('org-1', 'd1', 'p1', expect.objectContaining({ simulated: true }));
    expect(repo.markChecked).toHaveBeenCalledWith('org-1', 'd2', 'p2');
    expect(repo.markChecked).toHaveBeenCalledWith('org-1', 'd3', 'p3');
  });

  const measured = (i: number, simulated: boolean, interactions = 10) => ({
    draftId: `d${i}`,
    postId: `p${i}`,
    simulated,
    reach: 100,
    interactions,
    checkedAt: new Date(NOW),
    measuredAt: new Date(NOW),
  });

  it('uses real results as soon as there are any, and leaves simulated ones out', async () => {
    const drafts = [approved(1), approved(2), approved(3)];
    const { service } = make(drafts, [measured(1, true), measured(2, false), measured(3, true)]);
    const s = await service.summary('org-1', NOW);
    expect(s).toMatchObject({ source: 'real', measuredPosts: 1, simulatedLeftOut: 2, enough: false, preferences: null });
  });

  it('labels a summary built only from Sandbox results as simulated', async () => {
    const { service } = make([approved(1)], [measured(1, true)]);
    const s = await service.summary('org-1', NOW);
    expect(s.source).toBe('simulated');
    expect(s.recent[0]).toMatchObject({ simulated: true, kind: 'Spotlights on a service' });
  });

  it('only lets simulated results steer captions while the Sandbox is on', async () => {
    const drafts = Array.from({ length: 30 }, (_, i) => ({
      ...approved(i),
      platform: ['facebook', 'instagram', 'linkedin'][i % 3],
      facts: [{ field: i % 2 ? 'location' : 'services' }],
    }));
    const results = drafts.map((d, i) => measured(i, true, i % 2 ? 2 + (i % 3) : 30 + (i % 3)));
    const { service } = make(drafts, results);
    expect(await service.writerPreferences('org-1')).toBeNull();
    process.env.SANDBOX_CHANNEL_ENABLED = 'true';
    const prefs = await service.writerPreferences('org-1');
    expect(prefs).toMatchObject({ simulated: true, basedOn: 30 });
    expect(prefs!.favour.map((k) => k.key)).toEqual(['service']);
    expect(prefs!.avoid.map((k) => k.key)).toEqual(['where']);
  });

  it('never stops captions being written when results cannot be read', async () => {
    const { service, repo } = make([]);
    repo.approvedPosts.mockRejectedValueOnce(new Error('db down'));
    await expect(service.writerPreferences('org-1')).resolves.toBeNull();
  });
});

describe('preferences in the caption writers', () => {
  const facts: CaptionFact[] = [
    { id: 'businessName.0', field: 'businessName', value: 'Harbour Lane Bakery' },
    { id: 'whatTheyDo.0', field: 'whatTheyDo', value: 'A small family bakery.' },
    { id: 'services.0', field: 'services', value: 'Sourdough loaves' },
    { id: 'services.1', field: 'services', value: 'Celebration cakes to order' },
    { id: 'services.2', field: 'services', value: 'Wholesale bread for local cafés' },
    { id: 'location.0', field: 'location', value: 'Exampletown' },
    { id: 'phone.0', field: 'phone', value: '01632 960123' },
  ];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const themes = async (preferences?: any) =>
    (await new DemoCaptionWriter().write({ facts, tone: 'warm', days, ...(preferences ? { preferences } : {}) })).raw.posts!.map((p) => p.theme);
  const kind = (key: string) => ({ key, label: key, hint: key });

  it('the demo writer leans towards what worked and away from what did not', async () => {
    const plain = await themes();
    expect(plain[0]).toBe('Introducing the business');
    // six ideas for five days: "where to find us" doesn't make the week
    expect(plain).not.toContain('Where to find us');

    const leaning = await themes({ favour: [kind('where')], avoid: [kind('about')] });
    expect(leaning[0]).toBe('Where to find us');
    expect(leaning).not.toContain('Introducing the business');
    // the week still ends with how to get in touch
    expect(leaning[leaning.length - 1]).toBe('How to get in touch');
  });

  it('the demo writer drops the end-of-week idea when it is one to use less', async () => {
    const leaning = await themes({ favour: [], avoid: [kind('contact')] });
    expect(leaning).not.toContain('How to get in touch');
    expect(leaning).toHaveLength(5);
  });

  it('the demo writer is unchanged without preferences', async () => {
    expect(await themes({ favour: [], avoid: [] })).toEqual(await themes());
  });

  it('Claude is told about past results as a preference, never as a fact', () => {
    const message = buildCaptionMessage({
      facts,
      tone: 'warm',
      days,
      preferences: { favour: [{ key: 'service', label: 'Spotlights <b>', hint: 'posts about one of the services' }], avoid: [] },
    });
    expect(message).toContain('<past_results>');
    expect(message).toContain('never mention results, popularity or engagement');
    expect(message).toContain('- Spotlights b: posts about one of the services');
    expect(message).not.toContain('Use fewer');
    // the profile stays the only source, after the preferences
    expect(message.indexOf('</past_results>')).toBeLessThan(message.indexOf('<untrusted_business_profile>'));
    expect(buildCaptionMessage({ facts, tone: 'warm', days })).not.toContain('past_results');
  });
});

describe('approval before posting', () => {
  afterEach(() => {
    delete process.env.OURS_ALLOW_DIRECT_POSTING;
  });

  it('refuses scheduling from the API, CLI and MCP, but allows drafts', () => {
    for (const method of ['API', 'CLI', 'MCP']) {
      for (const type of ['schedule', 'now', 'update', undefined]) {
        expect(() => assertDirectPostingAllowed(method, type)).toThrow(DIRECT_POSTING_REFUSED);
      }
      expect(() => assertDirectPostingAllowed(method, 'draft')).not.toThrow();
    }
  });

  it('allows the signed-in app (calendar and our approval) and upstream drafts from autopost', () => {
    expect(() => assertDirectPostingAllowed('WEB', 'schedule')).not.toThrow();
    expect(() => assertDirectPostingAllowed('AUTOPOST', 'draft')).not.toThrow();
  });

  it('answers 403 and can be switched back on', () => {
    try {
      assertDirectPostingAllowed('API', 'now');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(403);
    }
    process.env.OURS_ALLOW_DIRECT_POSTING = 'true';
    expect(() => assertDirectPostingAllowed('MCP', 'now')).not.toThrow();
  });

  it('the guard refuses turning a draft into a scheduled post through the public API', () => {
    const guard = new DirectPostingGuard();
    const ctx = (method: string, path: string, body: any) =>
      ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => ({ method, path, body }) }) }) as never;
    expect(() => guard.canActivate(ctx('PUT', '/public/v1/posts/abc/status', { status: 'schedule' }))).toThrow(DIRECT_POSTING_REFUSED);
    expect(guard.canActivate(ctx('PUT', '/public/v1/posts/abc/status', { status: 'draft' }))).toBe(true);
    expect(guard.canActivate(ctx('PUT', '/posts/abc/status', { status: 'schedule' }))).toBe(true);
  });
});
