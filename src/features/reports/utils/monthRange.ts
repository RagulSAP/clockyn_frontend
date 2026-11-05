/**
 * Month helpers for the reports. Everything is calendar math on `YYYY-MM-DD` strings (IST business time) via
 * `@/lib/datetime` — no device-timezone dependence (v1 counted Sundays with `new Date(...).getDay()`).
 */
import { currentMonthIST, daysInMonth, isSunday, makeDateStr, MONTH_NAMES, MONTH_NAMES_SHORT, monthKey } from '@/lib/datetime';

export interface ReportMonth {
  year: number;
  /** 1-12 */
  month: number;
  /** `YYYY-MM` — dates and shift-change dates are matched with `startsWith(prefix + '-')`. */
  prefix: string;
  days: number;
  /** Calendar Sundays in the month. */
  sundays: number;
  start: string;
  end: string;
  /** `October 2026` */
  label: string;
  /** `Oct` */
  shortName: string;
  /** `October` */
  fullName: string;
}

export function reportMonth(year: number, month: number): ReportMonth {
  const days = daysInMonth(year, month);
  let sundays = 0;
  for (let d = 1; d <= days; d += 1) if (isSunday(makeDateStr(year, month, d))) sundays += 1;
  const fullName = MONTH_NAMES[month - 1] ?? '';
  return {
    year,
    month,
    prefix: monthKey(year, month),
    days,
    sundays,
    start: makeDateStr(year, month, 1),
    end: makeDateStr(year, month, days),
    label: `${fullName} ${year}`,
    shortName: MONTH_NAMES_SHORT[month - 1] ?? '',
    fullName,
  };
}

/** True when `date` (`YYYY-MM-DD`) falls inside the month identified by `prefix` (`YYYY-MM`). */
export function isInMonth(date: string | null | undefined, prefix: string): boolean {
  return typeof date === 'string' && date.startsWith(`${prefix}-`);
}

/** Calendar-only working days (v1 fallback when the working-days endpoint fails): days in month minus Sundays. */
export function calendarWorkingDays(month: ReportMonth): number {
  return month.days - month.sundays;
}

export type YearRangeKind = 'reports' | 'attendancePdf';

/**
 * Selectable years, computed at call time (v1 froze them at module load):
 * reports and salary screens `current-2 … current+3`; the attendance PDF screen `current-5 … current+4`.
 */
export function yearRangeFor(kind: YearRangeKind, now?: Date | number): [number, number] {
  const { year } = currentMonthIST(now);
  return kind === 'attendancePdf' ? [year - 5, year + 4] : [year - 2, year + 3];
}
