/**
 * IST (Asia/Kolkata, UTC+05:30, no DST) business-time helpers — the single source of truth for
 * "today", month ranges, date strings sent to the API and date/time formatting.
 *
 * Design
 *  - Never depends on the device time zone: all conversions use fixed +05:30 arithmetic on UTC getters.
 *  - Calendar dates are plain `YYYY-MM-DD` strings; date arithmetic on them is pure calendar math.
 *  - Never use `new Date('YYYY-MM-DD')` (UTC parse) or `toISOString().slice(0, 10)` for business dates.
 *  - Every "now"-dependent function takes an optional `now` (Date | epoch ms) for testability.
 *
 * Glossary
 *  - `DateStr`  : 'YYYY-MM-DD'
 *  - `TimeStr`  : 'HH:mm', 'HH:mm:ss', 'hh:mm AM', 'hh:mmAM', 'h:mm:ss PM' (case-insensitive)
 */

export const IST_OFFSET_MINUTES = 330;
export const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60_000;
const MS_PER_DAY = 86_400_000;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
export const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
const pad4 = (n: number): string => String(n).padStart(4, '0');

export type DateInput = Date | number | string;

/** Broken-down IST wall-clock time. `month` is 1-12, `weekday` is 0=Sunday … 6=Saturday. */
export interface ISTParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm:ss' (24h) */
  time: string;
  /** Minutes since IST midnight (fractional seconds included). */
  minutes: number;
  /** Absolute instant as epoch ms. */
  epochMs: number;
}

