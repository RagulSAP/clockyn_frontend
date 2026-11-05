import type { DateString, RawRecord, TimeString } from './common';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day' | 'leave';

/** One day of a monthly attendance report. Only dates that have an attendance row are returned by the server. */
export interface AttendanceDay {
  date: DateString;
  status: AttendanceStatus;
  /** `HH:mm` (IST). */
  punchIn?: TimeString;
  punchOut?: TimeString;
  punchInPhoto?: string;
  punchOutPhoto?: string;
  totalHours?: number;
  /** Location of the first punch-in. */
  location?: { latitude: number; longitude: number };
  raw: RawRecord;
}

export interface MonthlyAttendance {
  month: number;
  year: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  days: AttendanceDay[];
}

/** A punch-in/punch-out pair within a day (max 2 per day). */
export interface PunchSession {
  punchIn?: TimeString;
  punchOut?: TimeString;
  punchInPhoto?: string;
  punchOutPhoto?: string;
  /** Hours worked in this session (today endpoint only). */
  workHours?: number;
}

/** Today's punch state of the signed-in employee. */
export interface TodayAttendance {
  /** First punch-in of the day. */
  punchIn?: TimeString;
  /** Last punch-out of the day. */
  punchOut?: TimeString;
  isPunchedIn: boolean;
  sessions: PunchSession[];
  punchCount: number;
  totalWorkHours: number;
}

/** Input of the admin "edit attendance" action. Times are `HH:mm`. */
export interface AttendanceEditInput {
  staffId: string;
  orgId: string;
  date: DateString;
  punchIn?: TimeString;
  punchOut?: TimeString;
}

export interface AttendanceEditResult {
  message: string;
  workHours?: number;
  punchIn?: TimeString;
  punchOut?: TimeString;
}
