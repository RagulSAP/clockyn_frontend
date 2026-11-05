/**
 * Data loaders of the report screens (plain async functions so they can be unit-tested and run inside `useQuery`).
 * Partial failures never block a report: they come back as `warnings` that the screen shows in a banner
 * (v1 swallowed them silently).
 */
import type { QueryClient } from '@tanstack/react-query';
import { getAllStaff } from '@/api/home';
import { listAdminRequests } from '@/api/requests';
import { getOvertimeReport, loadMonthlyAttendanceBatched } from '@/api/reports';
import { getStaffSalaryBreakdown, getWorkingDays, listMonthlySalary } from '@/api/salaryReports';
import { listShifts } from '@/api/shifts';
import { getStaff } from '@/api/staff';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import type { StaffRequest } from '@/types/api/requests';
import type { Shift } from '@/types/api/shifts';
import { mapInBatches, unique } from '../utils/batches';
import { buildLateRows, type LateRow } from '../utils/lateRule';
import { calendarWorkingDays, reportMonth, type ReportMonth } from '../utils/monthRange';
import { groupRequestsByUser } from '../utils/attendanceMath';
import { rowsFromMonthlyList, rowsFromStaff, type PaySheet } from '../utils/monthlySalary';
import { mergeOvertime, type OvertimeRow } from '../utils/overtime';
import { groupStaffByShift, type ShiftReportData } from '../utils/shiftReport';
import { buildStaffDetailedRow, type StaffDetailedRow } from '../utils/staffDetailed';
import { zeroRowFromStaff, type SalarySheetRow } from '../utils/salarySheet';

export interface ReportResult<T> {
  rows: T[];
  warnings: string[];
}

/** Working-day figures are identical for every staff member of one branch + department: cache them for 10 minutes. */
export const WORKING_DAYS_STALE_MS = 10 * 60_000;

const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name);

/**
 * Working days of one branch + department combination, cached in the query cache so every unique combination is
 * requested ONCE per month (v1's cache never hit because all rows were built concurrently). Falls back to calendar days
 * minus Sundays when the request fails; `failed` tells the caller.
 */
export async function fetchWorkingDays(
  queryClient: QueryClient,
  orgId: string,
  month: ReportMonth,
  branch: string,
  dept: string,
): Promise<{ days: number; failed: boolean }> {
  // v1 never sent an empty / '-' placeholder as a filter (it would match no configured branch or department).
  const branchFilter = branch.trim() === '-' ? '' : branch;
  const deptFilter = dept.trim() === '-' ? '' : dept;
  try {
    const wd = await queryClient.fetchQuery({
      queryKey: queryKeys.reports.run(orgId, 'working-days', { year: month.year, month: month.month, branch: branchFilter, dept: deptFilter }),
      queryFn: () => getWorkingDays(orgId, month.year, month.month, { branchName: branchFilter || null, deptName: deptFilter || null }),
      staleTime: WORKING_DAYS_STALE_MS,
    });
    return { days: wd.workingDays, failed: false };
  } catch {
    return { days: calendarWorkingDays(month), failed: true };
  }
}

export interface LoadArgs {
  orgId: string;
  year: number;
  month: number;
  onProgress?: (caption: string) => void;
}

// ─── staff-wise detailed report ────────────────────────────────────────────────────────────────

