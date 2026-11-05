import type { StaffLocation } from '@/types/api/location';

import {
  ALL_BRANCHES,
  FRESH_MINUTES,
  computeStats,
  filterByBranch,
  fitViewport,
  freshnessOf,
  isTodayIST,
  minutesSinceUpdate,
  staffStatus,
  withCoordinates,
} from '../utils/freshness';

const NOW = Date.UTC(2025, 0, 5, 10, 0, 0);
const ago = (min: number): string => new Date(NOW - min * 60_000).toISOString();

const staff = (over: Partial<StaffLocation> = {}): StaffLocation => ({
  userId: 'u1',
  name: 'Asha Verma',
  empId: 'E1',
  branch: 'Chennai',
  department: 'Sales',
  latitude: 13.08,
  longitude: 80.27,
  updatedAt: ago(5),
  punchIn: '09:00',
  raw: {},
  ...over,
});

describe('freshness rule (15 minutes)', () => {
  it('threshold constant', () => expect(FRESH_MINUTES).toBe(15));

  it('5 min -> fresh, 20 min -> stale, none -> none', () => {
    expect(freshnessOf({ updatedAt: ago(5) }, NOW)).toBe('fresh');
    expect(freshnessOf({ updatedAt: ago(20) }, NOW)).toBe('stale');
    expect(freshnessOf({ updatedAt: undefined }, NOW)).toBe('none');
    expect(freshnessOf({ updatedAt: 'garbage' }, NOW)).toBe('none');
  });

  it('exactly 15 minutes is still fresh; 15 min 1 s is not', () => {
    expect(freshnessOf({ updatedAt: ago(15) }, NOW)).toBe('fresh');
    expect(freshnessOf({ updatedAt: new Date(NOW - 15 * 60_000 - 1000).toISOString() }, NOW)).toBe('stale');
  });

  it('timestamps without a zone are read as UTC (not the device zone)', () => {
    // 09:50 UTC written without an offset, now = 10:00 UTC -> 10 minutes
    expect(minutesSinceUpdate('2025-01-05T09:50:00', NOW)).toBeCloseTo(10, 5);
  });
});

describe('counters', () => {
  it('count punched-in staff with coordinates only', () => {
    const list = [
      staff({ userId: 'a', updatedAt: ago(1) }),
      staff({ userId: 'b', updatedAt: ago(14) }),
      staff({ userId: 'c', updatedAt: ago(30) }),
      staff({ userId: 'd', updatedAt: undefined }),
      staff({ userId: 'e', punchIn: undefined }), // not punched in -> excluded
      staff({ userId: 'f', latitude: undefined, longitude: undefined }), // no coordinates -> excluded
    ];
    const stats = computeStats(list, NOW);
    expect(stats.recent.map((s) => s.userId)).toEqual(['a', 'b']);
    expect(stats.outdated.map((s) => s.userId)).toEqual(['c', 'd']);
  });

  it('a coordinate of 0 is a valid position', () => {
    expect(withCoordinates([staff({ latitude: 0, longitude: 0 })])).toHaveLength(1);
  });
});

describe('branch filter', () => {
  const list = [staff({ userId: 'a', branch: 'Chennai' }), staff({ userId: 'b', branch: 'Pune' }), staff({ userId: 'c', branch: 'Pune' })];
  it('ALL keeps everyone, a branch keeps only its staff', () => {
    expect(filterByBranch(list, ALL_BRANCHES)).toHaveLength(3);
    expect(filterByBranch(list, 'Pune').map((s) => s.userId)).toEqual(['b', 'c']);
    expect(filterByBranch(list, 'Nowhere')).toEqual([]);
  });
  it('counters follow the filtered list', () => {
    expect(computeStats(filterByBranch(list, 'Pune'), NOW).recent).toHaveLength(2);
  });
});

describe('status text', () => {
  it('Completed / Working / Not Started', () => {
    expect(staffStatus({ punchIn: '09:00', punchOut: '18:00' })).toBe('Completed');
    expect(staffStatus({ punchIn: '09:00' })).toBe('Working');
    expect(staffStatus({})).toBe('Not Started');
  });
});

describe('today is an IST date', () => {
  it('00:30 IST on 6 Jan is still 5 Jan in UTC but "today" is the 6th', () => {
    const t = Date.UTC(2025, 0, 5, 19, 0, 0); // 00:30 IST, 6 Jan
    expect(isTodayIST('2025-01-06', t)).toBe(true);
    expect(isTodayIST('2025-01-05', t)).toBe(false);
  });
});

describe('fitViewport', () => {
  it('returns null for no points and street level for one point', () => {
    expect(fitViewport([], 400, 400)).toBeNull();
    expect(fitViewport([{ latitude: 13, longitude: 80 }], 400, 400)).toEqual({ latitude: 13, longitude: 80, zoom: 15 });
  });
  it('centres on the bounds and zooms out for far apart points', () => {
    const near = fitViewport([{ latitude: 13.0, longitude: 80.0 }, { latitude: 13.01, longitude: 80.01 }], 400, 400);
    const far = fitViewport([{ latitude: 13.0, longitude: 80.0 }, { latitude: 28.6, longitude: 77.2 }], 400, 400);
    expect(near?.latitude).toBeCloseTo(13.005, 5);
    expect(near!.zoom).toBeGreaterThan(far!.zoom);
    expect(far!.zoom).toBeGreaterThanOrEqual(3);
  });
});
