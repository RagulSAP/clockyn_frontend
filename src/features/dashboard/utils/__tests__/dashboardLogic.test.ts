import { todayIST } from '@/lib/datetime';
import type { DashboardStats, DepartmentStats } from '@/types/api/home';

import {
  clampToToday,
  departmentBadges,
  hasNoAttendanceData,
  overviewParams,
  staffListParams,
  summaryFigures,
} from '../dashboardLogic';

const stats = (over: Partial<DashboardStats> = {}): DashboardStats => ({
  totalStaff: 10,
  punchedIn: 0,
  working: 0,
  punchedOut: 0,
  absent: 10,
  latePunchedIn: 0,
  ...over,
});

describe('summaryFigures', () => {
  it('lists the six figures in v1 order with the v1 labels', () => {
    const figs = summaryFigures(stats({ totalStaff: 12, absent: 2, latePunchedIn: 3, punchedIn: 4, working: 4, punchedOut: 1 }));
    expect(figs.map((f) => [f.key, f.label, f.value])).toEqual([
      ['total', 'Total Staff', 12],
      ['absent', 'Absent', 2],
      ['late', 'Late Punched-In', 3],
      ['punched_in', 'Punched-In', 4],
      ['working', 'Working', 4],
      ['punched_out', 'Punched Out', 1],
    ]);
  });

  it('is all zeros without data', () => {
    expect(summaryFigures(undefined).every((f) => f.value === 0)).toBe(true);
  });
});

describe('hasNoAttendanceData (past date, staff exist, nobody punched)', () => {
  const today = '2026-10-18';
  it('is true for a past date with staff and no punch activity', () => {
    expect(hasNoAttendanceData(stats(), '2026-10-17', today)).toBe(true);
  });
  it('ignores the absent count', () => {
    expect(hasNoAttendanceData(stats({ absent: 0 }), '2026-10-17', today)).toBe(true);
  });
  it('is false for today, however empty', () => {
    expect(hasNoAttendanceData(stats(), today, today)).toBe(false);
  });
  it('is false when anyone punched in, works or punched out', () => {
    expect(hasNoAttendanceData(stats({ punchedIn: 1 }), '2026-10-17', today)).toBe(false);
    expect(hasNoAttendanceData(stats({ working: 1 }), '2026-10-17', today)).toBe(false);
    expect(hasNoAttendanceData(stats({ punchedOut: 1 }), '2026-10-17', today)).toBe(false);
  });
  it('is false for an organisation without staff or while stats are unknown', () => {
    expect(hasNoAttendanceData(stats({ totalStaff: 0, absent: 0 }), '2026-10-17', today)).toBe(false);
    expect(hasNoAttendanceData(undefined, '2026-10-17', today)).toBe(false);
  });
  it('uses the IST business date: at 00:30 IST "today" is already the new day', () => {
    // 2026-10-17T19:00Z is 2026-10-18 00:30 IST.
    const istToday = todayIST(new Date('2026-10-17T19:00:00Z'));
    expect(istToday).toBe('2026-10-18');
    // A UTC based "today" (v1) would be 17th and would wrongly show "no record" for the 17th being past.
    expect(hasNoAttendanceData(stats(), '2026-10-18', istToday)).toBe(false);
    expect(hasNoAttendanceData(stats(), '2026-10-17', istToday)).toBe(true);
  });
});

describe('date selection', () => {
  it('clamps to today', () => {
    expect(clampToToday('2026-12-31', '2026-10-18')).toBe('2026-10-18');
    expect(clampToToday('2026-10-01', '2026-10-18')).toBe('2026-10-01');
    expect(clampToToday(undefined, '2026-10-18')).toBe('2026-10-18');
    expect(clampToToday('garbage', '2026-10-18')).toBe('2026-10-18');
  });
});

describe('route params', () => {
  it('staff list params use the correct filter values and drop empty values', () => {
    expect(staffListParams({ filter: 'punched_in', branchId: '', date: '2026-10-18' })).toEqual({
      filter: 'punched_in',
      branchId: undefined,
      date: '2026-10-18',
      deptId: undefined,
    });
    expect(staffListParams({ filter: 'punched_out', branchId: 'b1', date: '2026-10-18', deptId: 'd2' })).toEqual({
      filter: 'punched_out',
      branchId: 'b1',
      date: '2026-10-18',
      deptId: 'd2',
    });
  });
  it('overview params carry the branch filter', () => {
    expect(overviewParams({ date: '2026-10-18', branchId: 'b1' })).toEqual({ date: '2026-10-18', branchId: 'b1' });
    expect(overviewParams({ date: '2026-10-18' })).toEqual({ date: '2026-10-18', branchId: undefined });
  });
});

describe('departmentBadges', () => {
  const dept: DepartmentStats = {
    deptId: 'd1',
    deptName: 'Sales',
    totalStaff: 9,
    punchedIn: 4,
    working: 4,
    punchedOut: 2,
    absent: 3,
    latePunchedIn: 1,
  };
  it('shows real Late and Punch In counts (v1 hard-coded 0) and maps to the correct filters', () => {
    expect(departmentBadges(dept).map((b) => [b.label, b.filter, b.value])).toEqual([
      ['Total', 'total', 9],
      ['Absent', 'absent', 3],
      ['Late', 'late', 1],
      ['Working', 'working', 4],
      ['Punch In', 'punched_in', 4],
      ['Punch Out', 'punched_out', 2],
    ]);
  });
});
