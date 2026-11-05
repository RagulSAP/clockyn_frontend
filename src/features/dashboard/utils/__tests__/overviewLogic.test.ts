import type { DailyAttendanceRow } from '@/types/api/staff';

import {
  buildPunchMaps,
  dedupeByUserId,
  formatHours,
  formatPunchTime,
  parseOverviewFilter,
  punchColumn,
  resolveDaySessions,
  sortByName,
  statusBucketOf,
  statusTone,
  tileLabel,
} from '../overviewLogic';

const row = (userId: string, over: Partial<DailyAttendanceRow> = {}): DailyAttendanceRow => ({
  userId,
  name: userId,
  empId: '',
  mobile: '',
  email: '',
  department: '',
  branch: '',
  status: 'working',
  statusLabel: 'Working',
  isActive: true,
  raw: {},
  ...over,
});

describe('filters', () => {
  it('maps tiles to API buckets (total has none)', () => {
    expect(statusBucketOf('total')).toBeNull();
    expect(statusBucketOf('late')).toBe('late_punched_in');
    expect(statusBucketOf('punched_in')).toBe('punched_in');
    expect(statusBucketOf('absent')).toBe('absent');
  });
  it('parses the route param, defaulting to total', () => {
    expect(parseOverviewFilter('working')).toBe('working');
    expect(parseOverviewFilter(['punched_out'])).toBe('punched_out');
    expect(parseOverviewFilter('punch_in')).toBe('total');
    expect(parseOverviewFilter(undefined)).toBe('total');
  });
  it('labels', () => {
    expect(tileLabel('punched_in')).toBe('Punched In');
    expect(tileLabel('late')).toBe('Late');
  });
});

describe('sorting', () => {
  it('sorts A-Z ignoring case and de-duplicates by user id', () => {
    const sorted = sortByName([{ name: 'bob' }, { name: 'Alice' }, { name: 'carl' }, { name: '' }]);
    expect(sorted.map((r) => r.name)).toEqual(['', 'Alice', 'bob', 'carl']);
    expect(dedupeByUserId([{ userId: '1' }, { userId: '2' }, { userId: '1' }])).toEqual([{ userId: '1' }, { userId: '2' }]);
  });
});

describe('punch maps (spec 7.2)', () => {
  const rows = [
    row('a', { punchIn: '09:05', punchOut: '18:00', totalHours: 8.9 }),
    row('b', { punchIn: '10:00' }),
    row('c', { punchOut: '17:30' }),
    row('d'),
  ];
  it('punched-in filter prefers the punch-in time', () => {
    expect(buildPunchMaps(rows, 'punched_in').punchMap).toEqual({ a: '09:05', b: '10:00', c: '17:30' });
  });
  it('punched-out filter prefers the punch-out time', () => {
    expect(buildPunchMaps(rows, 'punched_out').punchMap).toEqual({ a: '18:00', b: '10:00', c: '17:30' });
  });
  it('other filters use punch-in, then punch-out', () => {
    expect(buildPunchMaps(rows, 'working').punchMap).toEqual({ a: '09:05', b: '10:00', c: '17:30' });
  });
  it('collects total hours', () => {
    expect(buildPunchMaps(rows, 'total').hoursMap).toEqual({ a: 8.9 });
  });
});

describe('punch column', () => {
  const maps = buildPunchMaps([row('a', { punchIn: '09:05', punchOut: '18:00', totalHours: 8.5 }), row('b')], 'punched_out');
  it('punched out: red time + hours', () => {
    expect(punchColumn('punched_out', 'a', maps)).toEqual({ time: '06:00 PM', label: null, tone: 'danger', hours: '8.5 hrs' });
  });
  it('punched in: label + orange time, or --:-- without a time', () => {
    const m = buildPunchMaps([row('a', { punchIn: '09:05' })], 'punched_in');
    expect(punchColumn('punched_in', 'a', m)).toEqual({ time: '09:05 AM', label: 'Punch In', tone: 'warning', hours: null });
    expect(punchColumn('punched_in', 'zzz', m)).toMatchObject({ time: '--:--', tone: 'warning' });
  });
  it('absent rows without an attendance entry show nothing', () => {
    expect(punchColumn('absent', 'zzz', maps)).toMatchObject({ time: null, hours: null });
  });
  it('working / total: green time without label', () => {
    const m = buildPunchMaps([row('a', { punchIn: '09:05' })], 'working');
    expect(punchColumn('working', 'a', m)).toEqual({ time: '09:05 AM', label: null, tone: 'success', hours: null });
  });
});

describe('formatting', () => {
  it('formats punch times', () => {
    expect(formatPunchTime('14:07')).toBe('02:07 PM');
    expect(formatPunchTime(undefined)).toBe('--:--');
  });
  it('formats hours as HH:MM and carries a rounded 60 minutes', () => {
    expect(formatHours(8.5)).toBe('08:30');
    expect(formatHours(7.999)).toBe('08:00');
    expect(formatHours(0.25)).toBe('00:15');
    expect(formatHours(undefined)).toBe('--:--');
    expect(formatHours(NaN)).toBe('--:--');
  });
});

describe('sessions', () => {
  it('uses the server sessions when there are any', () => {
    const s = resolveDaySessions([{ punchIn: '09:00', punchOut: '12:00' }, { punchIn: '13:00' }], { punchIn: '09:00' });
    expect(s).toHaveLength(2);
    expect(s[1].punchIn).toBe('13:00');
  });
  it('falls back to the monthly record, then to an empty session', () => {
    expect(resolveDaySessions([], { punchIn: '09:00', punchOut: '17:00', punchInPhoto: 'p1' })).toEqual([
      { punchIn: '09:00', punchOut: '17:00', punchInPhoto: 'p1', punchOutPhoto: undefined },
    ]);
    expect(resolveDaySessions(undefined, null)).toEqual([{ punchIn: undefined, punchOut: undefined, punchInPhoto: undefined, punchOutPhoto: undefined }]);
  });
});

describe('statusTone', () => {
  it('colours the live status', () => {
    expect(statusTone('working')).toBe('success');
    expect(statusTone('absent')).toBe('danger');
    expect(statusTone('punched_in')).toBe('warning');
    expect(statusTone('punched_out')).toBe('primary');
    expect(statusTone('unknown', 'Late Punched-In')).toBe('neutral');
  });
});
