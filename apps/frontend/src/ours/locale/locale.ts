// OURS: the default date locale and time zone for customers who have not
// picked their own. Wired into upstream by single marked lines in
// set.timezone.tsx, isuscitizen.utils.tsx and metric.component.tsx (see
// UPSTREAM_PATCHES.md). Set either variable to an empty string to get
// upstream's behaviour back (the browser decides).
import dayjs from 'dayjs';
import enGb from 'dayjs/locale/en-gb';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import defaults from './locale.defaults.json';

export const localeSettings = {
  // BCP 47 tag, e.g. en-GB
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? defaults.locale,
  // IANA time zone, e.g. Europe/London
  timezone: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? defaults.timezone,
};

// The app's interface language is "en"; these decide how English dates look.
// Add a variant here (en-AU, en-IE, ...) to support another region.
const englishVariants: Record<string, ILocale> = {
  'en-gb': enGb,
};

// Upstream formats dates with dayjs in the "en" locale, whose short date (L)
// is MM/DD/YYYY. We redefine "en" with the configured variant, so every
// upstream call (calendar, filters, Mantine pickers) shows that region's
// formats without touching those files.
export const applyDateLocale = (locale = localeSettings.locale) => {
  const variant = englishVariants[(locale || '').toLowerCase()];
  if (variant) {
    dayjs.locale({ ...variant, name: 'en' }, undefined, true);
  }
};

// The time zone used when the user has not chosen one in Settings.
// Empty means the browser's own time zone (upstream's behaviour).
export const defaultTimezone = () => localeSettings.timezone || '';

// Upstream's 12/24-hour switch ("US" or "GLOBAL", see isuscitizen.utils.tsx),
// for users who have not chosen one. Empty means "ask the browser".
export const defaultClock = (locale = localeSettings.locale) => {
  if (!locale) {
    return '';
  }
  return locale.toLowerCase() === 'en-us' ? 'US' : 'GLOBAL';
};

// Locale formats (L, LT, LLL...) wherever this module loads, not only on
// screens that happen to import upstream's calendar (which also extends it).
dayjs.extend(localizedFormat);
applyDateLocale();
