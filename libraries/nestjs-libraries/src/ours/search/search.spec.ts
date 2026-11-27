// OURS: "How people find you" D1 unit tests. Run from the repo root:
//   pnpm exec vitest run --config ours/vitest.config.mts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { OursProfileStatus, OursTrackedSearchStatus } from '@prisma/client';
import { emptyFields, ProfileFields } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import {
  chooseSuggestions,
  localSearches,
  MAX_SUGGESTIONS,
  SearchService,
  searchKind,
  serviceSeeds,
  townFrom,
} from '@gitroom/nestjs-libraries/ours/search/search.service';
import {
  DataForSeoSearchDataProvider,
  readLabsItems,
} from '@gitroom/nestjs-libraries/ours/search/providers/dataforseo.search.data.provider';
import {
  SimulatedSearchDataProvider,
  simulatedVolume,
} from '@gitroom/nestjs-libraries/ours/search/providers/simulated.search.data.provider';
import {
  normaliseKeyword,
  SearchDataError,
  SearchDataProvider,
} from '@gitroom/nestjs-libraries/ours/search/providers/search.data.provider';
import { createSearchDataProvider } from '@gitroom/nestjs-libraries/ours/search/search.service';
import { PAID_PLANS, TRIAL_PLAN } from '@gitroom/nestjs-libraries/ours/plans/plans.config';
import { trackedSearchLimitMessage } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { SEARCH_IDEAS_FEATURE } from '@gitroom/nestjs-libraries/ours/search/search.config';

vi.mock('@gitroom/nestjs-libraries/database/prisma/integrations/integration.service', () => ({
  IntegrationService: class {},
}));

const claim = (value: string) => ({ value, origin: 'website' as const, sources: [] });

const profileFields = (services: string[], location = 'Harrogate, North Yorkshire HG1 2AB'): ProfileFields => {
  const fields = emptyFields();
  fields.services = { claims: services.map(claim) };
  fields.location = { claims: location ? [claim(location)] : [] };
  return fields;
};

describe('searches from the business profile', () => {
  it('takes the town from the location, without county or postcode', () => {
    expect(townFrom(profileFields([], 'Harrogate, North Yorkshire HG1 2AB'))).toBe('harrogate');
    expect(townFrom(profileFields([], 'Bury St Edmunds (Suffolk)'))).toBe('bury st edmunds');
    expect(townFrom(profileFields([], ''))).toBe('');
  });

  it('turns services into short searches, leaving out the detail and sentences', () => {
    const seeds = serviceSeeds(
      profileFields([
        'Full dog groom (bath, cut and nails)',
        'Puppy introduction groom - for dogs under 6 months',
        'Nail clipping',
        'nail clipping',
        'We also offer a very long description of a service that nobody would ever search for',
      ])
    );
    expect(seeds).toEqual(['full dog groom', 'puppy introduction groom', 'nail clipping']);
  });

  it('makes the searches a nearby customer would type, and knows which are local', () => {
    expect(localSearches(['dog grooming'], 'harrogate')).toEqual(['dog grooming harrogate', 'dog grooming near me']);
    expect(localSearches(['dog grooming'], '')).toEqual(['dog grooming near me']);
    expect(searchKind('dog grooming harrogate', 'harrogate')).toBe('local');
    expect(searchKind('dog groomer near me', 'harrogate')).toBe('local');
    expect(searchKind('dog grooming prices', 'harrogate')).toBe('topic');
    // a town inside another word is not the town
    expect(searchKind('harrogateway kennels', 'harrogate')).toBe('topic');
  });

  it('normalises searches the way Google users type them', () => {
    expect(normaliseKeyword('  “Dog   Grooming”, Harrogate! ')).toBe('dog grooming harrogate');
  });
});

