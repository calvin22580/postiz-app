// OURS: "How people find you" D1 (26/11/2026), the searches that matter.
// From the business profile's services and town we suggest Google searches,
// each with how many people make it a month. The owner chooses which ones we
// watch; nothing is watched until they do. Later milestones check where the
// business appears for them (D2) and turn gaps into content (D3).
//
// Search data is untrusted input: it only chooses what we watch and, later,
// what we write about. It never becomes a claim about the business.
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { OursProfileStatus, OursTrackedSearchStatus } from '@prisma/client';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import { ProfileFields } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import { AiUsageService } from '@gitroom/nestjs-libraries/ours/ai/ai.usage.service';
import { PLAN_LIMIT_STATUS, PlanService } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { SearchRepository } from '@gitroom/nestjs-libraries/ours/search/search.repository';
import {
  dataForSeoCredentials,
  isSearchReportEnabled,
  SEARCH_IDEAS_FEATURE,
  searchMarket,
  SUGGEST_AGAIN_AFTER_MS,
} from '@gitroom/nestjs-libraries/ours/search/search.config';
import {
  normaliseKeyword,
  SearchDataCall,
  SearchDataError,
  SearchDataProvider,
  SearchDemand,
} from '@gitroom/nestjs-libraries/ours/search/providers/search.data.provider';
import { DataForSeoSearchDataProvider } from '@gitroom/nestjs-libraries/ours/search/providers/dataforseo.search.data.provider';
import { SimulatedSearchDataProvider } from '@gitroom/nestjs-libraries/ours/search/providers/simulated.search.data.provider';

// services turned into searches, at most
export const MAX_SEEDS = 8;
// related searches asked for
export const IDEAS_LIMIT = 60;
// suggestions offered at once
export const MAX_SUGGESTIONS = 30;
// a search longer than this is a sentence, not a search
const MAX_SEED_WORDS = 5;
const MAX_KEYWORD_LENGTH = 80;

export const createSearchDataProvider = (env: NodeJS.ProcessEnv = process.env): SearchDataProvider => {
  const credentials = dataForSeoCredentials(env);
  return credentials ? new DataForSeoSearchDataProvider(credentials) : new SimulatedSearchDataProvider();
};

const firstClaim = (fields: ProfileFields, key: 'location') => fields[key]?.claims?.[0]?.value || '';

