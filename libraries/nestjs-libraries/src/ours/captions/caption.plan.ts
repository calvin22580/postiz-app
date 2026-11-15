// OURS: what a week of captions looks like: which days, which platforms, what
// time each goes out, and the facts from the business profile a caption may
// use. Times are in the organisation's time zone (Europe/London by default,
// OURS_DEFAULT_TIMEZONE), so other regions can be added later.
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  PROFILE_FIELDS,
  ProfileFieldKey,
  ProfileFields,
} from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';

dayjs.extend(utc);
dayjs.extend(timezone);

export const CAPTION_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', time: '12:30', maxLength: 2000 },
  { key: 'instagram', label: 'Instagram', time: '18:30', maxLength: 2200 },
  { key: 'linkedin', label: 'LinkedIn', time: '08:30', maxLength: 3000 },
] as const;

export type CaptionPlatform = (typeof CAPTION_PLATFORMS)[number]['key'];

export const isCaptionPlatform = (key: string): key is CaptionPlatform =>
  CAPTION_PLATFORMS.some((p) => p.key === key);

// One post a weekday, written for each platform. Small businesses rarely keep
// up more than this, and LinkedIn is quiet at weekends.
export const POSTING_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

export const DEFAULT_TONE = 'friendly, clear and professional';

export const captionTimezone = () =>
  process.env.OURS_DEFAULT_TIMEZONE || 'Europe/London';

// The Monday after today, in the given time zone, as YYYY-MM-DD.
export const nextWeekStart = (tz: string, now: Date = new Date()) => {
  const local = dayjs(now).tz(tz);
  const daysToMonday = ((8 - local.day()) % 7) || 7;
  return local.add(daysToMonday, 'day').format('YYYY-MM-DD');
};

export const scheduledFor = (
  weekStart: string,
  dayIndex: number,
  platform: CaptionPlatform,
  tz: string
) => {
  const time = CAPTION_PLATFORMS.find((p) => p.key === platform)!.time;
  const date = dayjs(weekStart).add(dayIndex, 'day').format('YYYY-MM-DD');
  return dayjs.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', tz).toDate();
};

// A profile claim a caption is allowed to use. Owner-entered values count too.
export interface CaptionFact {
  id: string;
  field: ProfileFieldKey;
  value: string;
}

// Contact and link fields are handy in captions; tone of voice is guidance,
// not a fact to state.
const NOT_A_FACT: ProfileFieldKey[] = ['toneOfVoice'];

export const factsFromProfile = (fields: ProfileFields): CaptionFact[] =>
  PROFILE_FIELDS.filter((f) => !NOT_A_FACT.includes(f.key)).flatMap((f) =>
    (fields[f.key]?.claims || []).map((c, i) => ({
      id: `${f.key}.${i}`,
      field: f.key,
      value: c.value,
    }))
  );

export const toneFromProfile = (fields: ProfileFields) =>
  fields.toneOfVoice?.claims?.[0]?.value || DEFAULT_TONE;

// Enough to write about: a name plus something the business does or offers.
export const hasEnoughToWrite = (facts: CaptionFact[]) =>
  facts.some((f) => f.field === 'businessName') &&
  facts.some((f) => f.field === 'whatTheyDo' || f.field === 'services');