// ─── calendar primitives ──────────────────────────────────────────────────────────────────────

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Number of days in `month` (1-12) of `year`. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse 'YYYY-MM-DD' into numbers; `null` when malformed or not a real calendar date (e.g. 2025-02-30). */
export function parseDateParts(str: string | null | undefined): { year: number; month: number; day: number } | null {
  if (typeof str !== 'string') return null;
  const m = DATE_RE.exec(str.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidDateStr(str: string | null | undefined): boolean {
  return parseDateParts(str) !== null;
}

/** Build 'YYYY-MM-DD' from numbers (no validation). */
export function makeDateStr(year: number, month: number, day: number): string {
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

/** Days since 1970-01-01 for a calendar date (pure calendar math, timezone free). */
function dayNumber(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function dateFromDayNumber(n: number): string {
  const d = new Date(n * MS_PER_DAY);
  return makeDateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// ─── instants <-> IST ─────────────────────────────────────────────────────────────────────────

const toEpoch = (now?: Date | number): number => (now === undefined ? Date.now() : typeof now === 'number' ? now : now.getTime());

/** Break an instant into IST wall-clock parts. */
export function toISTParts(input?: Date | number): ISTParts {
  const epochMs = toEpoch(input);
  const d = new Date(epochMs + IST_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const second = d.getUTCSeconds();
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: d.getUTCDay(),
    date: makeDateStr(year, month, day),
    time: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
    minutes: hour * 60 + minute + second / 60,
    epochMs,
  };
}

/**
 * Current IST wall-clock time (see `ISTParts`). NOTE: returns a plain parts object, not a Date —
 * use `.date` for 'today', `.minutes` for minutes since midnight, `.epochMs` for the instant.
 */
export function nowIST(now?: Date | number): ISTParts {
  return toISTParts(now);
}

/** Today's business date in IST, 'YYYY-MM-DD'. */
export function todayIST(now?: Date | number): string {
  return toISTParts(now).date;
}

/** Minutes since IST midnight right now. */
export function minutesNowIST(now?: Date | number): number {
  return toISTParts(now).minutes;
}

/** Instant at which the given IST calendar date starts (00:00 IST). `null` for an invalid date. */
export function istMidnight(dateStr: string): Date | null {
  const p = parseDateParts(dateStr);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - IST_OFFSET_MS);
}

/** Instant for an IST wall-clock date + time ('HH:mm[:ss]' or 12h). `null` if either is invalid. */
export function istInstant(dateStr: string, time = '00:00'): Date | null {
  const midnight = istMidnight(dateStr);
  const mins = timeToMinutes(time);
  if (!midnight || mins === null) return null;
  return new Date(midnight.getTime() + Math.round(mins * 60_000));
}

// ─── parsing timestamps ───────────────────────────────────────────────────────────────────────

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

export interface ParseISOOptions {
  /**
   * How to interpret a timestamp that has a time part but NO zone designator.
   * 'utc' (default) because the backend stores UTC; use 'ist' for wall-clock strings that are already IST.
   * Date-only strings are always an IST calendar date (they resolve to 00:00 IST).
   */
  assume?: 'utc' | 'ist';
}

/** Parse an ISO-8601 date / timestamp (with or without zone) into an instant. `null` when invalid. Never uses `Date.parse`. */
export function parseISO(value: string | null | undefined, opts: ParseISOOptions = {}): Date | null {
  if (typeof value !== 'string') return null;
  const m = ISO_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  const hasTime = m[4] !== undefined;
  const hour = hasTime ? Number(m[4]) : 0;
  const minute = hasTime ? Number(m[5]) : 0;
  const second = m[6] !== undefined ? Number(m[6]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const ms = m[7] !== undefined ? Number(`0.${m[7]}`) * 1000 : 0;
  let offsetMin: number;
  if (m[8] !== undefined) {
    const z = m[8].toUpperCase();
    if (z === 'Z') offsetMin = 0;
    else {
      const sign = z[0] === '-' ? -1 : 1;
      const digits = z.slice(1).replace(':', '');
      const hh = Number(digits.slice(0, 2));
      const mm = digits.length > 2 ? Number(digits.slice(2, 4)) : 0;
      offsetMin = sign * (hh * 60 + mm);
    }
  } else if (!hasTime || opts.assume === 'ist') {
    offsetMin = IST_OFFSET_MINUTES;
  } else {
    offsetMin = 0;
  }
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, Math.floor(ms)) - offsetMin * 60_000;
  return new Date(utc);
}

function toInstant(input: DateInput | null | undefined, opts?: ParseISOOptions): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') return Number.isFinite(input) ? new Date(input) : null;
  return parseISO(input, opts);
}

/**
 * Business date ('YYYY-MM-DD', IST) of a Date / epoch / string.
 *  - a plain 'YYYY-MM-DD' string is returned unchanged (after validation),
 *  - a timestamp is converted to its IST calendar date (so 2025-01-31T20:00:00Z -> '2025-02-01').
 * Returns '' for invalid input.
 */
export function toDateStr(input: DateInput | null | undefined, opts?: ParseISOOptions): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (DATE_RE.test(trimmed)) return isValidDateStr(trimmed) ? trimmed : '';
  }
  const d = toInstant(input, opts);
  return d ? toISTParts(d).date : '';
}

/**
 * Convert a *picker* Date (local-midnight Date from a native/web date picker) into 'YYYY-MM-DD'
 * using the device-local calendar fields (what the user actually picked).
 */
export function localDateToStr(d: Date): string {
  return makeDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * 'YYYY-MM-DD' -> Date at LOCAL midnight of that calendar day, for feeding date pickers.
 * `getFullYear/getMonth/getDate` of the result always equal the string's fields in any time zone.
 * Do not use it for arithmetic against instants. `null` when invalid.
 */
export function parseDateStr(str: string | null | undefined): Date | null {
  const p = parseDateParts(typeof str === 'string' ? str.trim() : str);
  return p ? new Date(p.year, p.month - 1, p.day) : null;
}

// ─── calendar arithmetic ──────────────────────────────────────────────────────────────────────

/** Add (or subtract) whole days to a 'YYYY-MM-DD'. Returns '' for invalid input. */
export function addDaysStr(dateStr: string, days: number): string {
  const p = parseDateParts(dateStr);
  if (!p || !Number.isFinite(days)) return '';
  return dateFromDayNumber(dayNumber(p.year, p.month, p.day) + Math.trunc(days));
}

/** Add months, clamping the day to the target month's length (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsStr(dateStr: string, months: number): string {
  const p = parseDateParts(dateStr);
  if (!p || !Number.isFinite(months)) return '';
  const total = p.year * 12 + (p.month - 1) + Math.trunc(months);
  const year = Math.floor(total / 12);
  const month = (total % 12 + 12) % 12 + 1;
  return makeDateStr(year, month, Math.min(p.day, daysInMonth(year, month)));
}

/** Whole calendar days from `a` to `b` (b - a; negative when b is earlier). `NaN` for invalid input. */
export function daysBetween(a: string, b: string): number {
  const pa = parseDateParts(a);
  const pb = parseDateParts(b);
  if (!pa || !pb) return NaN;
  return dayNumber(pb.year, pb.month, pb.day) - dayNumber(pa.year, pa.month, pa.day);
}

/** Inclusive number of days in [a, b] (same day = 1). Used for leave day counts. */
export function daysInclusive(a: string, b: string): number {
  const d = daysBetween(a, b);
  return Number.isNaN(d) ? NaN : d + 1;
}

/** First and last day of a month. `month` is 1-12. Handles month ends and leap years. */
export function monthRange(year: number, month: number): { start: string; end: string; days: number } {
  const days = daysInMonth(year, month);
  return { start: makeDateStr(year, month, 1), end: makeDateStr(year, month, days), days };
}

/** `{ year, month }` of the current IST month. */
export function currentMonthIST(now?: Date | number): { year: number; month: number } {
  const p = toISTParts(now);
  return { year: p.year, month: p.month };
}

/** 'YYYY-MM' (report endpoints use this path segment). */
export function monthKey(year: number, month: number): string {
  return `${pad4(year)}-${pad2(month)}`;
}

/** Every date in [start, end] inclusive (empty when invalid or reversed). Capped at 3660 entries. */
export function datesInRange(start: string, end: string): string[] {
  const n = daysInclusive(start, end);
  if (Number.isNaN(n) || n < 1) return [];
  const out: string[] = [];
  for (let i = 0; i < Math.min(n, 3660); i += 1) out.push(addDaysStr(start, i));
  return out;
}

/** Day of week, 0 = Sunday … 6 = Saturday; -1 when invalid. */
export function weekdayOf(dateStr: string): number {
  const p = parseDateParts(dateStr);
  if (!p) return -1;
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

export function isSunday(dateStr: string): boolean {
  return weekdayOf(dateStr) === 0;
}

/** Python weekday used by the backend for weekly off days: Monday = 0 … Sunday = 6; -1 when invalid. */
export function pythonWeekday(dateStr: string): number {
  const w = weekdayOf(dateStr);
  return w < 0 ? -1 : (w + 6) % 7;
}

/** Compare two date strings: negative / 0 / positive (lexicographic order == chronological for valid dates). */
export function compareDateStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

// ─── formatting ───────────────────────────────────────────────────────────────────────────────

export const DATE_FORMATS = {
  /** 05 Jan 2025 */
  default: 'dd MMM yyyy',
  /** 05/01/2025 */
  numeric: 'dd/MM/yyyy',
  /** Sun, 05 Jan 2025 */
  withWeekday: 'EEE, dd MMM yyyy',
  /** January 2025 */
  monthYear: 'MMMM yyyy',
  /** 05 Jan */
  dayMonth: 'dd MMM',
  /** Jan 5, 2025 */
  long: 'MMM d, yyyy',
  /** 2025-01-05 */
  iso: 'yyyy-MM-dd',
} as const;

/** Tokens: yyyy yy MMMM MMM MM M dd d EEEE EEE. Text in single quotes is literal ('at'). */
function applyDateFormat(parts: { year: number; month: number; day: number; weekday: number }, fmt: string): string {
  return fmt.replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE/g, (tok: string, literal?: string) => {
    if (literal !== undefined) return literal;
    switch (tok) {
      case 'yyyy': return pad4(parts.year);
      case 'yy': return pad2(parts.year % 100);
      case 'MMMM': return MONTH_NAMES[parts.month - 1];
      case 'MMM': return MONTH_NAMES_SHORT[parts.month - 1];
      case 'MM': return pad2(parts.month);
      case 'M': return String(parts.month);
      case 'dd': return pad2(parts.day);
      case 'd': return String(parts.day);
      case 'EEEE': return WEEKDAY_NAMES[parts.weekday];
      case 'EEE': return WEEKDAY_NAMES_SHORT[parts.weekday];
      default: return tok;
    }
  });
}

/**
 * Format a calendar date / timestamp (IST) — default '05 Jan 2025'. Accepts 'YYYY-MM-DD', ISO timestamps, Date, epoch.
 * Returns '--' for empty / invalid input. A plain 'YYYY-MM-DD' shows the same day in every device time zone.
 */
export function formatDate(input: DateInput | null | undefined, fmt: string = DATE_FORMATS.default): string {
  const ds = toDateStr(input);
  const p = parseDateParts(ds);
  if (!p) return '--';
  return applyDateFormat({ ...p, weekday: weekdayOf(ds) }, fmt);
}

/** 'January 2025' for a (year, month 1-12) pair. */
export function formatMonthYear(year: number, month: number): string {
  return month >= 1 && month <= 12 ? `${MONTH_NAMES[month - 1]} ${year}` : '--';
}

export interface ParsedTime {
  /** 0-23 */
  hour: number;
  minute: number;
  second: number;
}

const TIME_RE = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2})(?:\.\d+)?)?\s*([AP]\.?M\.?)?$/i;

