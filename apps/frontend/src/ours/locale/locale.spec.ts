import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

// A machine outside the UK, so the default time zone has to come from our setting.
process.env.TZ = 'America/New_York';

describe('UK date defaults', () => {
  beforeAll(async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
    delete process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('formats upstream "en" dates as DD/MM/YYYY with a 24-hour clock and Monday weeks', async () => {
    await import('./locale');
    dayjs.locale('en'); // what upstream's calendar does
    const date = dayjs('2026-11-03T14:05:00');
    expect(date.format('L')).toBe('03/11/2026');
    expect(date.format('LT')).toBe('14:05');
    expect(date.startOf('week').format('dddd')).toBe('Monday');
    expect(dayjs.locale()).toBe('en'); // Mantine's pickers get the same name
  });

  it('shows the calendar in Europe/London when the user has not picked a time zone', async () => {
    const { setUserTimezone, getTimezone, fromUtc } = await import(
      '@gitroom/frontend/components/layout/set.timezone'
    );
    setUserTimezone(null);
    expect(getTimezone()).toBe('Europe/London');
    // 11:00 UTC in July is 12:00 in London (BST), 07:00 in New York
    expect(fromUtc('2026-07-01T11:00:00Z').format('L HH:mm')).toBe('01/07/2026 12:00');

    // a time zone the user picked in Settings still wins
    setUserTimezone('Asia/Tokyo');
    expect(getTimezone()).toBe('Asia/Tokyo');
    setUserTimezone(null);
  });

  it('uses a 24-hour clock even when the browser is set to US English', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
    const { isUSCitizen } = await import(
      '@gitroom/frontend/components/launches/helpers/isuscitizen.utils'
    );
    expect(isUSCitizen()).toBe(false);

    // the user's own choice in Settings still wins
    vi.stubGlobal('localStorage', { getItem: () => 'US' });
    expect(isUSCitizen()).toBe(true);
  });

  it('maps locales to the 12/24-hour setting', async () => {
    const { defaultClock } = await import('./locale');
    expect(defaultClock('en-GB')).toBe('GLOBAL');
    expect(defaultClock('en-US')).toBe('US');
    expect(defaultClock('')).toBe('');
  });
});

describe('locale settings switched off', () => {
  it('falls back to the browser, as upstream does', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE = '';
    process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE = '';
    try {
      const { defaultTimezone, defaultClock } = await import('./locale');
      expect(defaultTimezone()).toBe('');
      expect(defaultClock()).toBe('');
      const { setUserTimezone, getTimezone } = await import(
        '@gitroom/frontend/components/layout/set.timezone'
      );
      setUserTimezone(null);
      expect(getTimezone()).toBe('America/New_York');
    } finally {
      delete process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
      delete process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE;
    }
  });
});
