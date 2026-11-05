import type {
  AttendanceDay,
  AttendanceEditResult,
  AttendanceStatus,
  MonthlyAttendance,
  PunchSession,
  TodayAttendance,
} from '@/types/api/attendance';
import { arr, bool, dateOnly, hours, listOf, messageOf, num, optStr, parseLatLng, rec, str, toHHmm } from './common';

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'half_day', 'leave'];

export function mapAttendanceStatus(v: unknown): AttendanceStatus {
  const s = str(v).toLowerCase().replace(/[\s-]+/g, '_');
  return (STATUSES as string[]).includes(s) ? (s as AttendanceStatus) : 'absent';
}

export function mapAttendanceDay(input: unknown): AttendanceDay {
  const r = rec(input);
  return {
    date: dateOnly(r.date) ?? '',
    status: mapAttendanceStatus(r.status),
    punchIn: toHHmm(r.punch_in),
    punchOut: toHHmm(r.punch_out),
    punchInPhoto: optStr(r.punch_in_photo),
    punchOutPhoto: optStr(r.punch_out_photo),
    totalHours: hours(r.total_hours),
    location: parseLatLng(r.location),
    raw: r,
  };
}

/** `/home/monthly-attendance` body -> DTO (rows without a parseable date are dropped). */
export function mapMonthlyAttendance(input: unknown, month: number, year: number): MonthlyAttendance {
  const r = rec(input);
  return {
    month: num(r.month, month),
    year: num(r.year, year),
    totalDays: num(r.total_days),
    presentDays: num(r.present_days),
    absentDays: num(r.absent_days),
    lateDays: num(r.late_days),
    days: arr(r.attendance_data)
      .map(mapAttendanceDay)
      .filter((d) => d.date !== ''),
  };
}

export function mapPunchSession(input: unknown): PunchSession {
  const r = rec(input);
  return {
    punchIn: toHHmm(r.punch_in),
    punchOut: toHHmm(r.punch_out),
    punchInPhoto: optStr(r.punch_in_photo),
    punchOutPhoto: optStr(r.punch_out_photo),
    workHours: hours(r.work_hours),
  };
}

/** `/attendance/sessions/{uid}` body (`{success, sessions: []}`) -> sessions. */
export function mapSessions(body: unknown): PunchSession[] {
  return listOf(body, ['sessions', 'data']).map(mapPunchSession);
}

/** `/attendance/today/{uid}` body -> DTO. */
export function mapTodayAttendance(body: unknown): TodayAttendance {
  const r = rec(body);
  const sessions = arr(r.sessions).map(mapPunchSession);
  return {
    punchIn: toHHmm(r.punch_in),
    punchOut: toHHmm(r.punch_out),
    isPunchedIn: bool(r.is_punched_in),
    sessions,
    punchCount: sessions.length > 0 ? sessions.length : num(r.punch_count),
    totalWorkHours: num(r.total_work_hours),
  };
}

export function mapAttendanceEditResult(body: unknown): AttendanceEditResult {
  const r = rec(body);
  return {
    message: messageOf(r, 'Attendance updated successfully'),
    workHours: hours(r.work_hours),
    punchIn: toHHmm(r.punch_in),
    punchOut: toHHmm(r.punch_out),
  };
}
