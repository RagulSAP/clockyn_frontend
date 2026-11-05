import type { AttendanceDay } from '@/types/api/attendance';

import {
  buildDayRow,
  buildMonthDays,
  calendarWeeks,
  datesWithLocation,
  deriveDay,
  formatWorkHours,
  isHalfDay,
  isLateArrival,
  summarizeMonth,
  workedMinutesFromTotal,
} from '../utils/attendanceDerive';

const NO_LEAVES: ReadonlySet<string> = new Set();

function row(date: string, over: Partial<AttendanceDay> & { raw?: Record<string, unknown> } = {}): AttendanceDay {
  return { date, status: 'present', raw: {}, ...over };
}

describe('isLateArrival', () => {
  it('has a 1 minute grace', () => {
    expect(isLateArrival('09:01', '09:00')).toBe(false);
    expect(isLateArrival('09:02', '09:00')).toBe(true);
    expect(isLateArrival('10:15', '09:30 AM')).toBe(true);
  });
  it('is false when either time is missing or unparseable', () => {
    expect(isLateArrival(undefined, '09:00')).toBe(false);
    expect(isLateArrival('09:30', undefined)).toBe(false);
    expect(isLateArrival('x', '09:00')).toBe(false);
  });
});

describe('isHalfDay', () => {
  it('uses total hours against half of the shift (9h default)', () => {
    expect(isHalfDay({ totalHours: '4:00' })).toBe(true); // 240 < 270
    expect(isHalfDay({ totalHours: '4:30' })).toBe(false); // 270 is not < 270
    expect(isHalfDay({ totalHours: 4 })).toBe(true);
    expect(isHalfDay({ totalHours: 8 })).toBe(false);
  });
  it('uses the real shift length when known', () => {
    // 6h shift -> half = 3h
    expect(isHalfDay({ totalHours: 2.5, shiftStart: '09:00', shiftEnd: '15:00' })).toBe(true);
    expect(isHalfDay({ totalHours: 3.5, shiftStart: '09:00', shiftEnd: '15:00' })).toBe(false);
  });
  it('falls back to the punch times and is false with nothing worked', () => {
    expect(isHalfDay({ punchIn: '09:00', punchOut: '12:00' })).toBe(true);
    expect(isHalfDay({ punchIn: '09:00' })).toBe(false);
    expect(isHalfDay({})).toBe(false);
  });
  it('parses H:MM:SS and decimal strings', () => {
    expect(workedMinutesFromTotal('4:30:15')).toBe(270);
    expect(workedMinutesFromTotal('1.5')).toBe(90);
    expect(workedMinutesFromTotal('')).toBeNull();
  });
});

describe('deriveDay (calendar status)', () => {
  const today = '2026-10-18'; // Sunday
  it('marks a past weekday without a record as absent', () => {
    const d = deriveDay('2026-10-14', undefined, today, NO_LEAVES);
    expect(d).toMatchObject({ status: 'absent', isFuture: false, offSunday: false });
  });
  it('leaves future days blank and Sundays without a record off', () => {
    expect(deriveDay('2026-10-20', undefined, today, NO_LEAVES)).toMatchObject({ status: '', isFuture: true });
    expect(deriveDay('2026-10-11', undefined, today, NO_LEAVES)).toMatchObject({ status: '', offSunday: true });
  });
  it('a worked Sunday shows its status, not off', () => {
    const d = deriveDay('2026-10-11', row('2026-10-11'), today, NO_LEAVES);
    expect(d).toMatchObject({ status: 'present', offSunday: false });
    expect(d.showLate || d.showHalf).toBe(false);
  });
  it('an approved leave fills a day without a record but never overrides a punch', () => {
    const leaves = new Set(['2026-10-14', '2026-10-15']);
    expect(deriveDay('2026-10-14', undefined, today, leaves).status).toBe('leave');
    expect(deriveDay('2026-10-15', row('2026-10-15', { punchIn: '09:00' }), today, leaves).status).toBe('present');
  });
  it('late arrival is still present (green) with a LATE label', () => {
    const d = deriveDay('2026-10-14', row('2026-10-14', { punchIn: '10:00', raw: { shift_start_time: '09:00' } }), today, NO_LEAVES);
    expect(d).toMatchObject({ status: 'present', late: true, showLate: true, showHalf: false });
  });
  it('half day wins over late', () => {
    const d = deriveDay(
      '2026-10-14',
      row('2026-10-14', { punchIn: '10:00', punchOut: '13:00', raw: { shift_start_time: '09:00', shift_end_time: '18:00', total_hours: '3:00' } }),
      today,
      NO_LEAVES,
    );
    expect(d).toMatchObject({ status: 'half_day', half: true, showHalf: true, showLate: false });
  });
  it('server status late counts as late present', () => {
    expect(deriveDay('2026-10-14', row('2026-10-14', { status: 'late' }), today, NO_LEAVES)).toMatchObject({ status: 'present', late: true });
  });
  it('flags today', () => {
    expect(deriveDay(today, undefined, today, NO_LEAVES).isToday).toBe(true);
  });
});

