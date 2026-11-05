import type { DashboardStats, DateInfo, DepartmentStats } from '@/types/api/home';
import { dateOnly, num, rec, str } from './common';

export function mapDashboardStats(input: unknown): DashboardStats {
  const r = rec(input);
  return {
    totalStaff: num(r.total_staff),
    punchedIn: num(r.punched_in),
    working: num(r.working),
    punchedOut: num(r.punched_out),
    absent: num(r.absent),
    latePunchedIn: num(r.late_punched_in),
  };
}

export function mapDepartmentStats(input: unknown): DepartmentStats {
  const r = rec(input);
  return {
    ...mapDashboardStats(r),
    deptId: str(r.dept_id),
    deptName: str(r.dept_name),
  };
}

export function mapDateInfo(input: unknown): DateInfo {
  const r = rec(input);
  return {
    currentDate: dateOnly(r.current_date) ?? '',
    formattedDate: str(r.formatted_date),
    dayName: str(r.day_name),
  };
}
