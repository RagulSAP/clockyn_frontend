/**
 * Late report derivation. v1 rule: a day is late when the server status is `late`, OR the punch-in is more than
 * one minute after the shift start. The backend's monthly-attendance payload may not carry shift times; then only
 * `late` days qualify and the shift / "Late By" cells show "—" (v1 printed the punch-in clock time as a duration).
 */
import { formatDate, formatTime12, parseISO, parseTime, timeToMinutes, toISTParts } from '@/lib/datetime';
import type { AttendanceDay, MonthlyAttendance } from '@/types/api/attendance';
import type { StaffMember } from '@/types/api/staff';
import type { ExportColumnDef } from '../types';

export const NO_VALUE = '—';

export interface LateRow {
  key: string;
  userId: string;
  name: string;
  empId: string;
  branch: string;
  dept: string;
  photoUrl?: string;
  /** `YYYY-MM-DD` (sorting key). */
  date: string;
  /** `DD-Mon-YYYY` */
  dateLabel: string;
  shiftStart: string;
  shiftEnd: string;
  punchIn: string;
  /** Minutes late, `null` when unknown (no shift start or no punch-in). */
  lateMinutes: number | null;
  /** `—`, `{m} min`, `{h}h {m}m`. */
  lateBy: string;
}

function rawText(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim() !== '' && v.trim() !== '-') return v.trim();
  }
  return '';
}

/** Shift start / end text of a day (several wire spellings), `''` when missing. */
export function shiftTimesOf(day: Pick<AttendanceDay, 'raw'>): { start: string; end: string } {
  return {
    start: rawText(day.raw, 'shift_start_time', 'shift_start', 'shiftStartTime'),
    end: rawText(day.raw, 'shift_end_time', 'shift_end', 'shiftEndTime'),
  };
}

/** Punch-in as minutes since midnight (IST). Understands `HH:mm`, `hh:mm AM` and ISO timestamps; `null` when absent. */
export function punchInMinutes(day: Pick<AttendanceDay, 'punchIn' | 'raw'>): number | null {
  const direct = timeToMinutes(day.punchIn);
  if (direct !== null) return Math.floor(direct);
  const raw = rawText(day.raw, 'punch_in');
  if (!raw) return null;
  const parsed = timeToMinutes(raw);
  if (parsed !== null) return Math.floor(parsed);
  const inst = parseISO(raw);
  return inst ? Math.floor(toISTParts(inst).minutes) : null;
}

/** `—` for unknown/zero, `{m} min` below an hour, `{h}h {m}m` otherwise (minutes always shown, e.g. `1h 0m`). */
export function formatLateBy(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return NO_VALUE;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** v1 `fmtTime`: text that already carries AM/PM is shown as sent (`09:00AM` stays `09:00AM`); 24h times become `hh:mm AM`. */
function displayShiftTime(text: string): string {
  if (!text || !parseTime(text)) return NO_VALUE;
  return /[ap]\.?m\.?\s*$/i.test(text) ? text.trim() : formatTime12(text);
}

/** Punch-in cell: `hh:mm AM` (ISO timestamps are read in IST), `--:--` when missing. */
function punchDisplay(day: Pick<AttendanceDay, 'punchIn' | 'raw'>): string {
  const text = day.punchIn || rawText(day.raw, 'punch_in');
  return text ? formatTime12(text) : '--:--';
}

export interface LateEvaluation {
  isLate: boolean;
  lateMinutes: number | null;
  shiftStart: string;
  shiftEnd: string;
  punchIn: string;
}

/** Applies the late rule to one attendance day. */
export function evaluateLateDay(day: AttendanceDay): LateEvaluation {
  const shift = shiftTimesOf(day);
  const punch = punchInMinutes(day);
  const startMinutes = shift.start ? timeToMinutes(shift.start) : null;
  const start = startMinutes === null ? null : Math.floor(startMinutes);
  const afterShift = punch !== null && start !== null && punch > start + 1;
  const isLate = day.status === 'late' || afterShift;
  const lateMinutes = punch !== null && start !== null ? Math.max(0, punch - start) : null;
  return {
    isLate,
    lateMinutes,
    shiftStart: displayShiftTime(shift.start),
    shiftEnd: displayShiftTime(shift.end),
    punchIn: punchDisplay(day),
  };
}

/** One row per (employee, late day), sorted chronologically (real dates, not the formatted label) then by name. */
export function buildLateRows(staff: readonly StaffMember[], byUser: ReadonlyMap<string, MonthlyAttendance>): LateRow[] {
  const rows: LateRow[] = [];
  for (const s of staff) {
    const attendance = byUser.get(s.userId);
    if (!attendance) continue;
    for (const day of attendance.days) {
      const ev = evaluateLateDay(day);
      if (!ev.isLate) continue;
      rows.push({
        key: `${s.userId}|${day.date}`,
        userId: s.userId,
        name: s.name,
        empId: s.empId,
        branch: s.branch || '-',
        dept: s.department || '-',
        photoUrl: s.photoUrl,
        date: day.date,
        dateLabel: formatDate(day.date, 'dd-MMM-yyyy'),
        shiftStart: ev.shiftStart,
        shiftEnd: ev.shiftEnd,
        punchIn: ev.punchIn,
        lateMinutes: ev.lateMinutes,
        lateBy: formatLateBy(ev.lateMinutes),
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** Export columns (v1: 9). */
export const LATE_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'name', title: 'Name' },
  { key: 'empId', title: 'Emp ID' },
  { key: 'branch', title: 'Branch' },
  { key: 'dept', title: 'Dept' },
  { key: 'dateLabel', title: 'Date' },
  { key: 'shiftStart', title: 'Shift Start' },
  { key: 'shiftEnd', title: 'Shift End' },
  { key: 'punchIn', title: 'Punch In' },
  { key: 'lateBy', title: 'Late By' },
];

export function toLateExportRows(rows: readonly LateRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({ ...r }));
}
