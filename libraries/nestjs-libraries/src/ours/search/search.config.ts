// OURS: "How people find you" (D1, 26/11/2026). Settings for the searches we
// suggest and watch for each business. Off unless OURS_SEARCH_REPORT is
// "true". Search data comes from DataForSEO when its login is set, otherwise
// from a labelled Simulated provider (made-up numbers, for tests and demos).

export const isSearchReportEnabled = (env: NodeJS.ProcessEnv = process.env) =>
  (env.OURS_SEARCH_REPORT || '').trim().toLowerCase() === 'true';

// DataForSEO uses HTTP Basic auth with the account's API login and password
// (https://docs.dataforseo.com/v3/auth/). Backend only, never sent to the app.
export const dataForSeoCredentials = (env: NodeJS.ProcessEnv = process.env) => {
  const login = (env.OURS_DATAFORSEO_LOGIN || '').trim();
  const password = (env.OURS_DATAFORSEO_PASSWORD || '').trim();
  return login && password ? { login, password } : null;
};

const intFromEnv = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// The country search demand is measured in. DataForSEO Labs only takes
// countries (https://docs.dataforseo.com/v3/dataforseo_labs/locations_and_languages/);
// 2826 is the United Kingdom.
export const searchMarket = (env: NodeJS.ProcessEnv = process.env) => ({
  locationCode: intFromEnv(env.OURS_SEARCH_LOCATION_CODE, 2826),
  languageCode: (env.OURS_SEARCH_LANGUAGE_CODE || 'en').trim() || 'en',
  // finishes "searches a month in …"
  label: (env.OURS_SEARCH_MARKET_LABEL || 'the UK').trim() || 'the UK',
});

// Suggestions cost money, so a business can ask for a fresh set at most
// this often (the Simulated provider is free and not limited).
export const SUGGEST_AGAIN_AFTER_MS = 24 * 60 * 60 * 1000;

// cost feature names in ours_ai_usage (one row per paid data call)
export const SEARCH_IDEAS_FEATURE = 'search.ideas';
