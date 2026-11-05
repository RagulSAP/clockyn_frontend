/**
 * Calendar-date helpers for the UI layer. They deal purely in `YYYY-MM-DD` strings / calendar fields and
 * never convert through UTC or `toISOString`, so a picked day can never shift across time zones.
 */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDateStr(value: string | undefined | null): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** Local-time Date at noon for a date string (noon avoids DST edge cases). */
export function dateFromStr(value: string | undefined | null): Date | null {
  const p = parseDateStr(value);
  return p ? new Date(p.year, p.month - 1, p.day, 12, 0, 0, 0) : null;
}

export function strFromDate(d: Date): string {
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday for the 1st of the month. */
export function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/** Device-local "today" as a date string (only used for visual "today" highlighting, never for business logic). */
export function localTodayStr(): string {
  return strFromDate(new Date());
}

export function formatDisplayDate(value: string | undefined | null): string {
  const p = parseDateStr(value);
  if (!p) return '';
  return `${pad2(p.day)} ${MONTH_SHORT[p.month - 1]} ${p.year}`;
}

/** `HH:mm` (24h) -> `h:mm AM/PM`. */
export function formatDisplayTime(value: string | undefined | null): string {
  const p = parseTimeStr(value);
  if (!p) return '';
  const h12 = p.hours % 12 === 0 ? 12 : p.hours % 12;
  return `${h12}:${pad2(p.minutes)} ${p.hours >= 12 ? 'PM' : 'AM'}`;
}

export function parseTimeStr(value: string | undefined | null): { hours: number; minutes: number } | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** String comparison is valid for zero-padded ISO dates. */
export function isOutOfRange(date: string, min?: string, max?: string): boolean {
  if (min && date < min) return true;
  if (max && date > max) return true;
  return false;
}
