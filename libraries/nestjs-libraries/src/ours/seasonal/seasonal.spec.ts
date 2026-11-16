// OURS: UK dates (Milestone 6). The calendar's dates agree with each other and
// with the rules they follow, every date has a source, and the right dates
// reach the caption writer for a week and a nation.
import { describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import {
  CALENDAR_CHECKED_ON,
  CALENDAR_COVERS_UNTIL,
  UK_BANK_HOLIDAYS,
  UK_NATIONS,
  UK_OCCASIONS,
} from '@gitroom/nestjs-libraries/ours/seasonal/uk.calendar';
import {
  MAX_MOMENTS_PER_WEEK,
  momentsFor,
  momentsForWeek,
  momentToFact,
  SeasonalService,
} from '@gitroom/nestjs-libraries/ours/seasonal/seasonal.service';
import { unsupportedDetails } from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';

const weekday = (date: string) => dayjs(date).format('dddd');
const dateOf = (key: string, year: number) =>
  UK_OCCASIONS.find((o) => o.key === key)!.dates.find((d) => d.startsWith(String(year)))!;
const bankHoliday = (title: string, year: number) =>
  UK_BANK_HOLIDAYS.find((b) => b.title === title && b.date.startsWith(String(year)))!.date;

describe('UK calendar data', () => {
  it('gives every date a valid day, a source link and at least one nation', () => {
    for (const o of UK_OCCASIONS) {
      expect(o.source.url).toMatch(/^https:\/\//);
      expect(o.nations.length).toBeGreaterThan(0);
      expect(o.dates.length).toBeGreaterThan(0);
      for (const d of o.dates) {
        expect(dayjs(d).format('YYYY-MM-DD')).toBe(d);
        expect(d <= CALENDAR_COVERS_UNTIL).toBe(true);
      }
    }
    for (const b of UK_BANK_HOLIDAYS) {
      expect(dayjs(b.date).format('YYYY-MM-DD')).toBe(b.date);
      expect(b.date >= CALENDAR_CHECKED_ON).toBe(true);
    }
  });

  it('puts bank holidays on weekdays, and substitute days on Mondays or Tuesdays', () => {
    for (const b of UK_BANK_HOLIDAYS) {
      expect(['Saturday', 'Sunday']).not.toContain(weekday(b.date));
      if (b.substitute) expect(['Monday', 'Tuesday']).toContain(weekday(b.date));
    }
  });

  it('agrees with the rules each date follows', () => {
    for (const year of [2027]) {
      const easterSunday = dateOf('easter-sunday', year);
      expect(weekday(easterSunday)).toBe('Sunday');
      // GOV.UK's Good Friday and Easter Monday sit either side of Easter Sunday
      expect(dayjs(bankHoliday('Good Friday', year)).add(2, 'day').format('YYYY-MM-DD')).toBe(easterSunday);
      expect(dayjs(bankHoliday('Easter Monday', year)).subtract(1, 'day').format('YYYY-MM-DD')).toBe(easterSunday);
      // Mothering Sunday is three weeks before Easter; Shrove Tuesday 47 days
      expect(dayjs(easterSunday).diff(dateOf('mothering-sunday', year), 'day')).toBe(21);
      expect(dayjs(easterSunday).diff(dateOf('shrove-tuesday', year), 'day')).toBe(47);
      // Father's Day: third Sunday in June
      const fathers = dateOf('fathers-day', year);
      expect(weekday(fathers)).toBe('Sunday');
      expect(Number(fathers.slice(8))).toBeGreaterThanOrEqual(15);
      expect(Number(fathers.slice(8))).toBeLessThanOrEqual(21);
    }
    for (const year of [2026, 2027]) {
      // Black Friday: the Friday after the fourth Thursday in November
      const bf = dateOf('black-friday', year);
      expect(weekday(bf)).toBe('Friday');
      expect(Number(bf.slice(8))).toBeGreaterThanOrEqual(23);
      expect(Number(bf.slice(8))).toBeLessThanOrEqual(29);
      // Small Business Saturday: first Saturday in December
      const sbs = dateOf('small-business-saturday', year);
      expect(weekday(sbs)).toBe('Saturday');
      expect(sbs.slice(5, 7)).toBe('12');
      expect(Number(sbs.slice(8))).toBeLessThanOrEqual(7);
    }
  });

  it('never puts offer, price or claim words in the wording a caption may repeat', () => {
    const moments = UK_NATIONS.flatMap((n) => momentsFor(n.key, CALENDAR_CHECKED_ON, '2028-12-31'));
    for (const m of moments) {
      const fact = momentToFact(m);
      // only the date itself, never a price, percentage or "deal"
      expect(unsupportedDetails(fact.value.replace(/\d+/g, ''), [])).toEqual([]);
    }
  });
});

describe('dates for a nation', () => {
  it('uses each nation’s bank holidays', () => {
    const scotland = momentsFor('scotland', '2027-08-01', '2027-08-31').map((m) => m.date);
    const england = momentsFor('england', '2027-08-01', '2027-08-31').map((m) => m.date);
    expect(scotland).toEqual(['2027-08-02']);
    expect(england).toEqual(['2027-08-30']);
    expect(momentsFor('england', '2026-11-30', '2026-11-30')).toEqual([]);
    expect(momentsFor('scotland', '2026-11-30', '2026-11-30')[0]).toMatchObject({
      name: 'St Andrew’s Day (bank holiday)',
      bankHoliday: true,
    });
  });

  it('shows an occasion that is also a bank holiday once, with both sources', () => {
    const christmas = momentsFor('wales', '2026-12-25', '2026-12-25');
    expect(christmas).toHaveLength(1);
    expect(christmas[0]).toMatchObject({ key: 'christmas-day', bankHoliday: true });
    expect(christmas[0].sources.map((s) => s.name)).toEqual(['Office Holidays', 'GOV.UK bank holidays']);
    // St Patrick's Day: a bank holiday only in Northern Ireland
    expect(momentsFor('northern-ireland', '2027-03-17', '2027-03-17')[0].bankHoliday).toBe(true);
    expect(momentsFor('england', '2027-03-17', '2027-03-17')[0].bankHoliday).toBe(false);
  });

  it('lists quiet days but never suggests them in posts', () => {
    const goodFriday = momentsFor('england', '2027-03-26', '2027-03-26');
    expect(goodFriday[0]).toMatchObject({ kind: 'bank-holiday', usedInPosts: false });
  });

  it('picks the dates in a week, plus ones coming up within their lead time', () => {
    // week of Monday 23/11/2026 in England: Black Friday that week, and
    // Small Business Saturday (05/12) is within its 10 days' lead
    const ids = momentsForWeek('england', '2026-11-23').map((m) => m.id);
    expect(ids).toEqual(['black-friday-2026-11-27', 'small-business-saturday-2026-12-05']);
    // Scotland also gets St Andrew's Day, the Monday after
    expect(momentsForWeek('scotland', '2026-11-23').map((m) => m.key)).toContain('st-andrews-day');
    // Mothering Sunday (07/03/2027) shows up within two weeks of the
    // week's last posting day (Friday)
    expect(momentsForWeek('england', '2027-02-22').map((m) => m.key)).toContain('mothering-sunday');
    expect(momentsForWeek('england', '2027-02-15').map((m) => m.key)).not.toContain('mothering-sunday');
  });

  it('turns a date into a fact with its source and its own day and date', () => {
    const [bf] = momentsForWeek('england', '2026-11-23');
    expect(momentToFact(bf)).toEqual({
      id: 'seasonal.black-friday-2026-11-27',
      field: 'seasonal',
      label: 'Black Friday',
      value: 'Black Friday: Friday 27 November 2026. A busy shopping day, on the day after Thanksgiving in the US.',
      date: '2026-11-27',
      source: { name: 'PublicHolidays.com', url: 'https://publicholidays.com/black-friday/' },
    });
    // no repeated "bank holiday" when the wording already says so
    const patrick = momentToFact(momentsFor('northern-ireland', '2027-03-17', '2027-03-17')[0]).value;
    expect(patrick.match(/bank holiday/g)).toHaveLength(1);
    expect(momentToFact(momentsFor('england', '2026-12-25', '2026-12-25')[0]).value).toBe(
      'Christmas Day: Friday 25 December 2026. It is also a bank holiday.'
    );
  });

  it('offers a date and its substitute bank holiday once', () => {
    // Boxing Day (Sat 26/12/2026) and its substitute (Mon 28/12) share a key
    const keys = momentsForWeek('england', '2026-12-21').map((m) => m.key);
    expect(keys.filter((k) => k === 'boxing-day')).toHaveLength(1);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('SeasonalService', () => {
  const makeService = (stored: { nation: string; enabled: boolean; skippedKeys: string[] } | null) => {
    const repo = {
      getSettings: vi.fn(async () => stored),
      saveSettings: vi.fn(async () => ({ id: 's1' })),
    };
    return { service: new SeasonalService(repo as never), repo };
  };

  it('uses England and dates switched on until the owner chooses', async () => {
    const { service } = makeService(null);
    const facts = await service.factsForWeek('org-1', '2026-11-23');
    expect(facts.map((f) => f.id)).toEqual([
      'seasonal.black-friday-2026-11-27',
      'seasonal.small-business-saturday-2026-12-05',
    ]);
    const overview = await service.overview('org-1', new Date('2026-11-16T10:00:00Z'));
    expect(overview).toMatchObject({ nation: 'england', enabled: true, chosen: false });
    expect(overview.upcoming[0]).toMatchObject({ key: 'black-friday', skipped: false });
  });

  it('leaves out skipped dates, and everything when turned off', async () => {
    expect(
      (await makeService({ nation: 'england', enabled: true, skippedKeys: ['black-friday'] }).service.factsForWeek('org-1', '2026-11-23')).map((f) => f.label)
    ).toEqual(['Small Business Saturday']);
    expect(
      await makeService({ nation: 'england', enabled: false, skippedKeys: [] }).service.factsForWeek('org-1', '2026-11-23')
    ).toEqual([]);
  });

  it('offers at most a few dates a week', async () => {
    // the week before Christmas 2026 in Scotland is crowded
    const facts = await makeService({ nation: 'scotland', enabled: true, skippedKeys: [] }).service.factsForWeek('org-1', '2026-12-21');
    expect(facts.length).toBeLessThanOrEqual(MAX_MOMENTS_PER_WEEK);
    expect(facts[0].label).toBe('Christmas Day');
  });

  it('saves the owner’s choices, scoped to their organisation', async () => {
    const { service, repo } = makeService({ nation: 'england', enabled: true, skippedKeys: ['halloween'] });
    await service.setSettings('org-1', { nation: 'wales' });
    expect(repo.saveSettings).toHaveBeenCalledWith('org-1', { nation: 'england' }, { nation: 'wales' });
    await service.setSkipped('org-1', 'black-friday', true);
    expect(repo.saveSettings).toHaveBeenLastCalledWith('org-1', { nation: 'england' }, { skippedKeys: ['halloween', 'black-friday'] });
    await service.setSkipped('org-1', 'halloween', false);
    expect(repo.saveSettings).toHaveBeenLastCalledWith('org-1', { nation: 'england' }, { skippedKeys: [] });
    // bank holidays are skipped by their GOV.UK name
    await service.setSkipped('org-1', 'early-may-bank-holiday', true);
    await expect(service.setSkipped('org-1', 'not-a-date', true)).rejects.toThrow('Unknown date');
    await expect(service.setSettings('org-1', { nation: 'france' })).rejects.toThrow('Choose England');
  });
});
