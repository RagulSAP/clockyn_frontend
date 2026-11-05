/**
 * Admin dashboard & staff directory reads: stats, live-status staff lists, staff detail / profile,
 * daily & monthly attendance, attendance edit, branch / department lookups.
 *
 * Org scoping: pass the organisation id for admins and the manager's OWN user id for managers on the
 * routes the server scopes (stats and lists); the server then limits results to the manager's branches.
 */
import { api } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { AttendanceEditInput, AttendanceEditResult, MonthlyAttendance } from '@/types/api/attendance';
import type { Branch } from '@/types/api/branches';
import type { Department } from '@/types/api/departments';
import type { DashboardQuery, DashboardStats, DateInfo, DepartmentStats, StaffStatusFilter } from '@/types/api/home';
import type { DailyAttendanceRow, StaffDetail, StaffMember, StaffProfile } from '@/types/api/staff';
import { mapAttendanceEditResult, mapMonthlyAttendance } from './mappers/attendance';
import { listOf, isRecord, toHHmm } from './mappers/common';
import { mapDashboardStats, mapDateInfo, mapDepartmentStats } from './mappers/home';
import { mapDailyAttendanceRow, mapStaffDetail, mapStaffMember, mapStaffProfile } from './mappers/staff';
import { listBranches } from './branches';
import { listDepartments } from './departments';
import { dateParam, requiredDateParam } from './params';

function dashboardQuery(orgId: string, q: DashboardQuery = {}) {
  return {
    user_id: orgId,
    branch_id: q.branchId || undefined,
    target_date: dateParam(q.date),
  };
}

/** Headline counters for the day (total / punched in / out / absent / late). `GET /home/dashboard-status`. */
export async function getDashboardStats(orgId: string, q: DashboardQuery = {}): Promise<DashboardStats> {
  const body = await api.get<unknown>('/home/dashboard-status', dashboardQuery(orgId, q));
  return mapDashboardStats(body);
}

/** Per-department counters for the day (all active departments, even with no staff). `GET /home/department-stats`. */
export async function getDepartmentStats(orgId: string, q: DashboardQuery = {}): Promise<DepartmentStats[]> {
  const body = await api.get<unknown>('/home/department-stats', dashboardQuery(orgId, q));
  return listOf(body).map(mapDepartmentStats);
}

/** Server date info (IST). `GET /home/current-date`. */
export async function getCurrentDate(): Promise<DateInfo> {
  return mapDateInfo(await api.get<unknown>('/home/current-date'));
}

const STATUS_ROUTES: Record<StaffStatusFilter, string> = {
  absent: '/home/absent-staff',
  late_punched_in: '/home/late-punched-in-staff',
  punched_in: '/home/punched-in-staff',
  working: '/home/working-staff',
  punched_out: '/home/punched-out-staff',
};

/**
 * Staff in one live-status bucket for the day (note: the server returns the same list for `punched_in`
 * and `working`).
 * `GET /home/{absent|late-punched-in|punched-in|working|punched-out}-staff`.
 */
export async function getStaffByStatus(status: StaffStatusFilter, orgId: string, q: DashboardQuery = {}): Promise<StaffMember[]> {
  const body = await api.get<unknown>(STATUS_ROUTES[status], dashboardQuery(orgId, q));
  return listOf(body).map(mapStaffMember);
}

/** Every active and inactive role 2/3 user of the org with today's live status. `GET /home/all-staff?user_id=`. */
export async function getAllStaff(orgId: string): Promise<StaffMember[]> {
  const body = await api.get<unknown>('/home/all-staff', { user_id: orgId });
  return listOf(body).map(mapStaffMember);
}

/** Active branches (with geofence). `GET /home/branches?org_id=`. */
export async function getBranches(orgId: string): Promise<Branch[]> {
  return listBranches(orgId);
}

/** Active departments. `GET /home/departments?org_id=`. */
export async function getDepartments(orgId: string): Promise<Department[]> {
  return listDepartments(orgId);
}

/** Summary card of one staff member (only active staff of that org are found). `GET /home/staff-detail`. */
export async function getStaffDetail(staffId: string, orgId: string): Promise<StaffDetail> {
  const body = await api.get<unknown>('/home/staff-detail', { staff_id: staffId, org_id: orgId });
  return mapStaffDetail(body);
}

/** Personal, bank and statutory details of one staff member. `GET /home/staff-profile`. */
export async function getStaffProfile(staffId: string, orgId: string): Promise<StaffProfile> {
  const body = await api.get<unknown>('/home/staff-profile', { staff_id: staffId, org_id: orgId });
  return mapStaffProfile(body);
}

/**
 * Attendance report of one day: every active staff member with punch times. `GET /home/daily-attendance`.
 * `branchId` / `deptId` of `'0'` or omitted mean all.
 */
export async function getDailyAttendance(
  orgId: string,
  date: string | Date,
  filter: { branchId?: string; deptId?: string } = {},
): Promise<DailyAttendanceRow[]> {
  const body = await api.get<unknown>('/home/daily-attendance', {
    org_id: orgId,
    target_date: requiredDateParam(date, 'date'),
    branch_id: filter.branchId || undefined,
    dept_id: filter.deptId || undefined,
  });
  return listOf(body).map(mapDailyAttendanceRow);
}

/**
 * One staff member's attendance for a month (only dates with an attendance row). `GET /home/monthly-attendance`.
 * Unlike v1, request failures throw instead of returning an empty month.
 */
export async function getMonthlyAttendance(staffId: string, orgId: string, month: number, year: number): Promise<MonthlyAttendance> {
  const body = await api.get<unknown>('/home/monthly-attendance', { staff_id: staffId, org_id: orgId, month, year });
  return mapMonthlyAttendance(body, month, year);
}

/**
 * Admin edit of a day's punch times (upsert; times are `HH:mm` IST; punch-out earlier than punch-in is
 * treated as next day by the server). `PUT /home/update-attendance-punch`.
 */
export async function updateAttendancePunch(input: AttendanceEditInput): Promise<AttendanceEditResult> {
  const punchIn = input.punchIn ? toHHmm(input.punchIn) : undefined;
  const punchOut = input.punchOut ? toHHmm(input.punchOut) : undefined;
  if ((input.punchIn && !punchIn) || (input.punchOut && !punchOut)) throw new Error('Punch times must be in HH:mm format');
  const body = assertSuccess(
    await api.put<unknown>('/home/update-attendance-punch', {
      staff_id: input.staffId,
      org_id: input.orgId,
      date: requiredDateParam(input.date, 'date'),
      punch_in: punchIn,
      punch_out: punchOut,
    }),
    'Failed to update attendance',
  );
  return mapAttendanceEditResult(body);
}

/** The organisation's admin contact (pinned in staff chat lists), or `null`. `GET /home/org-admin/{orgId}`. */
export async function getOrgAdmin(orgId: string): Promise<StaffMember | null> {
  const body = await api.get<unknown>(`/home/org-admin/${encodeURIComponent(orgId)}`);
  return isRecord(body) ? mapStaffMember(body) : null;
}