/** Parse 'HH:mm', 'HH:mm:ss', 'h:mm AM', 'hh:mmAM', '9 PM' … into 24h parts. `null` when invalid. */
export function parseTime(value: string | null | undefined): ParsedTime | null {
  if (typeof value !== 'string') return null;
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] !== undefined ? Number(m[2]) : 0;
  const second = m[3] !== undefined ? Number(m[3]) : 0;
  const mer = m[4]?.replace(/\./g, '').toUpperCase();
  if (minute > 59 || second > 59) return null;
  if (mer) {
    if (hour < 1 || hour > 12) return null;
    if (mer === 'PM' && hour !== 12) hour += 12;
    if (mer === 'AM' && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute, second };
}

/** Minutes since midnight of a time string (seconds as a fraction). `null` when invalid. */
export function timeToMinutes(value: string | null | undefined): number | null {
  const t = parseTime(value);
  return t ? t.hour * 60 + t.minute + t.second / 60 : null;
}

/** Minutes since midnight -> 'HH:mm' (24h). Wraps around 24h. */
export function minutesToTime24(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) return '--:--';
  const m = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function to12h(hour: number): { h12: number; mer: 'AM' | 'PM' } {
  return { h12: hour % 12 === 0 ? 12 : hour % 12, mer: hour >= 12 ? 'PM' : 'AM' };
}