// The town as the profile writes it: "Harrogate, North Yorkshire HG1 2AB" ->
// "Harrogate"
export const townName = (fields: ProfileFields) =>
  firstClaim(fields, 'location')
    .split(/[,(]/)[0]
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

// ... and as it goes into a search: "harrogate"
export const townFrom = (fields: ProfileFields) => normaliseKeyword(townName(fields));

// A service as someone would search for it: the name before any detail.
// "Full groom (bath, cut and nails)" -> "full groom"
export const serviceSeeds = (fields: ProfileFields) => {
  const seeds: string[] = [];
  for (const claim of fields.services?.claims || []) {
    const name = normaliseKeyword(claim.value.split(/,|\(|:| [-–—] | including | with /i)[0]);
    const words = name.split(' ').filter(Boolean).length;
    if (words && words <= MAX_SEED_WORDS && !seeds.includes(name)) {
      seeds.push(name);
    }
  }
  return seeds.slice(0, MAX_SEEDS);
};

// The searches a nearby customer would type.
export const localSearches = (seeds: string[], town: string) =>
  seeds.flatMap((seed) => [...(town ? [`${seed} ${town}`] : []), `${seed} near me`]);

export const searchKind = (keyword: string, town: string) =>
  (town && ` ${keyword} `.includes(` ${town} `)) || keyword.includes('near me') ? 'local' : 'topic';

const byVolume = (a: SearchDemand, b: SearchDemand) =>
  (b.searchVolume ?? -1) - (a.searchVolume ?? -1) || a.keyword.localeCompare(b.keyword);

// Local searches first (with demand, then too small to measure), then the
// wider topics people search for, biggest first. Searches the owner already
// answered are left out, and so are searches for someone else's brand.
export const chooseSuggestions = (
  local: SearchDemand[],
  ideas: SearchDemand[],
  town: string,
  answered: Set<string>
) => {
  const seen = new Set(answered);
  const take = (rows: SearchDemand[]) =>
    rows.filter((r) => {
      if (!r.keyword || r.keyword.length > MAX_KEYWORD_LENGTH || seen.has(r.keyword)) return false;
      seen.add(r.keyword);
      return true;
    });
  const localRows = take([...local].sort(byVolume));
  const topicRows = take(ideas.filter((r) => r.intent !== 'navigational' && r.searchVolume !== null).sort(byVolume));
  return [...localRows, ...topicRows]
    .slice(0, MAX_SUGGESTIONS)
    .map((r) => ({ ...r, kind: searchKind(r.keyword, town) }));
};

@Injectable()
export class SearchService {
  private _logger = new Logger(SearchService.name);

  constructor(
    private _searchRepository: SearchRepository,
    private _businessProfileService: BusinessProfileService,
    private _aiUsageService: AiUsageService,
    private _planService: PlanService
  ) {}

  async overview(orgId: string, provider: SearchDataProvider = createSearchDataProvider()) {
    if (!isSearchReportEnabled()) {
      return { enabled: false as const };
    }
    const [{ profile }, rows, allowance, lastPaid] = await Promise.all([
      this._businessProfileService.getProfile(orgId),
      this._searchRepository.list(orgId),
      this._planService.trackedSearchLimit(orgId),
      this._searchRepository.lastPaidSuggestion(orgId, SEARCH_IDEAS_FEATURE),
    ]);
    // local searches first, then the biggest
    rows.sort((a, b) => Number(b.kind === 'local') - Number(a.kind === 'local'));
    const ready = profile?.status === OursProfileStatus.READY;
    const fields = ready ? (profile!.fields as ProfileFields) : null;
    const present = (r: (typeof rows)[number]) => ({
      id: r.id,
      keyword: r.keyword,
      kind: r.kind,
      origin: r.origin,
      searchVolume: r.searchVolume,
      simulated: r.simulated,
    });
    const nextSuggestAt =
      provider.name === 'dataforseo' && lastPaid ? new Date(lastPaid.getTime() + SUGGEST_AGAIN_AFTER_MS) : null;
    return {
      enabled: true as const,
      simulated: provider.name === 'simulated' || rows.some((r) => r.simulated),
      market: searchMarket().label,
      profile: {
        ready,
        // as the profile writes it, for the screen
        town: fields ? townName(fields) : '',
        services: fields ? serviceSeeds(fields).length : 0,
      },
      limit: allowance.limit,
      limitMessage: allowance.message,
      tracked: rows.filter((r) => r.status === OursTrackedSearchStatus.TRACKED).map(present),
      suggestions: rows.filter((r) => r.status === OursTrackedSearchStatus.SUGGESTED).map(present),
      nextSuggestAt: nextSuggestAt && nextSuggestAt.getTime() > Date.now() ? nextSuggestAt.toISOString() : null,
    };
  }

  // A fresh set of suggestions from the profile.
  async suggest(orgId: string, provider: SearchDataProvider = createSearchDataProvider(), now = new Date()) {
    this.assertEnabled();
    const { profile } = await this._businessProfileService.getProfile(orgId);
    if (profile?.status !== OursProfileStatus.READY) {
      throw new HttpException('Build your business profile first, so we know what you offer and where.', 400);
    }
    const fields = profile.fields as ProfileFields;
    const seeds = serviceSeeds(fields);
    if (!seeds.length) {
      throw new HttpException(
        'Your business profile doesn’t list any services yet. Add them there, or add your own searches below.',
        400
      );
    }
    if (provider.name === 'dataforseo') {
      const lastPaid = await this._searchRepository.lastPaidSuggestion(orgId, SEARCH_IDEAS_FEATURE);
      if (lastPaid && now.getTime() - lastPaid.getTime() < SUGGEST_AGAIN_AFTER_MS) {
        throw new HttpException('You’ve had fresh suggestions today. You can ask again tomorrow.', 429);
      }
      await this._planService.assertCanSpendOnSearchData(orgId, now);
    }

    const town = townFrom(fields);
    const market = searchMarket();
    const calls: SearchDataCall[] = [];
    let local: SearchDemand[];
    let ideas: SearchDemand[];
    try {
      const [localOut, ideasOut] = await Promise.all([
        provider.demand(localSearches(seeds, town), market),
        provider.ideas(seeds, market, IDEAS_LIMIT),
      ]);
      calls.push(...localOut.calls, ...ideasOut.calls);
      local = localOut.rows;
      ideas = ideasOut.rows;
    } catch (e) {
      if (e instanceof SearchDataError) calls.push(...e.calls);
      this._logger.error(`Search suggestions failed for org=${orgId}: ${(e as Error).message}`);
      await this.logCalls(orgId, provider, calls);
      throw new HttpException('We couldn’t look up searches just now. Please try again in a few minutes.', 502);
    }
    // the once-a-day limit reads this log, so a paid run always leaves a row
    if (provider.name === 'dataforseo' && !calls.length) {
      calls.push({ endpoint: 'suggest (cost not reported)', costUsd: 0 });
    }
    await this.logCalls(orgId, provider, calls);

    const chosen = chooseSuggestions(local, ideas, town, await this._searchRepository.answeredKeywords(orgId));
    await this._searchRepository.replaceSuggestions(
      orgId,
      chosen.map((r) => ({
        keyword: r.keyword,
        kind: r.kind,
        searchVolume: r.searchVolume,
        locationCode: market.locationCode,
        simulated: provider.name === 'simulated',
      })),
      now
    );
    return this.overview(orgId, provider);
  }

  // The owner chose these suggestions.
  async track(orgId: string, ids: string[], now = new Date()) {
    this.assertEnabled();
    const unique = [...new Set(ids)];
    await this.assertRoomFor(orgId, unique.length);
    await this._searchRepository.track(orgId, unique, now);
    return this.overview(orgId);
  }

  // The owner typed in a search of their own.
  async add(orgId: string, raw: string, now = new Date()) {
    this.assertEnabled();
    const keyword = normaliseKeyword(raw);
    if (!keyword || keyword.length > MAX_KEYWORD_LENGTH) {
      throw new HttpException('Type a search as someone would type it into Google.', 400);
    }
    const { profile } = await this._businessProfileService.getProfile(orgId);
    const town = profile?.status === OursProfileStatus.READY ? townFrom(profile.fields as ProfileFields) : '';
    // already watched: nothing to add, so no room needed
    if (!(await this._searchRepository.isTracked(orgId, keyword))) {
      await this.assertRoomFor(orgId, 1);
    }
    await this._searchRepository.addOwnSearch(orgId, keyword, searchKind(keyword, town), now);
    return this.overview(orgId);
  }

  // Stop watching a search, or turn down a suggestion. Either way it isn't
  // suggested again.
  async remove(orgId: string, id: string) {
    this.assertEnabled();
    if (!(await this._searchRepository.dismiss(orgId, id))) {
      throw new HttpException('That search isn’t on your list.', 404);
    }
    return this.overview(orgId);
  }

  private async assertRoomFor(orgId: string, adding: number) {
    const [{ limit, message }, tracked] = await Promise.all([
      this._planService.assertCanTrackSearches(orgId),
      this._searchRepository.countTracked(orgId),
    ]);
    if (tracked + adding > limit) {
      throw new HttpException(message, PLAN_LIMIT_STATUS);
    }
  }

  private assertEnabled() {
    if (!isSearchReportEnabled()) {
      throw new HttpException('Not found', 404);
    }
  }

  private async logCalls(orgId: string, provider: SearchDataProvider, calls: SearchDataCall[]) {
    for (const call of calls) {
      await this._aiUsageService.logDataCall(orgId, SEARCH_IDEAS_FEATURE, {
        provider: provider.name,
        endpoint: call.endpoint,
        costUsd: call.costUsd,
      });
    }
  }
}
