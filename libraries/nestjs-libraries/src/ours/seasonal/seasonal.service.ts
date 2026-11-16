// OURS: UK dates for posts (Milestone 6). Picks the dates from our sourced
// calendar that fit a week and the owner's nation, minus the ones they
// skipped, and hands them to the caption writer as facts with a source.
// The writer may use them, never has to, and still needs a profile fact for
// every caption (see groundCaptions).
import { HttpException, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SeasonalRepository } from '@gitroom/nestjs-libraries/ours/seasonal/seasonal.repository';
import {
  BANK_HOLIDAY_LEAD_DAYS,
  BANK_HOLIDAY_SOURCE,
  CALENDAR_CHECKED_ON,
  CALENDAR_COVERS_UNTIL,
  CalendarSource,
  DEFAULT_UK_NATION,
  isUkNation,
  OccasionKind,
  UK_BANK_HOLIDAYS,
  UK_NATIONS,
  UK_OCCASIONS,
  UkNation,
} from '@gitroom/nestjs-libraries/ours/seasonal/uk.calendar';
import {
  CaptionFact,
  captionTimezone,
  longDate,
  POSTING_DAYS,
  SEASONAL_FIELD,
} from '@gitroom/nestjs-libraries/ours/captions/caption.plan';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface SeasonalMoment {
  // one date: key plus the day
  id: string;
  // what the owner skips; skipping applies every year
  key: string;
  name: string;
  date: string;
  kind: OccasionKind | 'bank-holiday';
  about: string;
  // a bank holiday in the owner's nation (on its own, or on the same day)
  bankHoliday: boolean;
  // false for days GOV.UK marks without bunting (Good Friday, for example)
  usedInPosts: boolean;
  leadDays: number;
  sources: CalendarSource[];
}

// At most this many dates are offered to the writer for one week, nearest
// first, so a week doesn't turn into a list of occasions.
export const MAX_MOMENTS_PER_WEEK = 3;
// how far ahead the owner's list on the screen looks
export const UPCOMING_DAYS = 56;

const keyOf = (title: string) =>
  title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const nationsLabel = (nations: UkNation[]) => {
  if (nations.length === UK_NATIONS.length) return 'the UK';
  const names = UK_NATIONS.filter((n) => nations.includes(n.key)).map((n) => n.label);
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : names[0];
};

// Every date for one nation between two days (inclusive, YYYY-MM-DD). An
// occasion that falls on a bank holiday of the same name is one entry.
export const momentsFor = (nation: UkNation, from: string, to: string): SeasonalMoment[] => {
  const inRange = (d: string) => d >= from && d <= to;
  const moments: SeasonalMoment[] = [];

  for (const o of UK_OCCASIONS) {
    if (!o.nations.includes(nation)) continue;
    for (const date of o.dates.filter(inRange)) {
      moments.push({
        id: `${o.key}-${date}`,
        key: o.key,
        name: o.name,
        date,
        kind: o.kind,
        about: o.about,
        bankHoliday: false,
        usedInPosts: true,
        leadDays: o.leadDays,
        sources: [o.source],
      });
    }
  }

  for (const b of UK_BANK_HOLIDAYS) {
    if (!b.nations.includes(nation) || !inRange(b.date)) continue;
    const same = moments.find((m) => m.date === b.date && keyOf(m.name) === keyOf(b.title));
    if (same) {
      same.bankHoliday = true;
      same.sources.push(BANK_HOLIDAY_SOURCE);
      continue;
    }
    const name = b.substitute
      ? `${b.title} bank holiday (substitute day)`
      : /bank holiday/i.test(b.title)
      ? b.title
      : `${b.title} (bank holiday)`;
    moments.push({
      id: `${keyOf(b.title)}-${b.date}`,
      key: keyOf(b.title),
      name,
      date: b.date,
      kind: 'bank-holiday',
      about: `A bank holiday in ${nationsLabel(b.nations)}.`,
      bankHoliday: true,
      usedInPosts: !b.quiet,
      leadDays: BANK_HOLIDAY_LEAD_DAYS,
      sources: [BANK_HOLIDAY_SOURCE],
    });
  }

  return moments.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
};

