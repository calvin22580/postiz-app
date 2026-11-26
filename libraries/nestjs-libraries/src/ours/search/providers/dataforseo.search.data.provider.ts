// OURS: search data from DataForSEO Labs (D1). Two live endpoints:
//   keyword_overview: demand for up to 700 exact searches
//     https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live/
//   keyword_ideas: related searches for up to 200 seeds
//     https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live/
// Both are priced per task plus per row returned ($0.012 + $0.00012 a row,
// November 2026); each task's real charge comes back as `cost` and is logged.
// Request and response shapes follow the docs above and OpenSEO's client
// (github.com/every-app/open-seo, MIT), which calls the same endpoints.
import {
  normaliseKeyword,
  SearchDataCall,
  SearchDataError,
  SearchDataOutput,
  SearchDataProvider,
  SearchDemand,
  SearchMarket,
} from '@gitroom/nestjs-libraries/ours/search/providers/search.data.provider';

const API_BASE = 'https://api.dataforseo.com';
const OK = 20000;
const TIMEOUT_MS = 30_000;
const MAX_OVERVIEW_KEYWORDS = 700;
const MAX_IDEA_SEEDS = 200;

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

interface LabsItem {
  keyword?: string | null;
  keyword_info?: { search_volume?: number | null } | null;
  search_intent_info?: { main_intent?: string | null } | null;
}

interface LabsTask {
  status_code?: number;
  status_message?: string;
  cost?: number;
  result?: { items?: LabsItem[] | null }[] | null;
}

interface LabsResponse {
  status_code?: number;
  status_message?: string;
  tasks?: LabsTask[];
}

export const readLabsItems = (items: LabsItem[] | null | undefined): SearchDemand[] => {
  const seen = new Set<string>();
  const rows: SearchDemand[] = [];
  for (const item of items || []) {
    const keyword = normaliseKeyword(item?.keyword || '');
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    const volume = item.keyword_info?.search_volume;
    rows.push({
      keyword,
      searchVolume: typeof volume === 'number' && volume > 0 ? Math.round(volume) : null,
      intent: item.search_intent_info?.main_intent || null,
    });
  }
  return rows;
};

export class DataForSeoSearchDataProvider implements SearchDataProvider {
  readonly name = 'dataforseo' as const;

  constructor(
    private _credentials: { login: string; password: string },
    private _fetch: FetchLike = (url, init) => fetch(url, init)
  ) {}

  async demand(keywords: string[], market: SearchMarket): Promise<SearchDataOutput> {
    const list = keywords.slice(0, MAX_OVERVIEW_KEYWORDS);
    if (!list.length) return { rows: [], calls: [] };
    return this.post('/v3/dataforseo_labs/google/keyword_overview/live', {
      keywords: list,
      location_code: market.locationCode,
      language_code: market.languageCode,
      include_serp_info: false,
      include_clickstream_data: false,
    });
  }

  async ideas(seeds: string[], market: SearchMarket, limit: number): Promise<SearchDataOutput> {
    const list = seeds.slice(0, MAX_IDEA_SEEDS);
    if (!list.length) return { rows: [], calls: [] };
    return this.post('/v3/dataforseo_labs/google/keyword_ideas/live', {
      keywords: list,
      location_code: market.locationCode,
      language_code: market.languageCode,
      limit,
      // only searches people actually make
      filters: [['keyword_info.search_volume', '>', 0]],
      order_by: ['keyword_info.search_volume,desc'],
      include_serp_info: false,
      include_clickstream_data: false,
      closely_variants: false,
      ignore_synonyms: true,
    });
  }

  private async post(path: string, task: Record<string, unknown>): Promise<SearchDataOutput> {
    const auth = Buffer.from(`${this._credentials.login}:${this._credentials.password}`).toString('base64');
    let body: LabsResponse;
    try {
      const res = await this._fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([task]),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new SearchDataError(`DataForSEO answered HTTP ${res.status} for ${path}`);
      }
      body = (await res.json()) as LabsResponse;
    } catch (e) {
      if (e instanceof SearchDataError) throw e;
      throw new SearchDataError(`DataForSEO request failed for ${path}: ${(e as Error).message}`);
    }

    const t = body.tasks?.[0];
    const calls: SearchDataCall[] =
      typeof t?.cost === 'number' && t.cost > 0 ? [{ endpoint: path, costUsd: t.cost }] : [];
    if (body.status_code !== OK || !t || t.status_code !== OK) {
      const message = t?.status_message || body.status_message || 'no task in the answer';
      throw new SearchDataError(`DataForSEO refused ${path}: ${message}`, calls);
    }
    return { rows: readLabsItems(t.result?.[0]?.items), calls };
  }
}
