/** Row model, builder and export mapping of the staff-wise detailed report. */
import type { MonthlyAttendance } from '@/types/api/attendance';
import type { StaffRequest } from '@/types/api/requests';
import type { StaffMember } from '@/types/api/staff';
import type { ExportColumnDef } from '../types';
import { computeAbsent, countHalfDays, countRequests, formatHoursWorked, totalWorkedMinutes } from './attendanceMath';
import type { ReportMonth } from './monthRange';

export interface StaffDetailedRow {
  userId: string;
  name: string;
  empId: string;
  branch: string;
  dept: string;
  roleName: string;
  photoUrl?: string;
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  sundays: number;
  /** `"{h}h {m}m"` or `"0h"`. */
  hoursWorked: string;
  hoursMinutes: number;
  leaveApproved: number;
  leaveRejected: number;
  leavePending: number;
  permissionApproved: number;
  permissionRejected: number;
  permissionPending: number;
  shiftApproved: number;
  shiftRejected: number;
  shiftPending: number;
}

/** `Manager` for role 2, `Employee` for everyone else (v1 labelling). */
export function roleLabel(roleId: number | undefined): string {
  return roleId === 2 ? 'Manager' : 'Employee';
}

export function buildStaffDetailedRow(args: {
  staff: StaffMember;
  /** `null` when the attendance request failed: the row is shown with zero attendance. */
  attendance: MonthlyAttendance | null;
  workingDays: number;
  /** Requests of THIS staff member (see `groupRequestsByUser`). */
  requests: readonly StaffRequest[];
  month: ReportMonth;
}): StaffDetailedRow {
  const { staff, attendance, workingDays, requests, month } = args;
  const counts = countRequests(requests, month.prefix);
  const present = attendance?.presentDays ?? 0;
  const days = attendance?.days ?? [];
  const minutes = totalWorkedMinutes(days);
  return {
    userId: staff.userId,
    name: staff.name,
    empId: staff.empId,
    branch: staff.branch || '-',
    dept: staff.department || '-',
    roleName: roleLabel(staff.roleId),
    photoUrl: staff.photoUrl,
    workingDays,
    present,
    absent: computeAbsent(workingDays, present, counts.approvedLeaveDays),
    late: attendance?.lateDays ?? 0,
    halfDay: countHalfDays(days),
    leave: counts.approvedLeaveDays,
    sundays: month.sundays,
    hoursWorked: formatHoursWorked(minutes),
    hoursMinutes: minutes,
    leaveApproved: counts.leave.approved,
    leaveRejected: counts.leave.rejected,
    leavePending: counts.leave.pending,
    permissionApproved: counts.permission.approved,
    permissionRejected: counts.permission.rejected,
    permissionPending: counts.permission.pending,
    shiftApproved: counts.shift.approved,
    shiftRejected: counts.shift.rejected,
    shiftPending: counts.shift.pending,
  };
}

/** The 22 export columns (v1 `getHeaders`): identity first, then the 17 table columns. */
export const STAFF_DETAILED_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'name', title: 'Name' },
  { key: 'empId', title: 'Emp ID' },
  { key: 'branch', title: 'Branch' },
  { key: 'dept', title: 'Dept' },
  { key: 'roleName', title: 'Role' },
  { key: 'workingDays', title: 'Working Days' },
  { key: 'present', title: 'Present' },
  { key: 'absent', title: 'Absent' },
  { key: 'late', title: 'Late' },
  { key: 'halfDay', title: 'Half Day' },
  { key: 'leave', title: 'Leave' },
  { key: 'sundays', title: 'Sundays' },
  { key: 'hoursWorked', title: 'Hrs Worked' },
  { key: 'leaveApproved', title: 'Leave Approved' },
  { key: 'leaveRejected', title: 'Leave Rejected' },
  { key: 'leavePending', title: 'Leave Pending' },
  { key: 'permissionApproved', title: 'Permission Approved' },
  { key: 'permissionRejected', title: 'Permission Rejected' },
  { key: 'permissionPending', title: 'Permission Pending' },
  { key: 'shiftApproved', title: 'Shift Approved' },
  { key: 'shiftRejected', title: 'Shift Rejected' },
  { key: 'shiftPending', title: 'Shift Pending' },
];

/** Export rows are the row objects themselves (keys match `STAFF_DETAILED_EXPORT_COLUMNS`). */
export function toStaffDetailedExportRows(rows: readonly StaffDetailedRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({ ...r }));
}

export type StaffDetailedColumnTone = 'text' | 'success' | 'danger' | 'warning' | 'statusHalfDay' | 'statusLeave' | 'textMuted' | 'primary';

export interface StaffDetailedColumn {
  key: keyof StaffDetailedRow;
  title: string;
  group: 'Attendance' | 'Leave Requests' | 'Permission Requests' | 'Shift Change';
  tone: StaffDetailedColumnTone;
}

/** The 17 on-screen data columns in 4 groups (8 / 3 / 3 / 3), with the v1 colour semantics as theme tones. */
export const STAFF_DETAILED_COLUMNS: StaffDetailedColumn[] = [
  { key: 'workingDays', title: 'Working Days', group: 'Attendance', tone: 'text' },
  { key: 'present', title: 'Present', group: 'Attendance', tone: 'success' },
  { key: 'absent', title: 'Absent', group: 'Attendance', tone: 'danger' },
  { key: 'late', title: 'Late', group: 'Attendance', tone: 'warning' },
  { key: 'halfDay', title: 'Half Day', group: 'Attendance', tone: 'statusHalfDay' },
  { key: 'leave', title: 'Leave', group: 'Attendance', tone: 'statusLeave' },
  { key: 'sundays', title: 'Sundays', group: 'Attendance', tone: 'textMuted' },
  { key: 'hoursWorked', title: 'Hrs Worked', group: 'Attendance', tone: 'primary' },
  { key: 'leaveApproved', title: 'Approved', group: 'Leave Requests', tone: 'success' },
  { key: 'leaveRejected', title: 'Rejected', group: 'Leave Requests', tone: 'danger' },
  { key: 'leavePending', title: 'Pending', group: 'Leave Requests', tone: 'warning' },
  { key: 'permissionApproved', title: 'Approved', group: 'Permission Requests', tone: 'success' },
  { key: 'permissionRejected', title: 'Rejected', group: 'Permission Requests', tone: 'danger' },
  { key: 'permissionPending', title: 'Pending', group: 'Permission Requests', tone: 'warning' },
  { key: 'shiftApproved', title: 'Approved', group: 'Shift Change', tone: 'success' },
  { key: 'shiftRejected', title: 'Rejected', group: 'Shift Change', tone: 'danger' },
  { key: 'shiftPending', title: 'Pending', group: 'Shift Change', tone: 'warning' },
];

/** Header groups for `DataTable` (display order: the frozen Employee column first, as an untitled spacer). */
export function staffDetailedHeaderGroups(): { title: string; span: number }[] {
  const groups: { title: string; span: number }[] = [{ title: '', span: 1 }];
  for (const col of STAFF_DETAILED_COLUMNS) {
    const last = groups[groups.length - 1];
    if (last.title === col.group) last.span += 1;
    else groups.push({ title: col.group, span: 1 });
  }
  return groups;
}

/** Zero values (`0`, `"0h"`) are drawn dimmed. */
export function isDimmedValue(value: unknown): boolean {
  return value === 0 || value === '0h';
}
