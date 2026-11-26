// OURS: the adapter between the search service and whatever supplies search
// data (D1). DataForSEO is used when its login is set; otherwise the
// Simulated provider runs, and everything it returns is labelled as made up.

export interface SearchMarket {
  locationCode: number;
  languageCode: string;
}

export interface SearchDemand {
  // lower case, single spaces
  keyword: string;
  // average monthly Google searches in the market; null when there are too
  // few to measure
  searchVolume: number | null;
  // informational | navigational | commercial | transactional, when known
  intent: string | null;
}

// One paid call, so its cost can be logged against the organisation.
export interface SearchDataCall {
  endpoint: string;
  costUsd: number;
}

export interface SearchDataOutput {
  rows: SearchDemand[];
  calls: SearchDataCall[];
}

export interface SearchDataProvider {
  readonly name: 'dataforseo' | 'simulated';
  // Demand for exact searches we already have in mind.
  demand(keywords: string[], market: SearchMarket): Promise<SearchDataOutput>;
  // Other searches people make around these seeds.
  ideas(seeds: string[], market: SearchMarket, limit: number): Promise<SearchDataOutput>;
}

// A failed lookup. A failed task can still be charged, so its calls travel
// with the error and are logged too.
export class SearchDataError extends Error {
  constructor(message: string, public readonly calls: SearchDataCall[] = []) {
    super(message);
  }
}

// lower case, single spaces, no surrounding punctuation
export const normaliseKeyword = (keyword: string) =>
  (keyword || '')
    .toLowerCase()
    .replace(/[“”"’']/g, '')
    .replace(/[^\p{L}\p{N}&+\- ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
