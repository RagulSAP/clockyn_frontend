import type { DateString } from './common';

export interface DashboardStats {
  totalStaff: number;
  punchedIn: number;
  /** The server returns the same number as `punchedIn`. */
  working: number;
  punchedOut: number;
  absent: number;
  latePunchedIn: number;
}

export interface DepartmentStats extends DashboardStats {
  deptId: string;
  deptName: string;
}

/** Server date info (`/home/current-date`). */
export interface DateInfo {
  currentDate: DateString;
  formattedDate: string;
  dayName: string;
}

/** Which live-status list to load on the dashboard / staff directory. */
export type StaffStatusFilter = 'absent' | 'late_punched_in' | 'punched_in' | 'working' | 'punched_out';

/** Options common to the dashboard queries. */
export interface DashboardQuery {
  /** Branch filter; omit for all branches. */
  branchId?: string;
  /** `YYYY-MM-DD` (IST); defaults to today on the server. Accepts a `Date`. */
  date?: DateString | Date;
}
