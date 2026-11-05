/**
 * Attendance calendar logic of the employee screen (pure, unit-tested): per-day status derivation, the client
 * half-day rule, the approved-leave overlay and the shift that applied on a day.
 */
import type { ColorTokens } from '@/theme';
import { compareDateStr, isSunday, shiftSpanMinutes, timeToMinutes } from '@/lib/datetime';
import type { AttendanceDay, AttendanceStatus } from '@/types/api/attendance';
import type { RequestCalendarDay, StaffRequest } from '@/types/api/requests';
import type { Shift } from '@/types/api/shifts';

/** Default shift length when the day carries no shift times (v1: 9 h). */
export const DEFAULT_SHIFT_MINUTES = 540;

export type EffectiveStatus = AttendanceStatus | 'none';

/** Colour token of each status (the `status*` tokens; `late` shares the present colour as in v1). */
export const STATUS_COLOR: Record<AttendanceStatus | 'weekoff', keyof ColorTokens> = {
  present: 'statusPresent',
  late: 'statusPresent',
  absent: 'statusAbsent',
  leave: 'statusLeave',
  half_day: 'statusHalfDay',
  weekoff: 'statusWeekOff',
};

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  leave: 'Leave',
  half_day: 'Half Day',
};

/** Legend entries in display order. */
export const LEGEND: { key: AttendanceStatus | 'weekoff'; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'leave', label: 'Leave' },
  { key: 'half_day', label: 'Half Day' },
  { key: 'weekoff', label: 'Sunday' },
];

export interface ShiftInfo {
  name?: string;
  /** `HH:mm` */
  start: string;
  end: string;
}

/** Shift times a monthly record may carry (the server omits them today). */
export function recordShift(record: AttendanceDay | undefined): ShiftInfo | undefined {
  if (!record) return undefined;
  const start = record.raw.shift_start_time ?? record.raw.shiftStartTime;
  const end = record.raw.shift_end_time ?? record.raw.shiftEndTime;
  return typeof start === 'string' && typeof end === 'string' && start.trim() && end.trim() ? { start: start.trim(), end: end.trim() } : undefined;
}

function diffMinutes(from: string | undefined, to: string | undefined): number {
  const a = timeToMinutes(from);
  const b = timeToMinutes(to);
  if (a === null || b === null) return 0;
  return b >= a ? b - a : b + 1440 - a; // a punch-out earlier than the punch-in is the next day
}

/** Client half-day rule: worked time is positive but under half of the shift (v1, now midnight-safe). */
export function isHalfDay(record: AttendanceDay): boolean {
  const shift = recordShift(record);
  const span = shift ? shiftSpanMinutes(shift.start, shift.end) : null;
  const shiftMins = span !== null && span > 0 ? span : DEFAULT_SHIFT_MINUTES;
  const workedMins = record.totalHours && record.totalHours > 0 ? record.totalHours * 60 : diffMinutes(record.punchIn, record.punchOut);
  return workedMins >= 1 && workedMins < shiftMins / 2;
}

/** Records plus one `leave` record for every approved-leave date that has no attendance record. */
export function mergeApprovedLeave(records: AttendanceDay[], calendar: RequestCalendarDay[]): AttendanceDay[] {
  const have = new Set(records.map((r) => r.date));
  const out = [...records];
  for (const c of calendar) {
    if (c.type === 'leave' && c.status === 'approved' && c.date && !have.has(c.date)) {
      have.add(c.date);
      out.push({ date: c.date, status: 'leave', raw: {} });
    }
  }
  return out;
}

export interface DayView {
  date: string;
  record?: AttendanceDay;
  /** Record to open in the day sheet: the real record or a synthetic Absent one for elapsed days. */
  displayRecord?: AttendanceDay;
  status: EffectiveStatus;
  /** Colour token of the cell, `null` = no status (today / future). */
  color: keyof ColorTokens | null;
  caption?: 'Late' | 'HALF';
  isSunday: boolean;
  isHalfDay: boolean;
}

/**
 * Derives what a calendar cell shows. A missing record on an elapsed day is Absent; today / future days with no
 * record have no status; Sunday is the weekly off and overrides the colour (v1 rule).
 */
export function deriveDay(date: string, record: AttendanceDay | undefined, today: string): DayView {
  const sunday = isSunday(date);
  const elapsed = compareDateStr(date, today) < 0;
  const base: EffectiveStatus = record ? record.status : elapsed ? 'absent' : 'none';
  const isLate = record?.status === 'late';
  const half = !!record && (record.status === 'half_day' || isHalfDay(record));
  const status: EffectiveStatus = half ? 'half_day' : base;
  const color: keyof ColorTokens | null = sunday ? STATUS_COLOR.weekoff : status === 'none' ? null : STATUS_COLOR[status];
  const caption = isLate && !half ? 'Late' : half && !sunday ? 'HALF' : undefined;
  const displayRecord = record ?? (base === 'absent' ? ({ date, status: 'absent', raw: {} } as AttendanceDay) : undefined);
  return { date, record, displayRecord, status, color, caption, isSunday: sunday, isHalfDay: half };
}

// ── shift history ───────────────────────────────────────────────────────────────────────────────

export interface ShiftHistoryEntry extends ShiftInfo {
  /** First day the shift applies. */
  effectiveDate: string;
  /** The shift in force before this change (when the request carried it). */
  previous?: ShiftInfo;
}

function toShiftInfo(shift: Shift | undefined): ShiftInfo | undefined {
  return shift ? { name: shift.name, start: shift.startTime, end: shift.endTime } : undefined;
}

/** Approved shift-change requests -> timeline (oldest first). The effective day is the requested change date. */
export function buildShiftHistory(requests: StaffRequest[], shifts: Shift[]): ShiftHistoryEntry[] {
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const entries: ShiftHistoryEntry[] = [];
  for (const r of requests) {
    if (r.type !== 'shift_change' || r.status !== 'approved') continue;
    const effective = r.shiftChangeDate ?? (r.actionAt ? r.actionAt.slice(0, 10) : undefined);
    const next = toShiftInfo(r.requestedShiftId !== undefined ? byId.get(r.requestedShiftId) : undefined);
    if (!effective || !next) continue;
    entries.push({
      ...next,
      effectiveDate: effective,
      previous: toShiftInfo(r.currentShiftId !== undefined ? byId.get(r.currentShiftId) : undefined),
    });
  }
  return entries.sort((a, b) => compareDateStr(a.effectiveDate, b.effectiveDate));
}

/** Shift shown for a day: the record's own times, else the one in force that day (history), else the current shift. */
export function shiftForDate(date: string, record: AttendanceDay | undefined, current: ShiftInfo | undefined, history: ShiftHistoryEntry[]): ShiftInfo | undefined {
  const own = recordShift(record);
  if (own) return own;
  if (history.length === 0) return current;
  const applicable = history.filter((h) => compareDateStr(h.effectiveDate, date) <= 0);
  if (applicable.length === 0) return history[0].previous ?? current;
  return applicable[applicable.length - 1];
}
