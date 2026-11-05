import {
  addDaysStr,
  addMonthsStr,
  compareDateStr,
  currentMonthIST,
  daysBetween,
  daysInclusive,
  daysInMonth,
  daysUntil,
  datesInRange,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatRelativeTime,
  formatTime12,
  greeting,
  isLeapYear,
  isSunday,
  isValidDateStr,
  istInstant,
  istMidnight,
  localDateToStr,
  minutesToTime12,
  minutesToTime24,
  monthKey,
  monthRange,
  nowIST,
  parseDateParts,
  parseDateStr,
  parseISO,
  parseTime,
  pythonWeekday,
  shiftSpanMinutes,
  timeToMinutes,
  toDateStr,
  toISTParts,
  toShiftTime,
  toTime24,
  todayIST,
  weekdayOf,
} from '../datetime';

// 2025-01-31T23:30:00Z == 2025-02-01 05:00 IST
const UTC_JAN31_2330 = Date.UTC(2025, 0, 31, 23, 30, 0);

describe('IST "today"', () => {
  it('rolls the date forward in the 18:30-24:00 UTC window (00:00-05:30 IST)', () => {
    expect(todayIST(UTC_JAN31_2330)).toBe('2025-02-01');
    expect(todayIST(Date.UTC(2025, 0, 31, 18, 29, 59))).toBe('2025-01-31'); // 23:59:59 IST
    expect(todayIST(Date.UTC(2025, 0, 31, 18, 30, 0))).toBe('2025-02-01'); // 00:00:00 IST
    expect(todayIST(Date.UTC(2025, 0, 31, 23, 59, 59))).toBe('2025-02-01'); // 05:29:59 IST
    expect(todayIST(Date.UTC(2025, 1, 1, 0, 0, 0))).toBe('2025-02-01'); // 05:30 IST
  });

  it('crosses year boundaries', () => {
    expect(todayIST(Date.UTC(2024, 11, 31, 20, 0, 0))).toBe('2025-01-01');
  });

  it('uses the real clock by default (fake timers)', () => {
    jest.useFakeTimers().setSystemTime(UTC_JAN31_2330);
    try {
      expect(todayIST()).toBe('2025-02-01');
      expect(nowIST().time).toBe('05:00:00');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not depend on the device time zone', () => {
    const original = process.env.TZ;
    const results: string[] = [];
    try {
      for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        results.push(`${todayIST(UTC_JAN31_2330)}|${toISTParts(UTC_JAN31_2330).time}|${toDateStr(new Date(UTC_JAN31_2330))}`);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('2025-02-01|05:00:00|2025-02-01');
  });
});

describe('toISTParts / nowIST', () => {
  it('breaks an instant into IST fields', () => {
    const p = toISTParts(Date.UTC(2025, 2, 9, 12, 5, 30)); // 17:35:30 IST, Sunday
    expect(p).toMatchObject({ year: 2025, month: 3, day: 9, hour: 17, minute: 35, second: 30, weekday: 0, date: '2025-03-09', time: '17:35:30' });
    expect(p.minutes).toBeCloseTo(17 * 60 + 35 + 0.5);
  });

  it('weekday follows the IST date, not UTC', () => {
    // Saturday 20:00 UTC == Sunday 01:30 IST
    expect(toISTParts(Date.UTC(2025, 2, 8, 20, 0, 0)).weekday).toBe(0);
  });
});

describe('toDateStr', () => {
  it('passes plain dates through unchanged', () => {
    expect(toDateStr('2025-03-09')).toBe('2025-03-09');
    expect(toDateStr(' 2025-03-09 ')).toBe('2025-03-09');
  });
  it('rejects impossible dates', () => {
    expect(toDateStr('2025-02-30')).toBe('');
    expect(toDateStr('2025-13-01')).toBe('');
    expect(toDateStr('nope')).toBe('');
    expect(toDateStr(null)).toBe('');
    expect(toDateStr(undefined)).toBe('');
    expect(toDateStr('')).toBe('');
  });
  it('converts timestamps to their IST calendar date', () => {
    expect(toDateStr('2025-01-31T20:00:00Z')).toBe('2025-02-01');
    expect(toDateStr('2025-01-31T18:29:59Z')).toBe('2025-01-31');
    expect(toDateStr('2025-01-31T20:00:00+00:00')).toBe('2025-02-01');
    expect(toDateStr(new Date(Date.UTC(2025, 0, 31, 23, 59, 0)))).toBe('2025-02-01');
    expect(toDateStr(Date.UTC(2025, 0, 31, 12, 0, 0))).toBe('2025-01-31');
  });
  it('handles explicit offsets', () => {
    expect(toDateStr('2025-02-01T00:30:00+05:30')).toBe('2025-02-01');
    expect(toDateStr('2025-02-01T00:30:00-08:00')).toBe('2025-02-01'); // 08:30Z = 14:00 IST
    expect(toDateStr('2025-01-31T22:00:00-08:00')).toBe('2025-02-01'); // 06:00Z Feb 1 = 11:30 IST
  });
});

describe('parseISO', () => {
  it('parses Z, offsets and fractional seconds', () => {
    expect(parseISO('2025-01-31T20:00:00Z')?.toISOString()).toBe('2025-01-31T20:00:00.000Z');
    expect(parseISO('2025-01-31T20:00:00.123456+00:00')?.toISOString()).toBe('2025-01-31T20:00:00.123Z');
    expect(parseISO('2025-02-01T01:30:00+05:30')?.toISOString()).toBe('2025-01-31T20:00:00.000Z');
    expect(parseISO('2025-02-01 01:30:00+0530')?.toISOString()).toBe('2025-01-31T20:00:00.000Z');
    expect(parseISO('2025-02-01T01:30:00+05')?.toISOString()).toBe('2025-01-31T20:30:00.000Z');
  });
  it('treats zoneless timestamps as UTC by default and IST on request', () => {
    expect(parseISO('2025-01-31T20:00:00')?.toISOString()).toBe('2025-01-31T20:00:00.000Z');
    expect(parseISO('2025-01-31T20:00:00', { assume: 'ist' })?.toISOString()).toBe('2025-01-31T14:30:00.000Z');
  });
  it('treats date-only strings as IST midnight', () => {
    expect(parseISO('2025-02-01')?.toISOString()).toBe('2025-01-31T18:30:00.000Z');
  });
  it('rejects garbage', () => {
    expect(parseISO('2025-02-30T10:00:00Z')).toBeNull();
    expect(parseISO('2025-02-01T25:00:00Z')).toBeNull();
    expect(parseISO('01/02/2025')).toBeNull();
    expect(parseISO(undefined)).toBeNull();
    expect(parseISO('')).toBeNull();
  });
});

describe('date strings <-> picker dates', () => {
  it('parseDateStr yields local midnight with the same calendar fields', () => {
    const d = parseDateStr('2025-03-09');
    expect(d).not.toBeNull();
    expect([d!.getFullYear(), d!.getMonth() + 1, d!.getDate(), d!.getHours()]).toEqual([2025, 3, 9, 0]);
    expect(localDateToStr(d!)).toBe('2025-03-09');
  });
  it('round-trips in several device zones', () => {
    const original = process.env.TZ;
    try {
      for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kolkata']) {
        process.env.TZ = tz;
        expect(localDateToStr(parseDateStr('2025-03-09')!)).toBe('2025-03-09');
        expect(localDateToStr(parseDateStr('2024-02-29')!)).toBe('2024-02-29');
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
  it('returns null for invalid input', () => {
    expect(parseDateStr('2025-02-29')).toBeNull();
    expect(parseDateStr('')).toBeNull();
    expect(parseDateStr(null)).toBeNull();
  });
  it('parseDateParts / isValidDateStr', () => {
    expect(parseDateParts('2025-12-31')).toEqual({ year: 2025, month: 12, day: 31 });
    expect(isValidDateStr('2024-02-29')).toBe(true);
    expect(isValidDateStr('2023-02-29')).toBe(false);
    expect(isValidDateStr('2025-04-31')).toBe(false);
    expect(isValidDateStr('2025-4-1')).toBe(false);
  });
});

describe('month helpers', () => {
  it('leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
  });
  it('daysInMonth', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2025, 4)).toBe(30);
    expect(daysInMonth(2025, 12)).toBe(31);
  });
  it('monthRange covers the last day of every month (v1 dropped the month-end day)', () => {
    expect(monthRange(2025, 1)).toEqual({ start: '2025-01-01', end: '2025-01-31', days: 31 });
    expect(monthRange(2025, 2)).toEqual({ start: '2025-02-01', end: '2025-02-28', days: 28 });
    expect(monthRange(2024, 2)).toEqual({ start: '2024-02-01', end: '2024-02-29', days: 29 });
    expect(monthRange(2025, 4).end).toBe('2025-04-30');
    expect(monthRange(2025, 12).end).toBe('2025-12-31');
  });
  it('monthKey / formatMonthYear / currentMonthIST', () => {
    expect(monthKey(2025, 3)).toBe('2025-03');
    expect(formatMonthYear(2025, 1)).toBe('January 2025');
    expect(formatMonthYear(2025, 13)).toBe('--');
    expect(currentMonthIST(UTC_JAN31_2330)).toEqual({ year: 2025, month: 2 }); // already Feb 1 in IST
  });
});

describe('addDaysStr / addMonthsStr / daysBetween', () => {
  it('adds days across month, year and leap boundaries', () => {
    expect(addDaysStr('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDaysStr('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDaysStr('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysStr('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDaysStr('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDaysStr('2025-03-01', -1)).toBe('2025-02-28');
    expect(addDaysStr('2025-03-01', 0)).toBe('2025-03-01');
    expect(addDaysStr('2025-01-01', 365)).toBe('2026-01-01');
    expect(addDaysStr('2025-01-01', -1)).toBe('2024-12-31');
  });
  it('returns "" for invalid input', () => {
    expect(addDaysStr('bad', 1)).toBe('');
    expect(addDaysStr('2025-01-01', Number.NaN)).toBe('');
  });
  it('adds months with day clamping', () => {
    expect(addMonthsStr('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonthsStr('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsStr('2025-11-15', 3)).toBe('2026-02-15');
    expect(addMonthsStr('2025-01-15', -2)).toBe('2024-11-15');
    expect(addMonthsStr('2025-03-31', -1)).toBe('2025-02-28');
    expect(addMonthsStr('2025-01-15', 12)).toBe('2026-01-15');
  });
  it('daysBetween is a signed calendar difference', () => {
    expect(daysBetween('2025-01-01', '2025-01-01')).toBe(0);
    expect(daysBetween('2025-01-31', '2025-02-01')).toBe(1);
    expect(daysBetween('2025-02-01', '2025-01-31')).toBe(-1);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1);
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
    expect(daysBetween('x', '2025-01-01')).toBeNaN();
  });
  it('daysInclusive counts both ends (leave days)', () => {
    expect(daysInclusive('2025-03-10', '2025-03-10')).toBe(1);
    expect(daysInclusive('2025-03-10', '2025-03-12')).toBe(3);
    expect(daysInclusive('2025-02-27', '2025-03-02')).toBe(4);
  });
  it('datesInRange lists every day', () => {
    expect(datesInRange('2025-02-27', '2025-03-02')).toEqual(['2025-02-27', '2025-02-28', '2025-03-01', '2025-03-02']);
    expect(datesInRange('2025-03-02', '2025-02-27')).toEqual([]);
    expect(datesInRange('2025-03-02', '2025-03-02')).toEqual(['2025-03-02']);
  });
  it('daysUntil is relative to IST today', () => {
    expect(daysUntil('2025-02-08', UTC_JAN31_2330)).toBe(7); // today IST is 2025-02-01
    expect(daysUntil('2025-01-31', UTC_JAN31_2330)).toBe(-1);
  });
  it('compareDateStr orders chronologically', () => {
    expect(compareDateStr('2025-01-31', '2025-02-01')).toBe(-1);
    expect(compareDateStr('2025-02-01', '2025-02-01')).toBe(0);
    expect(compareDateStr('2025-12-01', '2025-02-01')).toBe(1);
  });
});

describe('weekdays', () => {
  it('isSunday / weekdayOf', () => {
    expect(isSunday('2025-03-09')).toBe(true);
    expect(isSunday('2025-03-10')).toBe(false);
    expect(weekdayOf('2025-03-10')).toBe(1);
    expect(weekdayOf('2024-02-29')).toBe(4); // Thursday
    expect(weekdayOf('bad')).toBe(-1);
    expect(isSunday('bad')).toBe(false);
  });
  it('pythonWeekday is Monday=0 .. Sunday=6', () => {
    expect(pythonWeekday('2025-03-10')).toBe(0);
    expect(pythonWeekday('2025-03-09')).toBe(6);
    expect(pythonWeekday('2025-03-15')).toBe(5);
    expect(pythonWeekday('bad')).toBe(-1);
  });
});

describe('formatDate', () => {
  it('default format', () => {
    expect(formatDate('2025-01-05')).toBe('05 Jan 2025');
    expect(formatDate('2025-12-31')).toBe('31 Dec 2025');
  });
  it('supports tokens and literals', () => {
    expect(formatDate('2025-01-05', 'dd/MM/yyyy')).toBe('05/01/2025');
    expect(formatDate('2025-01-05', 'EEE, dd MMM yyyy')).toBe('Sun, 05 Jan 2025');
    expect(formatDate('2025-01-05', 'EEEE, d MMMM yy')).toBe('Sunday, 5 January 25');
    expect(formatDate('2025-01-05', 'MMMM yyyy')).toBe('January 2025');
    expect(formatDate('2025-01-05', "d MMM 'at' yyyy")).toBe('5 Jan at 2025');
    expect(formatDate('2025-03-09', 'M/d')).toBe('3/9');
  });
  it('same calendar day for plain dates in any zone', () => {
    const original = process.env.TZ;
    try {
      for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
        process.env.TZ = tz;
        expect(formatDate('2025-03-09')).toBe('09 Mar 2025');
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
  it('converts timestamps to IST', () => {
    expect(formatDate('2025-01-31T20:00:00Z')).toBe('01 Feb 2025');
  });
  it('invalid -> "--"', () => {
    expect(formatDate('')).toBe('--');
    expect(formatDate(null)).toBe('--');
    expect(formatDate('garbage')).toBe('--');
    expect(formatDate('2025-02-30')).toBe('--');
  });
});

describe('time parsing & formatting', () => {
  it('parseTime handles 24h, 12h, with/without space and seconds', () => {
    expect(parseTime('09:15')).toEqual({ hour: 9, minute: 15, second: 0 });
    expect(parseTime('21:05:33')).toEqual({ hour: 21, minute: 5, second: 33 });
    expect(parseTime('9:05')).toEqual({ hour: 9, minute: 5, second: 0 });
    expect(parseTime('09:30AM')).toEqual({ hour: 9, minute: 30, second: 0 });
    expect(parseTime('09:30 pm')).toEqual({ hour: 21, minute: 30, second: 0 });
    expect(parseTime('12:00 AM')).toEqual({ hour: 0, minute: 0, second: 0 });
    expect(parseTime('12:00 PM')).toEqual({ hour: 12, minute: 0, second: 0 });
    expect(parseTime('09:15:30 AM')).toEqual({ hour: 9, minute: 15, second: 30 });
    expect(parseTime('9 PM')).toEqual({ hour: 21, minute: 0, second: 0 });
  });
  it('parseTime rejects invalid', () => {
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('13:00 PM')).toBeNull();
    expect(parseTime('0:30 AM')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parseTime(null)).toBeNull();
  });
  it('formatTime12', () => {
    expect(formatTime12('9:05')).toBe('09:05 AM');
    expect(formatTime12('09:05 am')).toBe('09:05 AM');
    expect(formatTime12('21:05:33')).toBe('09:05 PM');
    expect(formatTime12('09:30AM')).toBe('09:30 AM');
    expect(formatTime12('00:00')).toBe('12:00 AM');
    expect(formatTime12('12:00')).toBe('12:00 PM');
    expect(formatTime12('23:59')).toBe('11:59 PM');
    expect(formatTime12('21:05:33', { seconds: true })).toBe('09:05:33 PM');
    expect(formatTime12('09:05', { pad: false })).toBe('9:05 AM');
    expect(formatTime12('09:05', { space: false })).toBe('09:05AM');
  });
  it('formatTime12 converts timestamps to IST and handles empties', () => {
    expect(formatTime12('2025-01-31T15:35:00Z')).toBe('09:05 PM');
    expect(formatTime12('2025-01-31T18:30:00Z')).toBe('12:00 AM');
    expect(formatTime12(new Date(Date.UTC(2025, 0, 1, 4, 0, 0)))).toBe('09:30 AM');
    expect(formatTime12(null)).toBe('--:--');
    expect(formatTime12(undefined)).toBe('--:--');
    expect(formatTime12('')).toBe('--:--');
    expect(formatTime12('  not a time ')).toBe('not a time');
  });
  it('toTime24 / toShiftTime normalise for the API', () => {
    expect(toTime24('09:30 PM')).toBe('21:30');
    expect(toTime24('9:05')).toBe('09:05');
    expect(toTime24('12:15AM')).toBe('00:15');
    expect(toTime24('bad')).toBeNull();
    expect(toShiftTime('21:30')).toBe('09:30PM');
    expect(toShiftTime('00:05')).toBe('12:05AM');
    expect(toShiftTime('9:30 AM')).toBe('09:30AM');
    expect(toShiftTime('')).toBeNull();
  });
  it('minutes helpers', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('09:30 PM')).toBe(1290);
    expect(timeToMinutes('00:00:30')).toBeCloseTo(0.5);
    expect(timeToMinutes('x')).toBeNull();
    expect(minutesToTime24(570)).toBe('09:30');
    expect(minutesToTime24(1440 + 5)).toBe('00:05');
    expect(minutesToTime24(-30)).toBe('23:30');
    expect(minutesToTime12(570)).toBe('09:30 AM');
    expect(minutesToTime12(0)).toBe('12:00 AM');
    expect(minutesToTime12(13 * 60 + 5, { pad: false })).toBe('1:05 PM');
    expect(minutesToTime24(Number.NaN)).toBe('--:--');
  });
  it('shiftSpanMinutes applies the overnight rule', () => {
    expect(shiftSpanMinutes('09:00', '18:00')).toBe(540);
    expect(shiftSpanMinutes('22:00', '06:00')).toBe(480);
    expect(shiftSpanMinutes('10:00 PM', '06:00 AM')).toBe(480);
    expect(shiftSpanMinutes('09:00', '09:00')).toBe(1440);
    expect(shiftSpanMinutes('00:00', '00:00')).toBe(0);
    expect(shiftSpanMinutes('18:00', '00:00')).toBe(360);
    expect(shiftSpanMinutes('bad', '10:00')).toBeNull();
  });
});

describe('IST instants', () => {
  it('istMidnight / istInstant', () => {
    expect(istMidnight('2025-02-01')?.toISOString()).toBe('2025-01-31T18:30:00.000Z');
    expect(istInstant('2025-02-01', '09:30 AM')?.toISOString()).toBe('2025-02-01T04:00:00.000Z');
    expect(istInstant('2025-02-01', '00:15')?.toISOString()).toBe('2025-01-31T18:45:00.000Z');
    expect(istInstant('bad', '09:00')).toBeNull();
    expect(istInstant('2025-02-01', 'bad')).toBeNull();
  });
});

describe('formatDateTime', () => {
  it('formats in IST', () => {
    expect(formatDateTime('2025-01-31T20:00:00Z')).toBe('01 Feb 2025, 01:30 AM');
    expect(formatDateTime('2025-01-31T04:00:00Z', 'dd/MM/yyyy')).toBe('31/01/2025, 09:30 AM');
    expect(formatDateTime('2025-01-31T04:00:00', 'dd MMM', { assume: 'ist' })).toBe('31 Jan, 04:00 AM');
    expect(formatDateTime('x')).toBe('--');
    expect(formatDateTime(null)).toBe('--');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.UTC(2025, 5, 10, 12, 0, 0); // 17:30 IST
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it('follows the chat thresholds', () => {
    expect(formatRelativeTime(ago(30_000), { now })).toBe('Just now');
    expect(formatRelativeTime(ago(5 * 60_000), { now })).toBe('5m ago');
    expect(formatRelativeTime(ago(59 * 60_000), { now })).toBe('59m ago');
    expect(formatRelativeTime(ago(3 * 3_600_000), { now })).toBe('02:30 PM');
    expect(formatRelativeTime(ago(3 * 3_600_000), { now, hoursAgo: true })).toBe('3h ago');
    expect(formatRelativeTime(ago(30 * 3_600_000), { now })).toBe('Yesterday');
    expect(formatRelativeTime(ago(5 * 86_400_000), { now })).toBe('Jun 5');
  });
  it('treats future timestamps as "Just now" and invalid as empty', () => {
    expect(formatRelativeTime(new Date(now + 60_000).toISOString(), { now })).toBe('Just now');
    expect(formatRelativeTime('nope', { now })).toBe('');
    expect(formatRelativeTime(null, { now })).toBe('');
  });
});

describe('greeting (IST hour)', () => {
  const at = (h: number, m = 0) => Date.UTC(2025, 0, 10, h, m) - (5 * 60 + 30) * 60_000;
  it('uses 12/17/21 thresholds', () => {
    expect(greeting(at(0, 0))).toBe('Good Morning');
    expect(greeting(at(11, 59))).toBe('Good Morning');
    expect(greeting(at(12, 0))).toBe('Good Afternoon');
    expect(greeting(at(16, 59))).toBe('Good Afternoon');
    expect(greeting(at(17, 0))).toBe('Good Evening');
    expect(greeting(at(20, 59))).toBe('Good Evening');
    expect(greeting(at(21, 0))).toBe('Good Night');
    expect(greeting(at(23, 59))).toBe('Good Night');
  });
  it('is evaluated in IST even when the UTC hour differs', () => {
    // 20:00 UTC = 01:30 IST next day => morning
    expect(greeting(Date.UTC(2025, 0, 10, 20, 0))).toBe('Good Morning');
  });
});
