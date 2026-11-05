/**
 * Client-side derivation of the staff calendar and the day-wise table from the monthly attendance rows
 * (late / half-day classification, Sunday-off, leave merge, absent inference, work-hours formatting).
 * All dates are IST `YYYY-MM-DD` strings (`@/lib/datetime`); nothing here reads the device clock.
 */
import { daysInMonth, formatDate, formatTime12, isSunday, makeDateStr, timeToMinutes, toDateStr } from '@/lib/datetime';
import type { AttendanceDay } from '@/types/api/attendance';

/** Calendar colour classes. `''` = blank (future day / no information). */
export type EffectiveStatus = 'present' | 'half_day' | 'absent' | 'leave' | '';

/** One day of the selected month, classified for display. */
export interface DayCell {
  date: string;
  day: number;
  record?: AttendanceDay;
  isToday: boolean;
  isFuture: boolean;
  isSunday: boolean;
  /** Sunday without an attendance row — shown as "off". */
  offSunday: boolean;
  status: EffectiveStatus;
  /** Punched in after shift start + 1 min (or server status `late`). */
  late: boolean;
  /** Worked less than half of the shift (or server status `half_day`). */
  half: boolean;
  /** Show the LATE micro label (late, not half, not Sunday, not future). */
  showLate: boolean;
  /** Show the HALF micro label (half, not Sunday, not future). */
  showHalf: boolean;
}

const LATE_GRACE_MINUTES = 1;
const DEFAULT_SHIFT_MINUTES = 540;

/** Whole minutes since midnight; seconds are ignored. `null` when missing / unparseable. */
export function toMins(t: string | undefined | null): number | null {
  if (!t) return null;
  const m = timeToMinutes(t);
  return m === null ? null : Math.floor(m);
}

/** Late when punch-in is more than 1 minute after the shift start (v1 rule). */
export function isLateArrival(punchIn: string | undefined | null, shiftStart: string | undefined | null): boolean {
  const p = toMins(punchIn);
  const s = toMins(shiftStart);
  if (p === null || s === null) return false;
  return p > s + LATE_GRACE_MINUTES;
}

/** Worked minutes from the server's `total_hours` (`"H:MM[:SS]"` or decimal hours). `null` when unusable. */
export function workedMinutesFromTotal(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw * 60 : null;
  const s = String(raw).trim();
  if (s.includes(':')) {
    const [h, m] = s.split(':');
    const hh = parseInt(h, 10);
    const mm = parseInt(m, 10);
    if (Number.isNaN(hh)) return null;
    return hh * 60 + (Number.isNaN(mm) ? 0 : mm);
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n * 60;
}

export interface HalfDayInput {
  totalHours?: unknown;
  shiftStart?: string;
  shiftEnd?: string;
  punchIn?: string;
  punchOut?: string;
}

/** Half day: worked at least 1 minute but less than half the shift (9 h when the shift is unknown). */
export function isHalfDay(input: HalfDayInput): boolean {
  let shiftMins = DEFAULT_SHIFT_MINUTES;
  const s = toMins(input.shiftStart);
  const e = toMins(input.shiftEnd);
  if (s !== null && e !== null && e - s > 0) shiftMins = e - s;

  let worked = 0;
  const fromTotal = input.totalHours ? workedMinutesFromTotal(input.totalHours) : null;
  if (fromTotal !== null) {
    worked = fromTotal;
  } else {
    const pi = toMins(input.punchIn);
    const po = toMins(input.punchOut);
    if (pi !== null && po !== null) worked = po - pi;
  }
  return worked >= 1 && worked < shiftMins / 2;
}

/** Shift times of a row (the DTO keeps unmapped fields in `raw`). */
export function shiftTimesOf(record: AttendanceDay | undefined): { start?: string; end?: string } {
  const raw = record?.raw ?? {};
  const pick = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
  return { start: pick(raw.shift_start_time), end: pick(raw.shift_end_time) };
}

/** Raw `total_hours` of a row (string or number), as received. */
export function rawTotalHours(record: AttendanceDay | undefined): unknown {
  return record?.raw?.total_hours;
}

/** Late / half flags of an attendance row (shared by the calendar and the table). */
export function classifyRecord(record: AttendanceDay | undefined): { late: boolean; half: boolean } {
  if (!record) return { late: false, half: false };
  const { start, end } = shiftTimesOf(record);
  return {
    late: record.status === 'late' || isLateArrival(record.punchIn, start),
    half:
      record.status === 'half_day' ||
      isHalfDay({ totalHours: rawTotalHours(record), shiftStart: start, shiftEnd: end, punchIn: record.punchIn, punchOut: record.punchOut }),
  };
}

/**
 * Classify one calendar day.
 * Missing row on a past non-Sunday = absent (v1 rule, no holiday / joining-date logic); an approved leave fills a day
 * without a row; a Sunday without a row is "off".
 */
export function deriveDay(date: string, record: AttendanceDay | undefined, today: string, leaveDates: ReadonlySet<string>): DayCell {
  const day = Number(date.slice(8, 10));
  const future = date > today;
  const sunday = isSunday(date);
  const row: AttendanceDay | undefined =
    record ?? (leaveDates.has(date) ? { date, status: 'leave', raw: {} } : undefined);

  const baseStatus: EffectiveStatus = row ? (row.status === 'late' ? 'present' : row.status) : !future && !sunday ? 'absent' : '';
  const { late, half } = classifyRecord(row);
  const status: EffectiveStatus = half ? 'half_day' : late ? 'present' : baseStatus;

  return {
    date,
    day,
    record: row,
    isToday: date === today,
    isFuture: future,
    isSunday: sunday,
    offSunday: sunday && !row,
    status,
    late,
    half,
    showLate: late && !half && !sunday && !future,
    showHalf: half && !sunday && !future,
  };
}

/** Every day of a month, classified. Rows are matched by IST calendar date. */
export function buildMonthDays(
  year: number,
  month: number,
  records: readonly AttendanceDay[],
  leaveDates: ReadonlySet<string>,
  today: string,
): DayCell[] {
  const byDate = new Map<string, AttendanceDay>();
  for (const r of records) {
    const key = toDateStr(r.date);
    if (key && !byDate.has(key)) byDate.set(key, r);
  }
  const total = daysInMonth(year, month);
  const out: DayCell[] = [];
  for (let d = 1; d <= total; d += 1) {
    const date = makeDateStr(year, month, d);
    out.push(deriveDay(date, byDate.get(date), today, leaveDates));
  }
  return out;
}

/** Monday-first grid: weeks of 7 cells, `null` for leading / trailing blanks. */
export function calendarWeeks(cells: readonly DayCell[]): (DayCell | null)[][] {
  if (cells.length === 0) return [];
  const first = mondayFirstOffset(cells[0].date);
  const flat: (DayCell | null)[] = [...Array<null>(first).fill(null), ...cells];
  while (flat.length % 7 !== 0) flat.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

/** Leading blank count of a Monday-first week for the first day of the month. */
function mondayFirstOffset(date: string): number {
  const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))));
  const wd = d.getUTCDay();
  return wd === 0 ? 6 : wd - 1;
}

