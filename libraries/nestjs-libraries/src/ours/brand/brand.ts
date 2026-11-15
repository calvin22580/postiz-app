// OURS: brand name for text the backend sends to customers (emails).
// Same env variable as the frontend, so one setting renames everything.
const DEFAULT_BRAND_NAME = 'Tidepost';

export const brandName = (env: NodeJS.ProcessEnv = process.env) =>
  (env.NEXT_PUBLIC_BRAND_NAME || '').trim() || DEFAULT_BRAND_NAME;

// Whole-word, capitalised product name only: lower-case "postiz" in URLs,
// package names and commands is left alone.
const NAME_PATTERN = /(?<![@/.\w-])Postiz(?![\w-])/g;

export const rebrandText = (
  text: string,
  env: NodeJS.ProcessEnv = process.env
) => (text ? text.replace(NAME_PATTERN, brandName(env)) : text);
