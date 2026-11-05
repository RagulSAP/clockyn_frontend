/** DTOs for attendance / overtime reports (`src/api/reports.ts`). */
import type { MonthlyAttendance } from './attendance';

/** One staff member picked for a single-person attendance PDF. */
export interface ReportStaffPick {
  userId: string;
  empId?: string;
  /** Manager picked their own entry: the non-manager single-staff endpoint is used. */
  isSelf?: boolean;
}

/** Who is downloading, for which month (1-12) and for whom. */
export type AttendanceReportSelection =
  | { scope: 'admin'; orgId: string; year: number; month: number; staff: 'all' | ReportStaffPick }
  | { scope: 'manager'; managerId: string; year: number; month: number; staff: 'all' | ReportStaffPick };

/** Resolved download target for a server-generated PDF. */
export interface AttendanceReportDownload {
  url: string;
  /** Suggested file name, e.g. `attendance_all_2026-10.pdf`. */
  filename: string;
  mimeType: 'application/pdf';
}

/** Overtime figures of one staff member for a month. */
export interface OvertimeReportRow {
  userId: string;
  otDays: number;
  otMinutes: number;
  /** Overtime pay in INR. */
  otAmount: number;
}

/** Result of loading monthly attendance for many staff in batches. */
export interface BatchedAttendanceResult {
  /** Attendance per staff user id (only the ones that loaded). */
  byUser: Map<string, MonthlyAttendance>;
  /** Staff user ids whose request failed, with the error message. */
  failed: { userId: string; message: string }[];
}

/** Options of `loadMonthlyAttendanceBatched`. */
export interface BatchedAttendanceOptions {
  /** Requests in flight at a time (v1 used 5). */
  batchSize?: number;
  /** Called after each batch with `(done, total)`. */
  onProgress?: (done: number, total: number) => void;
}
