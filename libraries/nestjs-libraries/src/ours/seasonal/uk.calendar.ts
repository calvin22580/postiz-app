// OURS: the UK dates we may suggest in posts, each with the page it was
// checked against. Nothing here is generated: every date was copied from the
// source named next to it and checked on the date in CALENDAR_CHECKED_ON.
// To add a year: copy the dates from the same sources, update
// CALENDAR_CHECKED_ON and CALENDAR_COVERS_UNTIL, and run our unit tests
// (they cross-check Easter-based and weekday-based dates).
//
// What we leave out on purpose:
//  - Remembrance Sunday and other days of mourning: not for marketing.
//  - Religious festivals whose dates depend on the moon being sighted (Eid,
//    for example): the date isn't certain in advance.
//  - School holidays: they differ by council, so there is no one UK date.
//  - "Awareness days" without an official organiser publishing the date.

export const UK_NATIONS = [
  { key: 'england', label: 'England' },
  { key: 'wales', label: 'Wales' },
  { key: 'scotland', label: 'Scotland' },
  { key: 'northern-ireland', label: 'Northern Ireland' },
] as const;

export type UkNation = (typeof UK_NATIONS)[number]['key'];

export const DEFAULT_UK_NATION: UkNation = 'england';

export const isUkNation = (key: string): key is UkNation =>
  UK_NATIONS.some((n) => n.key === key);

const ALL: UkNation[] = ['england', 'wales', 'scotland', 'northern-ireland'];
const ENGLAND_AND_WALES: UkNation[] = ['england', 'wales'];

export const CALENDAR_CHECKED_ON = '2026-11-16';
// the last date our occasions are filled in for (bank holidays go further)
export const CALENDAR_COVERS_UNTIL = '2027-12-31';

export interface CalendarSource {
  name: string;
  url: string;
}

const GOV_UK: CalendarSource = {
  name: 'GOV.UK bank holidays',
  url: 'https://www.gov.uk/bank-holidays',
};

const officeHolidays = (path: string): CalendarSource => ({
  name: 'Office Holidays',
  url: `https://www.officeholidays.com/holidays/${path}`,
});

export type OccasionKind = 'occasion' | 'shopping' | 'national-day';

export interface UkOccasion {
  // stable key; skipping a key skips it every year
  key: string;
  name: string;
  kind: OccasionKind;
  // one plain, sourced sentence (empty when the name says it all). Never use
  // offer or price words here: a caption may repeat it, and it must not make
  // claims for the business.
  about: string;
  nations: UkNation[];
  dates: string[];
  // how many days before the date it is worth mentioning
  leadDays: number;
  source: CalendarSource;
}

export const UK_OCCASIONS: UkOccasion[] = [
  {
    key: 'black-friday',
    name: 'Black Friday',
    kind: 'shopping',
    about: 'A busy shopping day, on the day after Thanksgiving in the US.',
    nations: ALL,
    dates: ['2026-11-27', '2027-11-26'],
    leadDays: 7,
    source: { name: 'PublicHolidays.com', url: 'https://publicholidays.com/black-friday/' },
  },
  {
    key: 'small-business-saturday',
    name: 'Small Business Saturday',
    kind: 'shopping',
    about: 'A UK-wide day for supporting small and local businesses, on the first Saturday in December.',
    nations: ALL,
    dates: ['2026-12-05', '2027-12-04'],
    leadDays: 10,
    source: { name: 'Small Business Saturday UK', url: 'https://smallbusinesssaturdayuk.com/' },
  },
  {
    key: 'christmas-day',
    name: 'Christmas Day',
    kind: 'occasion',
    about: '',
    nations: ALL,
    dates: ['2026-12-25', '2027-12-25'],
    leadDays: 21,
    source: officeHolidays('united-kingdom/christmas-day'),
  },
  {
    key: 'boxing-day',
    name: 'Boxing Day',
    kind: 'occasion',
    about: 'The day after Christmas Day.',
    nations: ALL,
    dates: ['2026-12-26', '2027-12-26'],
    leadDays: 3,
    source: officeHolidays('united-kingdom/boxing-day'),
  },
  {
    key: 'burns-night',
    name: 'Burns Night',
    kind: 'national-day',
    about: 'Scotland celebrates the poet Robert Burns.',
    nations: ['scotland'],
    dates: ['2027-01-25'],
    leadDays: 7,
    source: officeHolidays('united-kingdom/burns-night'),
  },
  {
    key: 'shrove-tuesday',
    name: 'Shrove Tuesday (Pancake Day)',
    kind: 'occasion',
    about: 'Pancake Day, the day before Lent begins.',
    nations: ALL,
    dates: ['2027-02-09'],
    leadDays: 5,
    source: officeHolidays('united-kingdom/pancake-tuesday'),
  },
  {
    key: 'valentines-day',
    name: 'Valentine’s Day',
    kind: 'occasion',
    about: '',
    nations: ALL,
    dates: ['2027-02-14'],
    leadDays: 10,
    source: officeHolidays('various/st-valentines-day'),
  },
  {
    key: 'st-davids-day',
    name: 'St David’s Day',
    kind: 'national-day',
    about: 'The national day of Wales.',
    nations: ['wales'],
    dates: ['2027-03-01'],
    leadDays: 5,
    source: officeHolidays('united-kingdom/wales/st-davids-day'),
  },
  {
    key: 'mothering-sunday',
    name: 'Mothering Sunday (Mother’s Day)',
    kind: 'occasion',
    about: 'Mother’s Day in the UK, three weeks before Easter Sunday.',
    nations: ALL,
    dates: ['2027-03-07'],
    leadDays: 14,
    source: officeHolidays('united-kingdom/mothering-sunday'),
  },
  {
    key: 'st-patricks-day',
    name: 'St Patrick’s Day',
    kind: 'national-day',
    about: 'The national day of Ireland, a bank holiday in Northern Ireland.',
    nations: ALL,
    dates: ['2027-03-17'],
    leadDays: 5,
    source: officeHolidays('united-kingdom/northern-ireland/st-patricks-day'),
  },
  {
    key: 'easter-sunday',
    name: 'Easter Sunday',
    kind: 'occasion',
    about: '',
    nations: ALL,
    dates: ['2027-03-28'],
    leadDays: 10,
    source: officeHolidays('united-kingdom/easter-sunday'),
  },
  {
    key: 'st-georges-day',
    name: 'St George’s Day',
    kind: 'national-day',
    about: 'The national day of England.',
    nations: ['england'],
    dates: ['2027-04-23'],
    leadDays: 5,
    source: officeHolidays('united-kingdom/england/england-st-georges-day'),
  },
  {
    key: 'fathers-day',
    name: 'Father’s Day',
    kind: 'occasion',
    about: 'Father’s Day in the UK, on the third Sunday in June.',
    nations: ALL,
    dates: ['2027-06-20'],
    leadDays: 14,
    source: officeHolidays('united-kingdom/fathers-day'),
  },
  {
    key: 'halloween',
    name: 'Halloween',
    kind: 'occasion',
    about: '',
    nations: ALL,
    dates: ['2027-10-31'],
    leadDays: 7,
    source: officeHolidays('various/halloween'),
  },
  {
    key: 'bonfire-night',
    name: 'Bonfire Night',
    kind: 'occasion',
    about: 'Guy Fawkes Night, with bonfires and fireworks.',
    nations: ['england'],
    dates: ['2027-11-05'],
    leadDays: 5,
    source: officeHolidays('united-kingdom/guy-fawkes-night'),
  },
];