/** Minutes since midnight -> 'hh:mm AM'. */
export function minutesToTime12(totalMinutes: number, opts: { pad?: boolean; space?: boolean } = {}): string {
  if (!Number.isFinite(totalMinutes)) return '--:--';
  const m = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const { h12, mer } = to12h(Math.floor(m / 60));
  const hh = opts.pad === false ? String(h12) : pad2(h12);
  return `${hh}:${pad2(m % 60)}${opts.space === false ? '' : ' '}${mer}`;
}

export interface FormatTimeOptions {
  /** Include seconds ('09:15:30 AM'). Default false. */
  seconds?: boolean;
  /** Zero-pad the hour ('09:05 AM'). Default true. */
  pad?: boolean;
  /** Space before AM/PM. Default true ('09:05 AM'); false gives the shift style '09:05AM'. */
  space?: boolean;
}

/**
 * Display a time-of-day as 12-hour 'hh:mm AM'. Accepts 'HH:mm[:ss]', 'hh:mmAM', 'h:mm AM', and ISO timestamps
 * (timestamps are converted to IST). Empty -> '--:--'; unparseable text is returned trimmed.
 */
export function formatTime12(value: string | Date | number | null | undefined, opts: FormatTimeOptions = {}): string {
  if (value === null || value === undefined || value === '') return '--:--';
  let t: ParsedTime | null;
  if (typeof value === 'string') {
    t = parseTime(value);
    if (!t) {
      const inst = parseISO(value);
      if (!inst) return value.trim();
      const p = toISTParts(inst);
      t = { hour: p.hour, minute: p.minute, second: p.second };
    }
  } else {
    const inst = toInstant(value);
    if (!inst) return '--:--';
    const p = toISTParts(inst);
    t = { hour: p.hour, minute: p.minute, second: p.second };
  }
  const { h12, mer } = to12h(t.hour);
  const hh = opts.pad === false ? String(h12) : pad2(h12);
  const ss = opts.seconds ? `:${pad2(t.second)}` : '';
  return `${hh}:${pad2(t.minute)}${ss}${opts.space === false ? '' : ' '}${mer}`;
}

