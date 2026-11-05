/**
 * Reports API: server-generated monthly attendance PDFs (admin and manager variants), the overtime report,
 * and the per-staff reads the detailed / late / employee-details reports are built on.
 *
 * Decisions
 *  - The PDF endpoints return binary files, so this module only resolves the download URL + file name
 *    (`@/lib/platform/files` `downloadAndOpen` performs the download). Month path segment is `YYYY-MM`.
 *  - Per-staff monthly attendance (`GET /home/monthly-attendance`) and the staff profile (`GET /home/staff-profile`)
 *    are implemented once, in `home.ts`; they are re-exported here under report-oriented names so report
 *    features have a single import. Failures throw (v1 returned an empty month on error).
 *  - `/api/incentive/overtime-report/{org}` is not routed in the backend repo snapshot (v1 contract followed).
 */
import { api } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/errors';
import { monthKey } from '@/lib/datetime';
import type { MonthlyAttendance } from '@/types/api/attendance';
import type {
  AttendanceReportDownload,
  AttendanceReportSelection,
  BatchedAttendanceOptions,
  BatchedAttendanceResult,
  OvertimeReportRow,
} from '@/types/api/reports';
import { getMonthlyAttendance, getStaffProfile } from './home';
import { listOf, num, rec, str } from './mappers/common';
import { apiUrl, cleanQuery, ensureSuccess, requireId, seg } from './sharedHelpers';

/** Per-staff monthly attendance for reports (`GET /home/monthly-attendance`); throws on failure. */
export const getStaffMonthlyAttendance = getMonthlyAttendance;

/** Full staff profile for the employee details report (`GET /home/staff-profile`). */
export const getEmployeeReportProfile = getStaffProfile;

/** File-name-safe fragment of an employee code / id. */
function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'staff';
}

/**
 * Resolves the PDF endpoint and file name for an attendance report selection:
 *  - admin, all staff:      `GET /api/reports/monthly-attendance-all/{orgId}/{YYYY-MM}`
 *  - admin, one staff:      `GET /api/reports/monthly-attendance/{userId}/{YYYY-MM}`
 *  - manager, all staff:    `GET /api/reports/manager/{managerId}/monthly-attendance-all/{YYYY-MM}`
 *  - manager, a team member: `GET /api/reports/manager/{managerId}/monthly-attendance/{userId}/{YYYY-MM}`
 *  - manager, self:         the admin single-staff endpoint (as in v1).
 */
export function resolveAttendanceReport(selection: AttendanceReportSelection): AttendanceReportDownload {
  const month = monthKey(selection.year, selection.month);
  let path: string;
  let filename: string;
  if (selection.staff === 'all') {
    if (selection.scope === 'admin') {
      path = `/api/reports/monthly-attendance-all/${seg(requireId(selection.orgId, 'orgId'))}/${month}`;
    } else {
      path = `/api/reports/manager/${seg(requireId(selection.managerId, 'managerId'))}/monthly-attendance-all/${month}`;
    }
    filename = `attendance_all_${month}.pdf`;
  } else {
    const pick = selection.staff;
    const userId = seg(requireId(pick.userId, 'userId'));
    if (selection.scope === 'manager' && !pick.isSelf) {
      path = `/api/reports/manager/${seg(requireId(selection.managerId, 'managerId'))}/monthly-attendance/${userId}/${month}`;
    } else {
      path = `/api/reports/monthly-attendance/${userId}/${month}`;
    }
    filename = `attendance_${safeName(pick.empId ?? pick.userId)}_${month}.pdf`;
  }
  return { url: apiUrl(path), filename, mimeType: 'application/pdf' };
}

/** Maps one wire overtime-report row. */
export function mapOvertimeRow(input: unknown): OvertimeReportRow {
  const r = rec(input);
  return { userId: str(r.user_id), otDays: num(r.ot_days), otMinutes: num(r.ot_minutes), otAmount: num(r.ot_amount) };
}

/** Overtime minutes as shown in the report (v1 `fmtMins`): `0` -> `—`, `45` -> `45m`, `120` -> `2h`, `125` -> `2h 5m`. */
export function formatOvertimeMinutes(minutes: number | null | undefined): string {
  const total = Math.round(minutes ?? 0);
  if (!Number.isFinite(total) || total <= 0) return '—';
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** `GET /api/incentive/overtime-report/{orgId}?month&year` — overtime days / minutes / pay per staff for a month. */
export async function getOvertimeReport(orgId: string, month: number, year: number): Promise<OvertimeReportRow[]> {
  const body = await api.get<unknown>(`/api/incentive/overtime-report/${seg(requireId(orgId, 'orgId'))}`, cleanQuery({ month, year }));
  ensureSuccess(body, 'Failed to load overtime report');
  return listOf(body).map(mapOvertimeRow);
}

/**
 * Loads `GET /home/monthly-attendance` for many staff, `batchSize` (default 5, as v1) at a time, reporting progress.
 * Individual failures do not abort the run; they are returned in `failed` so the screen can tell the user.
 */
export async function loadMonthlyAttendanceBatched(
  staffIds: readonly string[],
  orgId: string,
  month: number,
  year: number,
  options: BatchedAttendanceOptions = {},
): Promise<BatchedAttendanceResult> {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 5));
  const byUser = new Map<string, MonthlyAttendance>();
  const failed: BatchedAttendanceResult['failed'] = [];
  for (let i = 0; i < staffIds.length; i += batchSize) {
    const batch = staffIds.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((id) => getMonthlyAttendance(id, orgId, month, year)));
    settled.forEach((result, idx) => {
      const userId = batch[idx];
      if (result.status === 'fulfilled') byUser.set(userId, result.value);
      else failed.push({ userId, message: getErrorMessage(result.reason, 'Failed to load attendance') });
    });
    options.onProgress?.(Math.min(i + batch.length, staffIds.length), staffIds.length);
  }
  return { byUser, failed };
}