describe('buildMonthDays / calendarWeeks / summary', () => {
  it('builds every day of the month and a Monday-first grid', () => {
    const cells = buildMonthDays(2026, 10, [row('2026-10-01')], NO_LEAVES, '2026-10-05');
    expect(cells).toHaveLength(31);
    // 1 Oct 2026 is a Thursday -> 3 leading blanks
    const weeks = calendarWeeks(cells);
    expect(weeks[0].slice(0, 4).map((c) => c?.day ?? null)).toEqual([null, null, null, 1]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
  it('matches records by their IST calendar date', () => {
    const cells = buildMonthDays(2026, 10, [row('2026-10-02')], NO_LEAVES, '2026-10-05');
    expect(cells[1].status).toBe('present');
    expect(cells[2].status).toBe('absent'); // 3 Oct, Saturday, past, no record
  });
  it('summarises past days only', () => {
    const records = [row('2026-10-01'), row('2026-10-02', { punchIn: '10:00', raw: { shift_start_time: '09:00' } })];
    const cells = buildMonthDays(2026, 10, records, new Set(['2026-10-05']), '2026-10-06');
    const s = summarizeMonth(cells);
    expect(s).toMatchObject({ present: 2, late: 1, leave: 1, half: 0 });
    // 3 Oct (Sat) and 6 Oct (Tue) absent; Sundays 4 Oct off
    expect(s.absent).toBe(2);
    expect(s.weekOff).toBe(1);
  });
});

describe('formatWorkHours (H.MM, not decimal)', () => {
  it('formats H:MM strings', () => {
    expect(formatWorkHours('4:30')).toBe('4.30');
    expect(formatWorkHours('8:05:10')).toBe('8.05');
  });
  it('formats decimal hours as H.MM', () => {
    expect(formatWorkHours(4.5)).toBe('4.30');
    expect(formatWorkHours('8.25')).toBe('8.15');
    expect(formatWorkHours(1.999)).toBe('2.00');
  });
  it('shows - when missing', () => {
    expect(formatWorkHours(undefined)).toBe('-');
    expect(formatWorkHours('')).toBe('-');
    expect(formatWorkHours('abc')).toBe('-');
  });
});

describe('buildDayRow', () => {
  const today = '2026-10-18';
  it('formats a normal day', () => {
    const cell = deriveDay('2026-10-14', row('2026-10-14', { punchIn: '09:05', punchOut: '18:00', raw: { total_hours: '8:55' } }), today, NO_LEAVES);
    expect(buildDayRow(cell)).toMatchObject({
      dateLabel: '14-10-2026',
      punchIn: '09:05 AM',
      punchOut: '06:00 PM',
      hours: '8.55',
      editable: true,
      seedIn: '09:05',
      seedOut: '18:00',
    });
  });
  it('uses the shift end as a display-only fallback', () => {
    const cell = deriveDay('2026-10-14', row('2026-10-14', { punchIn: '09:05', raw: { shift_end_time: '18:00' } }), today, NO_LEAVES);
    const r = buildDayRow(cell);
    expect(r.punchOut).toBe('06:00 PM (shift end)');
    expect(r.punchOutIsShiftEnd).toBe(true);
    expect(r.seedOut).toBe('');
  });
  it('blocks off Sundays and future days', () => {
    const sunday = buildDayRow(deriveDay('2026-10-11', undefined, today, NO_LEAVES));
    expect(sunday).toMatchObject({ punchIn: '-', punchOut: '-', hours: '-', editable: false, offSunday: true });
    const future = buildDayRow(deriveDay('2026-10-20', undefined, today, NO_LEAVES));
    expect(future).toMatchObject({ editable: false, future: true });
  });
});

describe('datesWithLocation', () => {
  it('lists days whose punch-in location is non-zero', () => {
    const set = datesWithLocation([
      row('2026-10-01', { location: { latitude: 13.1, longitude: 80.2 } }),
      row('2026-10-02', { location: { latitude: 0, longitude: 0 } }),
      row('2026-10-03'),
    ]);
    expect([...set]).toEqual(['2026-10-01']);
  });
});
