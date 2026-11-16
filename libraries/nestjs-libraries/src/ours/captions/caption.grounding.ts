// OURS: "never invent facts", for captions. Whatever the writer returns, a
// caption is kept only if it is based on profile facts and every specific
// detail in it (numbers, prices, emails, links, handles, offer or award words)
// is in the business profile. Anything else is dropped, never saved.
// Milestone 6: a caption may also cite a sourced UK date, but it still needs
// at least one profile fact; a date alone isn't about the business.
import {
  CAPTION_PLATFORMS,
  CaptionFact,
  CaptionPlatform,
  isCaptionPlatform,
  isSeasonalFact,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';
import { RawCaptionPlan } from '@gitroom/nestjs-libraries/ours/captions/writers/caption.writer';
import dayjs from 'dayjs';

export interface CheckedCaption {
  day: number;
  platform: CaptionPlatform;
  theme: string;
  text: string;
  facts: CaptionFact[];
}

const NUMBER = /\d+(?:[.,:]\d+)*/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LINK = /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:co\.uk|org\.uk|com|uk|net|org|io)\b[^\s]*/gi;
const HANDLE = /(?:^|\s)@[A-Za-z0-9_.]{2,}/g;
// Words that make a claim about prices, offers, quality or credentials.
const CLAIM_WORDS = [
  'free',
  'discount',
  'discounts',
  'offer',
  'offers',
  'sale',
  'deal',
  'deals',
  'voucher',
  'cheapest',
  'cheap',
  'award',
  'awards',
  'award-winning',
  'winner',
  'guarantee',
  'guaranteed',
  'certified',
  'accredited',
  'qualified',
  'licensed',
  'insured',
  'best',
  'number one',
  'no. 1',
  'rated',
  'reviews',
  'testimonial',
  '5-star',
  'five-star',
];

const digitsOf = (s: string) => s.replace(/\D/g, '');
const lower = (s: string) => s.toLowerCase();
const trimPunctuation = (s: string) => s.replace(/[.,;:!?)\]}'"’]+$/, '');

// Every specific detail in the text that the facts do not support.
export const unsupportedDetails = (text: string, facts: CaptionFact[]) => {
  const factText = lower(facts.map((f) => f.value).join('\n'));
  const factNumbers = new Set(
    (factText.match(NUMBER) || []).map(digitsOf).filter(Boolean)
  );
  const factDigits = digitsOf(factText.replace(/\s/g, ''));
  const problems: string[] = [];

  for (const n of text.match(NUMBER) || []) {
    const d = digitsOf(n);
    // a number must be one the profile states (a phone number may be split
    // into groups, so a long group may also be part of a profile number)
    if (!factNumbers.has(d) && !(d.length >= 3 && factDigits.includes(d))) {
      problems.push(n);
    }
  }
  if (/[£$€%]/.test(text) && !/[£$€%]/.test(factText)) {
    problems.push('price or percentage');
  }
  for (const e of text.match(EMAIL) || []) {
    if (!factText.includes(lower(e))) problems.push(e);
  }
  const withoutEmails = text.replace(EMAIL, ' ');
  for (const l of withoutEmails.match(LINK) || []) {
    const bare = lower(trimPunctuation(l)).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    if (!factText.includes(bare)) problems.push(l);
  }
  for (const h of withoutEmails.match(HANDLE) || []) {
    const handle = lower(trimPunctuation(h.trim()).slice(1));
    if (!factText.includes(handle)) problems.push(h.trim());
  }
  const words = lower(text);
  for (const w of CLAIM_WORDS) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    if (re.test(words) && !re.test(factText)) problems.push(w);
  }
  return problems;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Milestone 6: the text with the names and dates of the UK dates it cites
// taken out ("Black Friday", "Friday 27 November", "27/11"), so the rest can
// be checked against the profile alone. A date's own numbers never support
// anything else ("27 years of baking" still has to be in the profile).
export const withoutCitedDates = (text: string, dates: CaptionFact[]) => {
  let out = text;
  for (const f of dates) {
    const names = [f.label, f.label?.replace(/\s*\(.*?\)/g, '')].filter((n): n is string => !!n);
    for (const name of names) {
      out = out.replace(new RegExp(escapeRegExp(name), 'gi'), ' ');
    }
    if (!f.date) continue;
    const d = dayjs(f.date);
    const day = `0?${d.date()}(?:st|nd|rd|th)?`;
    const month = d.format('MMMM');
    const year = `(?:,?\\s+${d.year()})?`;
    for (const re of [
      `(?:${d.format('dddd')},?\\s+)?(?:the\\s+)?\\b${day}(?:\\s+of)?\\s+${month}${year}`,
      `(?:${d.format('dddd')},?\\s+)?${month}\\s+${day}${year}`,
      `\\b0?${d.date()}/0?${d.month() + 1}(?:/(?:${d.year()}|${d.format('YY')}))?\\b`,
    ]) {
      out = out.replace(new RegExp(re, 'gi'), ' ');
    }
  }
  return out;
};

export const groundCaptions = (
  raw: RawCaptionPlan,
  facts: CaptionFact[],
  dayCount: number
) => {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const kept: CheckedCaption[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  const reasons: string[] = [];

  for (const post of raw?.posts || []) {
    for (const c of post?.captions || []) {
      const day = Number(post?.day);
      const platform = String(c?.platform || '');
      const text = String(c?.text || '').trim();
      const used = (c?.factIds || [])
        .map((id) => byId.get(String(id)))
        .filter((f): f is CaptionFact => !!f);
      const key = `${day}:${platform}`;
      const maxLength =
        CAPTION_PLATFORMS.find((p) => p.key === platform)?.maxLength || 0;

      // a UK date's name and date are allowed only where the caption cites
      // it; everything else is checked against the profile alone
      const problems = unsupportedDetails(
        withoutCitedDates(text, used.filter(isSeasonalFact)),
        facts.filter((f) => !isSeasonalFact(f))
      );
      const reason = !(Number.isInteger(day) && day >= 0 && day < dayCount)
        ? 'bad day'
        : !isCaptionPlatform(platform)
        ? 'bad platform'
        : seen.has(key)
        ? 'duplicate'
        : text.length < 20 || text.length > maxLength
        ? 'length'
        : !used.some((f) => !isSeasonalFact(f))
        ? 'no profile facts'
        : problems.length
        ? `not in profile: ${problems.join(', ')}`
        : '';

      if (reason) {
        dropped++;
        // why, not the caption itself, so the filter can be tuned from logs
        reasons.push(`day ${post?.day} ${platform || '?'}: ${reason}`);
        continue;
      }
      seen.add(key);
      kept.push({
        day,
        platform: platform as CaptionPlatform,
        theme: String(post?.theme || '').trim().slice(0, 120),
        text,
        facts: Array.from(new Map(used.map((f) => [f.id, f])).values()),
      });
    }
  }

  kept.sort(
    (a, b) =>
      a.day - b.day ||
      CAPTION_PLATFORMS.findIndex((p) => p.key === a.platform) -
        CAPTION_PLATFORMS.findIndex((p) => p.key === b.platform)
  );
  return { captions: kept, dropped, reasons };
};
