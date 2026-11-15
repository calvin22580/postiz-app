// OURS: the "never invent facts" check. Whatever an extractor returns, a claim
// survives only if it cites a page we actually read and quotes text that is
// really on that page. Claims without a valid source are dropped, so the field
// shows as "not found" instead of a guess.
import {
  ClaimSource,
  emptyFields,
  PROFILE_FIELDS,
  ProfileClaim,
  ProfileFields,
  RawExtraction,
} from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';

export interface GroundingPage {
  url: string;
  text: string;
}

const MIN_QUOTE = 3;
const MAX_QUOTE = 400;
const MAX_VALUE = 600;

export const normaliseForMatch = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const urlKey = (u: string) => {
  try {
    const url = new URL(u);
    url.hash = '';
    url.hostname = url.hostname.replace(/^www\./, '');
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return '';
  }
};

const digits = (s: string) => s.replace(/\D/g, '');

// Some values can be checked against their quote, not just the quote against the page.
const valueSupportedByQuotes = (
  key: string,
  value: string,
  sources: ClaimSource[]
) => {
  const quotes = sources.map((s) => normaliseForMatch(s.quote));
  if (key === 'email') {
    return quotes.some((q) => q.includes(normaliseForMatch(value)));
  }
  if (key === 'phone') {
    const d = digits(value);
    return d.length >= 6 && quotes.some((q) => digits(q).includes(d));
  }
  if (key === 'socialLinks') {
    const v = normaliseForMatch(value).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    return quotes.some((q) => q.includes(v));
  }
  if (key === 'businessName') {
    return quotes.some((q) => q.includes(normaliseForMatch(value)));
  }
  return true;
};

export interface GroundingResult {
  fields: ProfileFields;
  kept: number;
  dropped: number;
}

export const groundExtraction = (
  raw: RawExtraction,
  pages: GroundingPage[]
): GroundingResult => {
  const pageText = new Map<string, { url: string; text: string }>();
  for (const p of pages) {
    pageText.set(urlKey(p.url), { url: p.url, text: normaliseForMatch(p.text) });
  }

  const fields = emptyFields();
  let kept = 0;
  let dropped = 0;

  for (const def of PROFILE_FIELDS) {
    const claims: ProfileClaim[] = [];
    const seenValues = new Set<string>();
    for (const claim of raw?.[def.key] || []) {
      const value = (claim?.value || '').trim().slice(0, MAX_VALUE);
      if (!value) {
        continue;
      }
      const sources: ClaimSource[] = [];
      for (const src of claim.sources || []) {
        const page = pageText.get(urlKey(src?.url || ''));
        const quote = (src?.quote || '').trim();
        const q = normaliseForMatch(quote);
        if (
          page &&
          q.length >= MIN_QUOTE &&
          q.length <= MAX_QUOTE &&
          page.text.includes(q) &&
          !sources.some((s) => s.url === page.url && normaliseForMatch(s.quote) === q)
        ) {
          sources.push({ url: page.url, quote });
        }
      }
      const key = normaliseForMatch(value);
      if (
        !sources.length ||
        !valueSupportedByQuotes(def.key, value, sources) ||
        seenValues.has(key) ||
        (!def.multiple && claims.length >= 1)
      ) {
        dropped++;
        continue;
      }
      seenValues.add(key);
      claims.push({ value, origin: 'website', sources: sources.slice(0, 3) });
      kept++;
    }
    fields[def.key] = { claims };
  }

  return { fields, kept, dropped };
};
