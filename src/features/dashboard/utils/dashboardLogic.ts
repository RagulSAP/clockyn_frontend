/**
 * Pure derivation logic of the admin dashboard (home): summary figures, the "no attendance record" rule,
 * staff-list navigation params and department badges. No React, no I/O.
 */
import type { RouteParams } from '@/lib/navigation';
import type { DashboardStats, DepartmentStats } from '@/types/api/home';

/** Filter values understood by the staff list route (`routes.admin.staff.list`, param `filter`). */
export type StaffFilter = 'total' | 'absent' | 'late' | 'punched_in' | 'working' | 'punched_out';

export const NO_ATTENDANCE_TEXT = 'No attendance record for this date';

export type SummaryFigure = {
  key: StaffFilter;
  /** Copy from the v1 summary card. */
  label: string;
  value: number;
};

/** The six figures of the Staff Overview card, in v1 order (labels verbatim). */
export const SUMMARY_FIGURE_DEFS: { key: StaffFilter; label: string; read: (s: DashboardStats) => number }[] = [
  { key: 'total', label: 'Total Staff', read: (s) => s.totalStaff },
  { key: 'absent', label: 'Absent', read: (s) => s.absent },
  { key: 'late', label: 'Late Punched-In', read: (s) => s.latePunchedIn },
  { key: 'punched_in', label: 'Punched-In', read: (s) => s.punchedIn },
  { key: 'working', label: 'Working', read: (s) => s.working },
  { key: 'punched_out', label: 'Punched Out', read: (s) => s.punchedOut },
];

export const EMPTY_STATS: DashboardStats = { totalStaff: 0, punchedIn: 0, working: 0, punchedOut: 0, absent: 0, latePunchedIn: 0 };

export function summaryFigures(stats: DashboardStats | null | undefined): SummaryFigure[] {
  const s = stats ?? EMPTY_STATS;
  return SUMMARY_FIGURE_DEFS.map((d) => ({ key: d.key, label: d.label, value: d.read(s) }));
}

/**
 * "No attendance record for this date": only for PAST dates where the organisation has staff but nobody punched
 * in, is working or punched out. Today never shows it. `date` / `today` are `YYYY-MM-DD` (IST); the absent count
 * is ignored on purpose (v1 rule).
 */
export function hasNoAttendanceData(stats: DashboardStats | null | undefined, date: string, today: string): boolean {
  if (!stats) return false;
  const anyActivity = stats.punchedIn > 0 || stats.working > 0 || stats.punchedOut > 0;
  return stats.totalStaff > 0 && !anyActivity && date < today;
}

/** Clamp a date string into `[.., today]`; invalid input falls back to today. */
export function clampToToday(date: string | null | undefined, today: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return today;
  return date > today ? today : date;
}

export type StaffListTarget = {
  filter: StaffFilter;
  /** '' / undefined = all branches. */
  branchId?: string;
  date: string;
  /** Set for department-card taps. */
  deptId?: string;
};

/** Route params of `routes.admin.staff.list` (flat strings; empty values are dropped by the router helper). */
export function staffListParams(t: StaffListTarget): RouteParams {
  return { filter: t.filter, branchId: t.branchId || undefined, date: t.date, deptId: t.deptId || undefined };
}

/** Route params of `routes.admin.overview`. The branch filter is passed on (v1 dropped it). */
export function overviewParams(t: { date: string; branchId?: string }): RouteParams {
  return { date: t.date, branchId: t.branchId || undefined };
}

export type DepartmentBadge = {
  key: string;
  label: string;
  filter: StaffFilter;
  value: number;
};

/**
 * The six badges of a department card. v1 hard-coded 0 for Late and Punch In; the department-stats endpoint does
 * return `late_punched_in` / `punched_in`, so real counts are shown.
 */
export function departmentBadges(dept: DepartmentStats): DepartmentBadge[] {
  return [
    { key: 'total', label: 'Total', filter: 'total', value: dept.totalStaff },
    { key: 'absent', label: 'Absent', filter: 'absent', value: dept.absent },
    { key: 'late', label: 'Late', filter: 'late', value: dept.latePunchedIn },
    { key: 'working', label: 'Working', filter: 'working', value: dept.working },
    { key: 'punch_in', label: 'Punch In', filter: 'punched_in', value: dept.punchedIn },
    { key: 'punch_out', label: 'Punch Out', filter: 'punched_out', value: dept.punchedOut },
  ];
}

/** Stable React key of a department card (names can repeat across ids). */
export function departmentKey(dept: DepartmentStats, index: number): string {
  return `${dept.deptId || dept.deptName}-${index}`;
}