describe('choosing suggestions', () => {
  const row = (keyword: string, searchVolume: number | null, intent: string | null = 'commercial') => ({
    keyword,
    searchVolume,
    intent,
  });

  it('puts local searches first, then the biggest topics, and labels each', () => {
    const chosen = chooseSuggestions(
      [row('dog grooming harrogate', 90), row('dog grooming near me', null), row('puppy groom harrogate', 210)],
      [row('dog grooming prices', 1300), row('dog grooming tips', 40)],
      'harrogate',
      new Set()
    );
    expect(chosen.map((c) => [c.keyword, c.kind])).toEqual([
      ['puppy groom harrogate', 'local'],
      ['dog grooming harrogate', 'local'],
      ['dog grooming near me', 'local'],
      ['dog grooming prices', 'topic'],
      ['dog grooming tips', 'topic'],
    ]);
  });

  it('leaves out searches the owner already answered, brand searches, unmeasured topics and repeats', () => {
    const chosen = chooseSuggestions(
      [row('dog grooming harrogate', 90)],
      [
        row('dog grooming harrogate', 90),
        row('pets at home grooming', 5000, 'navigational'),
        row('dog grooming kit', null),
        row('dog grooming prices', 1300),
      ],
      'harrogate',
      new Set(['dog grooming prices'])
    );
    expect(chosen.map((c) => c.keyword)).toEqual(['dog grooming harrogate']);
  });

  it(`offers at most ${MAX_SUGGESTIONS} at once`, () => {
    const ideas = Array.from({ length: 50 }, (_, i) => row(`idea ${i}`, 100 + i));
    expect(chooseSuggestions([], ideas, '', new Set())).toHaveLength(MAX_SUGGESTIONS);
  });
});

