/** Overtime report: merge of the staff list with the server's overtime figures (the staff list drives the rows). */
import { formatDurationMinutes, formatINR } from '@/lib/format';
import type { OvertimeReportRow } from '@/types/api/reports';
import type { StaffMember } from '@/types/api/staff';
import type { ExportColumnDef } from '../types';

export const OT_NONE = '—';

export interface OvertimeRow {
  userId: string;
  name: string;
  empId: string;
  branch: string;
  dept: string;
  photoUrl?: string;
  otDays: number;
  otMinutes: number;
  otAmount: number;
  /** `—`, `45m`, `2h`, `2h 5m`. */
  otHours: string;
  hasOt: boolean;
}

/**
 * One row per staff member (staff without overtime still appear with zeros), looked up by `userId`; overtime of users
 * who are not in the staff list is dropped. Sorted by overtime minutes (desc), then name.
 */
export function mergeOvertime(staff: readonly StaffMember[], report: readonly OvertimeReportRow[]): OvertimeRow[] {
  const byUser = new Map<string, OvertimeReportRow>();
  for (const r of report) byUser.set(r.userId, r);
  const rows = staff.map<OvertimeRow>((s) => {
    const ot = byUser.get(s.userId);
    const otMinutes = ot?.otMinutes ?? 0;
    return {
      userId: s.userId,
      name: s.name,
      empId: s.empId,
      branch: s.branch || OT_NONE,
      dept: s.department || OT_NONE,
      photoUrl: s.photoUrl,
      otDays: ot?.otDays ?? 0,
      otMinutes,
      otAmount: ot?.otAmount ?? 0,
      otHours: formatDurationMinutes(otMinutes, { zero: OT_NONE }),
      hasOt: otMinutes > 0,
    };
  });
  return rows.sort((a, b) => b.otMinutes - a.otMinutes || a.name.localeCompare(b.name));
}

export function countWithOvertime(rows: readonly OvertimeRow[]): number {
  return rows.filter((r) => r.hasOt).length;
}

/** `₹1,234` (Indian grouping, locale independent), `—` when zero. */
export function formatOtAmount(amount: number): string {
  return amount > 0 ? formatINR(amount) : OT_NONE;
}

/** Export columns (v1: 7). */
export const OVERTIME_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'name', title: 'Name' },
  { key: 'empId', title: 'Emp ID' },
  { key: 'branch', title: 'Branch' },
  { key: 'dept', title: 'Department' },
  { key: 'days', title: 'OT Days' },
  { key: 'otHours', title: 'OT Hours' },
  { key: 'amount', title: 'OT Amount' },
];

/** `OT Days` / `OT Hours` / `OT Amount` all use `—` when there is no overtime (v1 exported a raw 0 for days). */
export function toOvertimeExportRows(rows: readonly OvertimeRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    name: r.name,
    empId: r.empId,
    branch: r.branch,
    dept: r.dept,
    days: r.hasOt ? r.otDays : OT_NONE,
    otHours: r.otHours,
    amount: formatOtAmount(r.otAmount),
  }));
}
