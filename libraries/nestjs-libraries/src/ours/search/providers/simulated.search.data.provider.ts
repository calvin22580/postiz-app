// OURS: made-up search data for tests, demos and local development, used when
// no DataForSEO login is set (D1). Repeatable (the same search always gets the
// same number) and free. The app labels everything it returns as simulated.
import {
  normaliseKeyword,
  SearchDataOutput,
  SearchDataProvider,
  SearchDemand,
  SearchMarket,
} from '@gitroom/nestjs-libraries/ours/search/providers/search.data.provider';

const IDEA_ENDINGS = ['prices', 'cost', 'how often', 'tips', 'for beginners', 'best'];

const seeded = (text: string) => {
  let seed = 0;
  for (const c of text) {
    seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  }
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

// Roughly how a small business's searches spread: most are tiny, a few are
// big. About one in five is too small to measure.
export const simulatedVolume = (keyword: string): number | null => {
  const r = seeded(keyword);
  if (r < 0.2) return null;
  return Math.max(10, Math.round((10 + 2400 * r * r * r) / 10) * 10);
};

const row = (keyword: string): SearchDemand => ({
  keyword,
  searchVolume: simulatedVolume(keyword),
  intent: 'commercial',
});

export class SimulatedSearchDataProvider implements SearchDataProvider {
  readonly name = 'simulated' as const;

  async demand(keywords: string[], _market: SearchMarket): Promise<SearchDataOutput> {
    const unique = [...new Set(keywords.map(normaliseKeyword).filter(Boolean))];
    return { rows: unique.map(row), calls: [] };
  }

  async ideas(seeds: string[], _market: SearchMarket, limit: number): Promise<SearchDataOutput> {
    const ideas = new Set<string>();
    for (const seed of seeds.map(normaliseKeyword).filter(Boolean)) {
      for (const ending of IDEA_ENDINGS) {
        ideas.add(ending === 'best' ? `best ${seed}` : `${seed} ${ending}`);
      }
    }
    const rows = [...ideas]
      .map(row)
      .filter((r) => r.searchVolume !== null)
      .sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0))
      .slice(0, limit);
    return { rows, calls: [] };
  }
}