describe('DataForSEO provider', () => {
  const answer = (task: object, status = 20000) => ({
    ok: true,
    status: 200,
    json: async () => ({ status_code: status, tasks: [task] }),
  });

  it('reads items, counting zero searches as too few to measure', () => {
    expect(
      readLabsItems([
        { keyword: 'Dog Grooming', keyword_info: { search_volume: 1300 }, search_intent_info: { main_intent: 'commercial' } },
        { keyword: 'dog grooming', keyword_info: { search_volume: 999 } },
        { keyword: 'dog groomer bilton', keyword_info: { search_volume: 0 } },
        { keyword: null },
      ])
    ).toEqual([
      { keyword: 'dog grooming', searchVolume: 1300, intent: 'commercial' },
      { keyword: 'dog groomer bilton', searchVolume: null, intent: null },
    ]);
  });

  it('posts one task with Basic auth to the documented endpoint and returns its charge', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      answer({ status_code: 20000, cost: 0.0132, result: [{ items: [{ keyword: 'dog grooming harrogate', keyword_info: { search_volume: 90 } }] }] })
    );
    const provider = new DataForSeoSearchDataProvider({ login: 'me@example.com', password: 'secret' }, fetchImpl);
    const out = await provider.demand(['dog grooming harrogate'], { locationCode: 2826, languageCode: 'en' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('me@example.com:secret').toString('base64')}`
    );
    expect(JSON.parse(init.body as string)).toEqual([
      expect.objectContaining({ keywords: ['dog grooming harrogate'], location_code: 2826, language_code: 'en' }),
    ]);
    expect(out.rows).toEqual([{ keyword: 'dog grooming harrogate', searchVolume: 90, intent: null }]);
    expect(out.calls).toEqual([
      { endpoint: '/v3/dataforseo_labs/google/keyword_overview/live', costUsd: 0.0132 },
    ]);
  });

  it('asks for ideas with a limit and only searches people make', async () => {
    const fetchImpl = vi.fn(async () => answer({ status_code: 20000, cost: 0.02, result: [{ items: [] }] }));
    const provider = new DataForSeoSearchDataProvider({ login: 'a', password: 'b' }, fetchImpl);
    await provider.ideas(['dog grooming'], { locationCode: 2826, languageCode: 'en' }, 60);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/keyword_ideas\/live$/);
    expect(JSON.parse(init.body as string)[0]).toMatchObject({
      keywords: ['dog grooming'],
      limit: 60,
      filters: [['keyword_info.search_volume', '>', 0]],
    });
  });

  it('fails clearly on a refused task, keeping any charge so it is still logged', async () => {
    const provider = new DataForSeoSearchDataProvider({ login: 'a', password: 'b' }, async () =>
      answer({ status_code: 40501, status_message: 'Invalid Field', cost: 0.012 })
    );
    const err = await provider.demand(['x'], { locationCode: 2826, languageCode: 'en' }).catch((e) => e);
    expect(err).toBeInstanceOf(SearchDataError);
    expect(err.message).toContain('Invalid Field');
    expect(err.calls).toEqual([{ endpoint: '/v3/dataforseo_labs/google/keyword_overview/live', costUsd: 0.012 }]);
  });

  it('is only chosen when both login and password are set', () => {
    expect(createSearchDataProvider({}).name).toBe('simulated');
    expect(createSearchDataProvider({ OURS_DATAFORSEO_LOGIN: 'a' }).name).toBe('simulated');
    expect(createSearchDataProvider({ OURS_DATAFORSEO_LOGIN: 'a', OURS_DATAFORSEO_PASSWORD: 'b' }).name).toBe(
      'dataforseo'
    );
  });
});

describe('Simulated provider', () => {
  it('gives the same made-up number every time, and costs nothing', async () => {
    const provider = new SimulatedSearchDataProvider();
    const market = { locationCode: 2826, languageCode: 'en' };
    const a = await provider.demand(['dog grooming harrogate'], market);
    const b = await provider.demand(['Dog Grooming Harrogate'], market);
    expect(a).toEqual(b);
    expect(a.calls).toEqual([]);
    expect(a.rows[0].searchVolume).toBe(simulatedVolume('dog grooming harrogate'));
    const ideas = await provider.ideas(['dog grooming'], market, 3);
    expect(ideas.rows.length).toBeLessThanOrEqual(3);
    expect(ideas.rows.every((r) => r.searchVolume !== null)).toBe(true);
  });
});

describe('plan limits for watched searches', () => {
  it('every plan sets one, and paid plans never give less than the trial', () => {
    for (const plan of PAID_PLANS) {
      expect(plan.limits.trackedSearches).toBeGreaterThanOrEqual(TRIAL_PLAN.limits.trackedSearches);
    }
    expect(PAID_PLANS.map((p) => p.limits.trackedSearches)).toEqual([10, 25, 50]);
  });

  it('explains the limit and points to the next plan up', () => {
    expect(trackedSearchLimitMessage(PAID_PLANS[0])).toBe(
      'Your Starter plan watches up to 10 searches. Remove one to add another, or move to Growth (25 searches) on Plan and usage.'
    );
    expect(trackedSearchLimitMessage(PAID_PLANS[2])).toBe(
      'Your Pro plan watches up to 50 searches. Remove one to add another.'
    );
  });
});

describe('SearchService', () => {
  const ORG = 'org-1';
  let repo: Record<string, ReturnType<typeof vi.fn>>;
  let profileService: { getProfile: ReturnType<typeof vi.fn> };
  let aiUsage: { logDataCall: ReturnType<typeof vi.fn> };
  let plans: Record<string, ReturnType<typeof vi.fn>>;
  let service: SearchService;

  const readyProfile = (services = ['Dog grooming', 'Nail clipping']) => ({
    profile: { status: OursProfileStatus.READY, fields: profileFields(services) },
  });

  const paidProvider = (): SearchDataProvider => ({
    name: 'dataforseo',
    demand: vi.fn(async (keywords: string[]) => ({
      rows: keywords.map((k) => ({ keyword: k, searchVolume: 50, intent: 'commercial' })),
      calls: [{ endpoint: '/v3/dataforseo_labs/google/keyword_overview/live', costUsd: 0.013 }],
    })),
    ideas: vi.fn(async () => ({
      rows: [{ keyword: 'dog grooming prices', searchVolume: 1300, intent: 'commercial' }],
      calls: [{ endpoint: '/v3/dataforseo_labs/google/keyword_ideas/live', costUsd: 0.02 }],
    })),
  });

  beforeEach(() => {
    vi.stubEnv('OURS_SEARCH_REPORT', 'true');
    repo = {
      list: vi.fn(async () => []),
      answeredKeywords: vi.fn(async () => new Set<string>()),
      countTracked: vi.fn(async () => 0),
      isTracked: vi.fn(async () => false),
      replaceSuggestions: vi.fn(async () => undefined),
      addOwnSearch: vi.fn(async () => ({ id: 'x' })),
      track: vi.fn(async () => 1),
      dismiss: vi.fn(async () => 1),
      lastPaidSuggestion: vi.fn(async () => null),
    };
    profileService = { getProfile: vi.fn(async () => readyProfile()) };
    aiUsage = { logDataCall: vi.fn(async () => null) };
    plans = {
      trackedSearchLimit: vi.fn(async () => ({ limit: 10, plan: 'Starter', message: 'limit reached' })),
      assertCanTrackSearches: vi.fn(async () => ({ limit: 10, plan: 'Starter', message: 'limit reached' })),
      assertCanSpendOnSearchData: vi.fn(async () => undefined),
    };
    service = new SearchService(repo as never, profileService as never, aiUsage as never, plans as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stays hidden and refuses changes while switched off', async () => {
    vi.stubEnv('OURS_SEARCH_REPORT', '');
    expect(await service.overview(ORG)).toEqual({ enabled: false });
    await expect(service.suggest(ORG)).rejects.toMatchObject({ status: 404 });
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('needs a finished profile with services before suggesting', async () => {
    profileService.getProfile.mockResolvedValueOnce({ profile: null });
    await expect(service.suggest(ORG, paidProvider())).rejects.toMatchObject({ status: 400 });
    profileService.getProfile.mockResolvedValueOnce(readyProfile([]));
    await expect(service.suggest(ORG, paidProvider())).rejects.toMatchObject({ status: 400 });
  });

  it('suggests local searches and topics, stores them for this organisation, and logs every charge', async () => {
    const provider = paidProvider();
    await service.suggest(ORG, provider, new Date('2026-11-26T12:00:00Z'));

    expect(provider.demand).toHaveBeenCalledWith(
      ['dog grooming harrogate', 'dog grooming near me', 'nail clipping harrogate', 'nail clipping near me'],
      { locationCode: 2826, languageCode: 'en', label: 'the UK' }
    );
    const [org, rows] = repo.replaceSuggestions.mock.calls[0];
    expect(org).toBe(ORG);
    expect(rows.map((r: { keyword: string; kind: string }) => `${r.kind}:${r.keyword}`)).toEqual([
      'local:dog grooming harrogate',
      'local:dog grooming near me',
      'local:nail clipping harrogate',
      'local:nail clipping near me',
      'topic:dog grooming prices',
    ]);
    expect(rows.every((r: { simulated: boolean }) => r.simulated === false)).toBe(true);
    expect(aiUsage.logDataCall).toHaveBeenCalledTimes(2);
    expect(aiUsage.logDataCall).toHaveBeenCalledWith(ORG, SEARCH_IDEAS_FEATURE, {
      provider: 'dataforseo',
      endpoint: '/v3/dataforseo_labs/google/keyword_ideas/live',
      costUsd: 0.02,
    });
    expect(plans.assertCanSpendOnSearchData).toHaveBeenCalledWith(ORG, expect.any(Date));
  });

  it('asks for paid suggestions at most once a day', async () => {
    repo.lastPaidSuggestion.mockResolvedValue(new Date('2026-11-26T08:00:00Z'));
    await expect(service.suggest(ORG, paidProvider(), new Date('2026-11-26T12:00:00Z'))).rejects.toMatchObject({
      status: 429,
    });
    // the free Simulated provider isn't limited
    await expect(service.suggest(ORG, new SimulatedSearchDataProvider())).resolves.toMatchObject({ enabled: true });
  });

  it('still keeps to once a day when the provider reports no cost', async () => {
    const provider = paidProvider();
    (provider.demand as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [], calls: [] });
    (provider.ideas as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [], calls: [] });
    await service.suggest(ORG, provider);
    expect(aiUsage.logDataCall).toHaveBeenCalledTimes(1);
    expect(aiUsage.logDataCall).toHaveBeenCalledWith(ORG, SEARCH_IDEAS_FEATURE, expect.objectContaining({ costUsd: 0 }));
  });

  it('logs a charged failure and tells the owner plainly', async () => {
    const provider = paidProvider();
    (provider.ideas as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new SearchDataError('refused', [{ endpoint: '/v3/dataforseo_labs/google/keyword_ideas/live', costUsd: 0.012 }])
    );
    const err = await service.suggest(ORG, provider).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(502);
    expect(aiUsage.logDataCall).toHaveBeenCalledWith(ORG, SEARCH_IDEAS_FEATURE, expect.objectContaining({ costUsd: 0.012 }));
    expect(repo.replaceSuggestions).not.toHaveBeenCalled();
  });

  it('labels simulated suggestions', async () => {
    await service.suggest(ORG, new SimulatedSearchDataProvider());
    const [, rows] = repo.replaceSuggestions.mock.calls[0];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: { simulated: boolean }) => r.simulated)).toBe(true);
    expect(aiUsage.logDataCall).not.toHaveBeenCalled();
  });

  it('keeps to the plan’s limit when the owner chooses searches', async () => {
    repo.countTracked.mockResolvedValue(9);
    await expect(service.track(ORG, ['a', 'b'])).rejects.toMatchObject({ status: 403, message: 'limit reached' });
    expect(repo.track).not.toHaveBeenCalled();
    await service.track(ORG, ['a', 'a']);
    expect(repo.track).toHaveBeenCalledWith(ORG, ['a'], expect.any(Date));
  });

  it('adds the owner’s own search, tidied and marked local when it names the town', async () => {
    await service.add(ORG, '  Dog Groomer, HARROGATE ');
    expect(repo.addOwnSearch).toHaveBeenCalledWith(ORG, 'dog groomer harrogate', 'local', expect.any(Date));
    await expect(service.add(ORG, '!!!')).rejects.toMatchObject({ status: 400 });
  });

  it('lets the owner add a search they already watch, even at the limit', async () => {
    repo.countTracked.mockResolvedValue(10);
    repo.isTracked.mockResolvedValueOnce(true);
    await service.add(ORG, 'dog groomer harrogate');
    expect(repo.addOwnSearch).toHaveBeenCalled();
    await expect(service.add(ORG, 'cat groomer harrogate')).rejects.toMatchObject({ status: 403 });
  });

  it('still shows the list when the plan has lapsed, but won’t watch more', async () => {
    plans.assertCanTrackSearches.mockRejectedValue(new HttpException('Your free trial has ended.', 403));
    await expect(service.overview(ORG)).resolves.toMatchObject({ enabled: true, limit: 10 });
    await expect(service.track(ORG, ['a'])).rejects.toMatchObject({ status: 403 });
  });

  it('only removes a search from the organisation’s own list', async () => {
    repo.dismiss.mockResolvedValueOnce(0);
    await expect(service.remove(ORG, 'someone-elses')).rejects.toMatchObject({ status: 404 });
    expect(repo.dismiss).toHaveBeenCalledWith(ORG, 'someone-elses');
  });

  it('shows chosen searches and suggestions apart, with the plan’s room', async () => {
    repo.list.mockResolvedValue([
      { id: '1', keyword: 'dog grooming harrogate', status: OursTrackedSearchStatus.TRACKED, origin: 'suggested', kind: 'local', searchVolume: 90, simulated: false },
      { id: '2', keyword: 'dog grooming prices', status: OursTrackedSearchStatus.SUGGESTED, origin: 'suggested', kind: 'topic', searchVolume: 1300, simulated: false },
    ]);
    const overview = await service.overview(ORG, paidProvider());
    expect(overview).toMatchObject({
      enabled: true,
      simulated: false,
      market: 'the UK',
      profile: { ready: true, town: 'Harrogate', services: 2 },
      limit: 10,
      tracked: [{ id: '1' }],
      suggestions: [{ id: '2' }],
      nextSuggestAt: null,
    });
  });
});