// The dates worth mentioning in the week starting weekStart (a Monday): ones
// in that week, or coming up soon enough after its last posting day for their
// lead time. One entry per key: the substitute bank holiday for Boxing Day
// doesn't take a second place next to Boxing Day itself.
export const momentsForWeek = (nation: UkNation, weekStart: string) => {
  const longestLead = Math.max(BANK_HOLIDAY_LEAD_DAYS, ...UK_OCCASIONS.map((o) => o.leadDays));
  const weekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');
  const lastPost = dayjs(weekStart).add(POSTING_DAYS.length - 1, 'day');
  const horizon = lastPost.add(longestLead, 'day').format('YYYY-MM-DD');
  const seen = new Set<string>();
  return momentsFor(nation, weekStart, horizon).filter((m) => {
    const fits = m.date <= weekEnd || dayjs(m.date).diff(lastPost, 'day') <= m.leadDays;
    if (!fits || seen.has(m.key)) return false;
    seen.add(m.key);
    return true;
  });
};

// A date as a fact the writer can use. Its wording is ours and checked, so a
// caption may repeat it, including the day and date.
export const momentToFact = (m: SeasonalMoment): CaptionFact => ({
  id: `${SEASONAL_FIELD}.${m.id}`,
  field: SEASONAL_FIELD,
  label: m.name,
  value: [
    `${m.name}: ${longDate(m.date)}.`,
    m.about,
    m.bankHoliday && !/bank holiday/i.test(`${m.name} ${m.about}`) ? 'It is also a bank holiday.' : '',
  ]
    .filter(Boolean)
    .join(' '),
  date: m.date,
  source: m.sources[0],
});

@Injectable()
export class SeasonalService {
  constructor(private _seasonalRepository: SeasonalRepository) {}

  async getSettings(orgId: string) {
    const stored = await this._seasonalRepository.getSettings(orgId);
    return {
      nation: stored && isUkNation(stored.nation) ? stored.nation : DEFAULT_UK_NATION,
      // until the owner says otherwise, dates are used
      enabled: stored ? stored.enabled : true,
      chosen: !!stored,
      skippedKeys: stored?.skippedKeys || [],
    };
  }

  // The owner's view: the dates coming up for their nation, which ones are
  // skipped, and where each was checked.
  async overview(orgId: string, now: Date = new Date()) {
    const settings = await this.getSettings(orgId);
    const today = dayjs(now).tz(captionTimezone()).format('YYYY-MM-DD');
    const until = dayjs(today).add(UPCOMING_DAYS, 'day').format('YYYY-MM-DD');
    return {
      nation: settings.nation,
      enabled: settings.enabled,
      chosen: settings.chosen,
      nations: UK_NATIONS,
      defaultNation: DEFAULT_UK_NATION,
      upcomingDays: UPCOMING_DAYS,
      checkedOn: CALENDAR_CHECKED_ON,
      coversUntil: CALENDAR_COVERS_UNTIL,
      upcoming: momentsFor(settings.nation, today, until).map((m) => ({
        ...m,
        skipped: settings.skippedKeys.includes(m.key),
      })),
    };
  }

  async setSettings(orgId: string, data: { nation?: string; enabled?: boolean }) {
    if (data.nation !== undefined && !isUkNation(data.nation)) {
      throw new HttpException('Choose England, Wales, Scotland or Northern Ireland.', 400);
    }
    await this._seasonalRepository.saveSettings(orgId, { nation: DEFAULT_UK_NATION }, data);
    return this.overview(orgId);
  }

  async setSkipped(orgId: string, key: string, skip: boolean) {
    const known =
      UK_OCCASIONS.some((o) => o.key === key) || UK_BANK_HOLIDAYS.some((b) => keyOf(b.title) === key);
    if (!known) {
      throw new HttpException('Unknown date', 404);
    }
    // read, change, write: the screen sends one change at a time
    const { skippedKeys } = await this.getSettings(orgId);
    const next = skip
      ? Array.from(new Set([...skippedKeys, key]))
      : skippedKeys.filter((k) => k !== key);
    await this._seasonalRepository.saveSettings(orgId, { nation: DEFAULT_UK_NATION }, { skippedKeys: next });
    return this.overview(orgId);
  }

  // The facts the caption writer gets for one week (empty when the owner
  // turned dates off).
  async factsForWeek(orgId: string, weekStart: string): Promise<CaptionFact[]> {
    const settings = await this.getSettings(orgId);
    if (!settings.enabled) {
      return [];
    }
    return momentsForWeek(settings.nation, weekStart)
      .filter((m) => m.usedInPosts && !settings.skippedKeys.includes(m.key))
      .slice(0, MAX_MOMENTS_PER_WEEK)
      .map(momentToFact);
  }
}