export async function loadStaffDetailedReport(args: LoadArgs & { queryClient: QueryClient }): Promise<ReportResult<StaffDetailedRow>> {
  const { orgId, onProgress, queryClient } = args;
  const month = reportMonth(args.year, args.month);
  const warnings: string[] = [];

  onProgress?.('Fetching staff & requests...');
  const [staffList, requestsOutcome] = await Promise.all([
    getAllStaff(orgId),
    listAdminRequests(orgId).then(
      (data) => ({ ok: true as const, data }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ]);
  const staff = [...staffList].sort(byName);
  let requests: StaffRequest[] = [];
  if (requestsOutcome.ok) requests = requestsOutcome.data;
  else warnings.push(`Leave, permission and shift-change counts are unavailable (${getErrorMessage(requestsOutcome.error, 'request failed')}) and are shown as 0.`);
  const requestsByUser = groupRequestsByUser(requests);

  const ids = unique(staff.map((s) => s.userId));
  onProgress?.(`Loading attendance... (0/${ids.length})`);
  const { byUser, failed } = await loadMonthlyAttendanceBatched(ids, orgId, month.month, month.year, {
    batchSize: 5,
    onProgress: (done, total) => onProgress?.(`Loading attendance... (${done}/${total})`),
  });
  if (failed.length > 0) warnings.push(`Attendance could not be loaded for ${failed.length} staff; they are shown with zero attendance.`);

  const combos = unique(staff.map((s) => `${s.branch}\u0000${s.department}`));
  const wd = new Map<string, number>();
  let wdFailed = false;
  await Promise.all(
    combos.map(async (combo) => {
      const [branch, dept] = combo.split('\u0000');
      const res = await fetchWorkingDays(queryClient, orgId, month, branch, dept);
      wd.set(combo, res.days);
      if (res.failed) wdFailed = true;
    }),
  );
  if (wdFailed) warnings.push('Working days could not be loaded for some branches or departments; calendar days minus Sundays were used.');

  const rows = staff.map((s) =>
    buildStaffDetailedRow({
      staff: s,
      attendance: byUser.get(s.userId) ?? null,
      workingDays: wd.get(`${s.branch}\u0000${s.department}`) ?? calendarWorkingDays(month),
      requests: requestsByUser.get(s.userId) ?? [],
      month,
    }),
  );
  return { rows, warnings };
}

// ─── late report ───────────────────────────────────────────────────────────────────────────────

export interface LateReportResult extends ReportResult<LateRow> {
  /** The server sent no shift times, so "Late By" and the shift columns could not be derived. */
  shiftTimesMissing: boolean;
}

export async function loadLateReport(args: LoadArgs): Promise<LateReportResult> {
  const { orgId, onProgress } = args;
  const warnings: string[] = [];
  onProgress?.('Fetching staff...');
  const staff = await getAllStaff(orgId);
  const ids = unique(staff.map((s) => s.userId));
  onProgress?.(`Loading attendance... (0/${ids.length})`);
  const { byUser, failed } = await loadMonthlyAttendanceBatched(ids, orgId, args.month, args.year, {
    batchSize: 5,
    onProgress: (done, total) => onProgress?.(`Loading attendance... (${done}/${total})`),
  });
  if (failed.length > 0) warnings.push(`Attendance could not be loaded for ${failed.length} staff; their late days are missing from this report.`);
  const rows = buildLateRows(staff, byUser);
  const shiftTimesMissing = rows.length > 0 && rows.every((r) => r.lateMinutes === null);
  return { rows, warnings, shiftTimesMissing };
}

// ─── overtime report ───────────────────────────────────────────────────────────────────────────

export async function loadOvertimeReport(args: LoadArgs): Promise<ReportResult<OvertimeRow>> {
  const { orgId, month, year } = args;
  const [staff, ot] = await Promise.all([
    getAllStaff(orgId),
    getOvertimeReport(orgId, month, year).then(
      (data) => ({ ok: true as const, data }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ]);
  const warnings: string[] = [];
  if (!ot.ok) warnings.push(`Overtime figures are unavailable right now (${getErrorMessage(ot.error, 'request failed')}). Rows show no overtime.`);
  return { rows: mergeOvertime(staff, ot.ok ? ot.data : []), warnings };
}

// ─── employee shifts ───────────────────────────────────────────────────────────────────────────

export interface ShiftReportResult extends ShiftReportData {
  shifts: Shift[];
}

export async function loadShiftReport(orgId: string): Promise<ShiftReportResult> {
  const [shifts, staff] = await Promise.all([listShifts(orgId), getAllStaff(orgId)]);
  const ids = unique(staff.map((s) => s.userId));
  const { results, failed } = await mapInBatches(ids, 5, (id) => getStaff(id));
  const shiftIdByUser = new Map<string, number | undefined>();
  results.forEach((record, id) => shiftIdByUser.set(id, record.shiftId));
  const data = groupStaffByShift(shifts, staff, shiftIdByUser, new Set(failed));
  return { ...data, shifts };
}

// ─── monthly salary (mark as paid) ─────────────────────────────────────────────────────────────

/**
 * Prefers the server's monthly list (paid state + amounts). When that endpoint is unavailable it falls back to the staff
 * list with net salaries from the salary breakdown; paid state is then local to the session.
 */
export async function loadPaySheet(orgId: string, month: number, year: number): Promise<PaySheet> {
  try {
    const list = await listMonthlySalary(orgId, month, year);
    return { rows: rowsFromMonthlyList(list), paidFromServer: true, amountsAvailable: true };
  } catch {
    // fall through to the staff list
  }
  const [staff, breakdown] = await Promise.all([
    getAllStaff(orgId),
    getStaffSalaryBreakdown(orgId, month, year).catch(() => null),
  ]);
  return { rows: rowsFromStaff(staff, breakdown), paidFromServer: false, amountsAvailable: breakdown !== null };
}

// ─── salary sheet ──────────────────────────────────────────────────────────────────────────────

export interface SalarySheetResult {
  rows: SalarySheetRow[];
  /** Why the breakdown could not be loaded (rows are then zero-amount rows from the staff list); `null` when it loaded. */
  fallbackReason: string | null;
}

/**
 * The salary breakdown for a month. When the endpoint fails (e.g. 403 on an expired plan, 500) the sheet falls back to the
 * staff list with zero amounts — and says so (v1 did it silently).
 */
export async function loadSalarySheet(orgId: string, month: number, year: number): Promise<SalarySheetResult> {
  try {
    return { rows: await getStaffSalaryBreakdown(orgId, month, year), fallbackReason: null };
  } catch (e) {
    const staff = await getAllStaff(orgId);
    return { rows: staff.map(zeroRowFromStaff), fallbackReason: getErrorMessage(e, 'The salary breakdown is unavailable') };
  }
}