export interface UkBankHoliday {
  date: string;
  // the title exactly as GOV.UK gives it
  title: string;
  substitute: boolean;
  nations: UkNation[];
  // GOV.UK shows no bunting for these (Good Friday, Battle of the Boyne): we
  // list them, but never suggest them for a cheerful post
  quiet: boolean;
}

const bh = (
  date: string,
  title: string,
  nations: UkNation[],
  extra: Partial<Pick<UkBankHoliday, 'substitute' | 'quiet'>> = {}
): UkBankHoliday => ({ date, title, nations, substitute: false, quiet: false, ...extra });

// Copied from https://www.gov.uk/bank-holidays.json on 16/11/2026, from that
// date on. England and Wales share one list on GOV.UK.
export const UK_BANK_HOLIDAYS: UkBankHoliday[] = [
  bh('2026-11-30', 'St Andrew’s Day', ['scotland']),
  bh('2026-12-25', 'Christmas Day', ALL),
  bh('2026-12-28', 'Boxing Day', ALL, { substitute: true }),
  bh('2027-01-01', 'New Year’s Day', ALL),
  bh('2027-01-04', '2nd January', ['scotland'], { substitute: true }),
  bh('2027-03-17', 'St Patrick’s Day', ['northern-ireland']),
  bh('2027-03-26', 'Good Friday', ALL, { quiet: true }),
  bh('2027-03-29', 'Easter Monday', [...ENGLAND_AND_WALES, 'northern-ireland']),
  bh('2027-05-03', 'Early May bank holiday', ALL),
  bh('2027-05-31', 'Spring bank holiday', ALL),
  bh('2027-07-12', 'Battle of the Boyne (Orangemen’s Day)', ['northern-ireland'], { quiet: true }),
  bh('2027-08-02', 'Summer bank holiday', ['scotland']),
  bh('2027-08-30', 'Summer bank holiday', [...ENGLAND_AND_WALES, 'northern-ireland']),
  bh('2027-11-30', 'St Andrew’s Day', ['scotland']),
  bh('2027-12-27', 'Christmas Day', ALL, { substitute: true }),
  bh('2027-12-28', 'Boxing Day', ALL, { substitute: true }),
  bh('2028-01-03', 'New Year’s Day', ALL, { substitute: true }),
  bh('2028-01-04', '2nd January', ['scotland'], { substitute: true }),
  bh('2028-03-17', 'St Patrick’s Day', ['northern-ireland']),
  bh('2028-04-14', 'Good Friday', ALL, { quiet: true }),
  bh('2028-04-17', 'Easter Monday', [...ENGLAND_AND_WALES, 'northern-ireland']),
  bh('2028-05-01', 'Early May bank holiday', ALL),
  bh('2028-05-29', 'Spring bank holiday', ALL),
  bh('2028-07-12', 'Battle of the Boyne (Orangemen’s Day)', ['northern-ireland'], { quiet: true }),
  bh('2028-08-07', 'Summer bank holiday', ['scotland']),
  bh('2028-08-28', 'Summer bank holiday', [...ENGLAND_AND_WALES, 'northern-ireland']),
  bh('2028-11-30', 'St Andrew’s Day', ['scotland']),
  bh('2028-12-25', 'Christmas Day', ALL),
  bh('2028-12-26', 'Boxing Day', ALL),
];

export const BANK_HOLIDAY_SOURCE = GOV_UK;
// a bank holiday is worth a mention in the days before it (a long weekend)
export const BANK_HOLIDAY_LEAD_DAYS = 4;