/**
 * Normalise any accepted time string to 'HH:mm' (24h), the format the API expects for permission / edit times.
 * `null` when invalid.
 */
export function toTime24(value: string | null | undefined): string | null {
  const t = parseTime(value);
  return t ? `${pad2(t.hour)}:${pad2(t.minute)}` : null;
}

/** Shift style '09:30AM' (no space) as used by the shift endpoints. `null` when invalid. */
export function toShiftTime(value: string | null | undefined): string | null {
  const t = parseTime(value);
  if (!t) return null;
  const { h12, mer } = to12h(t.hour);
  return `${pad2(h12)}:${pad2(t.minute)}${mer}`;
}

/**
 * Length of a shift in minutes, applying the overnight rule (end <= start => end is next day;
 * 22:00-06:00 = 480; 18:00-00:00 = 360; 09:00-09:00 = 1440; 00:00-00:00 = 0). Returns `null` for invalid input.
 * (v1 did not wrap an end of exactly 00:00, producing a negative span — fixed here.)
 */
export function shiftSpanMinutes(start: string, end: string): number | null {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return null;
  if (s === 0 && e === 0) return 0;
  return e <= s ? e + 1440 - s : e - s;
}

/** Date + time in IST: default '05 Jan 2025, 09:15 AM'. Accepts timestamps / Date / epoch. '--' when invalid. */
export function formatDateTime(
  input: DateInput | null | undefined,
  fmt: string = DATE_FORMATS.default,
  opts: FormatTimeOptions & { assume?: 'utc' | 'ist' } = {},
): string {
  const d = toInstant(input, opts);
  if (!d) return '--';
  const p = toISTParts(d);
  const datePart = applyDateFormat({ year: p.year, month: p.month, day: p.day, weekday: p.weekday }, fmt);
  return `${datePart}, ${formatTime12(d, opts)}`;
}

/**
 * Chat / announcement style relative time (IST): 'Just now' (<1 min), '5m ago', 'hh:mm AM' for <24h
 * (or '3h ago' with `hoursAgo`), 'Yesterday' (<48h), else 'Jan 5'. Future timestamps read 'Just now'.
 */
export function formatRelativeTime(
  input: DateInput | null | undefined,
  opts: { now?: Date | number; hoursAgo?: boolean; assume?: 'utc' | 'ist' } = {},
): string {
  const d = toInstant(input, opts);
  if (!d) return '';
  const nowMs = toEpoch(opts.now);
  const diffMin = Math.floor((nowMs - d.getTime()) / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return opts.hoursAgo ? `${diffH}h ago` : formatTime12(d);
  if (diffH < 48) return 'Yesterday';
  const p = toISTParts(d);
  return `${MONTH_NAMES_SHORT[p.month - 1]} ${p.day}`;
}

/** Greeting for the IST hour: <12 Morning, <17 Afternoon, <21 Evening, else Night (plain text, no emoji). */
export function greeting(now?: Date | number): string {
  const h = toISTParts(now).hour;
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
}

/** Whole days from today (IST) until `dateStr` (negative if past). NaN when invalid. */
export function daysUntil(dateStr: string, now?: Date | number): number {
  return daysBetween(todayIST(now), toDateStr(dateStr));
}