export interface MonthSummary {
  present: number;
  late: number;
  half: number;
  absent: number;
  leave: number;
  weekOff: number;
}

/** Counts of past days by class (a late day counts as present and late). */
export function summarizeMonth(cells: readonly DayCell[]): MonthSummary {
  const s: MonthSummary = { present: 0, late: 0, half: 0, absent: 0, leave: 0, weekOff: 0 };
  for (const c of cells) {
    if (c.isFuture) continue;
    if (c.offSunday) {
      s.weekOff += 1;
      continue;
    }
    if (c.status === 'present') s.present += 1;
    else if (c.status === 'half_day') s.half += 1;
    else if (c.status === 'absent') s.absent += 1;
    else if (c.status === 'leave') s.leave += 1;
    if (c.late) s.late += 1;
  }
  return s;
}

/**
 * Work hours as v1 showed them: `H.MM` (NOT decimal): "4:30" -> `4.30`, 4.5 -> `4.30`, 8.25 -> `8.15`.
 * `-` when missing.
 */
export function formatWorkHours(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '-';
  if (typeof raw === 'string' && raw.includes(':')) {
    const [h, m] = raw.trim().split(':');
    const hh = parseInt(h, 10);
    const mm = parseInt(m, 10);
    if (Number.isNaN(hh)) return '-';
    return `${hh}.${String(Number.isNaN(mm) ? 0 : mm).padStart(2, '0')}`;
  }
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return '-';
  let whole = Math.floor(n);
  let mins = Math.round((n - whole) * 60);
  if (mins === 60) {
    whole += 1;
    mins = 0;
  }
  return `${whole}.${String(mins).padStart(2, '0')}`;
}

/** Day-wise table row. */
export interface DayRow {
  date: string;
  /** `d-M-yyyy` (no padding). */
  dateLabel: string;
  punchIn: string;
  punchOut: string;
  /** Punch-out shown is the shift end (display fallback only — never data). */
  punchOutIsShiftEnd: boolean;
  hours: string;
  late: boolean;
  half: boolean;
  offSunday: boolean;
  future: boolean;
  editable: boolean;
  /** `HH:mm` seeds for the edit sheet (empty when there is no real value). */
  seedIn: string;
  seedOut: string;
}

export function buildDayRow(cell: DayCell): DayRow {
  const rec = cell.record;
  const blocked = cell.offSunday || cell.isFuture;
  const { end } = shiftTimesOf(rec);
  const hasIn = !!rec?.punchIn;
  const shiftEndFallback = !blocked && hasIn && !rec?.punchOut && !!end;
  const punchOut = blocked
    ? '-'
    : rec?.punchOut
      ? formatTime12(rec.punchOut)
      : shiftEndFallback
        ? `${formatTime12(end)} (shift end)`
        : '-';
  return {
    date: cell.date,
    dateLabel: formatDate(cell.date, 'd-M-yyyy'),
    punchIn: blocked || !rec?.punchIn ? '-' : formatTime12(rec.punchIn),
    punchOut,
    punchOutIsShiftEnd: shiftEndFallback,
    hours: blocked ? '-' : formatWorkHours(rawTotalHours(rec)),
    late: cell.late,
    half: cell.half,
    offSunday: cell.offSunday,
    future: cell.isFuture,
    editable: !blocked,
    seedIn: rec?.punchIn ?? '',
    seedOut: rec?.punchOut ?? '',
  };
}

/** A day "has location" when its first punch-in coordinates are both non-zero. */
export function hasLocation(record: AttendanceDay | undefined): boolean {
  const loc = record?.location;
  return !!loc && loc.latitude !== 0 && loc.longitude !== 0;
}

/** Dates of the month that carry a location (for the map-pin marker of the date list). */
export function datesWithLocation(records: readonly AttendanceDay[]): Set<string> {
  const out = new Set<string>();
  for (const r of records) if (hasLocation(r)) out.add(toDateStr(r.date));
  return out;
}
