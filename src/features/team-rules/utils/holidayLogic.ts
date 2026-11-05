/**
 * Pure holiday-calendar logic. All dates are plain IST calendar strings (`YYYY-MM-DD`) handled through
 * `@/lib/datetime` - never `new Date('YYYY-MM-DD')` (UTC parse -> wrong day in zones behind UTC).
 */
import { MONTH_NAMES, compareDateStr, daysInMonth, formatDate, makeDateStr, parseDateParts, pythonWeekday } from '@/lib/datetime';
import type { Holiday } from '@/types/api/system';

/** Backend weekday numbering: Monday = 0 ... Sunday = 6. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const ALL_BRANCHES_LABEL = 'All Branches';
export const ALL_DEPARTMENTS_LABEL = 'All Departments';

/** Years offered by the month picker: current year - 1 ... + 4 (6 values). */
export function holidayYearRange(currentYear: number): [number, number] {
  return [currentYear - 1, currentYear + 4];
}

export function sortDates(dates: readonly string[]): string[] {
  return [...dates].sort(compareDateStr);
}

export function toggleDate(dates: readonly string[], date: string): string[] {
  return dates.includes(date) ? dates.filter((d) => d !== date) : sortDates([...dates, date]);
}

export function isWeeklyOffDate(date: string, offDays: readonly number[]): boolean {
  const w = pythonWeekday(date);
  return w >= 0 && offDays.includes(w);
}

/** Every date of the month (1-12) that falls on a weekly off day. */
export function offDayDates(year: number, month: number, offDays: readonly number[]): string[] {
  if (offDays.length === 0) return [];
  const out: string[] = [];
  const total = daysInMonth(year, month);
  for (let d = 1; d <= total; d += 1) {
    const date = makeDateStr(year, month, d);
    if (isWeeklyOffDate(date, offDays)) out.push(date);
  }
  return out;
}

/** Day-of-month label for a date, or '' when invalid. */
export function dayOfMonth(date: string): number {
  return parseDateParts(date)?.day ?? 0;
}

/** True when `date` belongs to the visible (year, month). */
export function inMonth(date: string, year: number, month: number): boolean {
  const p = parseDateParts(date);
  return !!p && p.year === year && p.month === month;
}

/**
 * List/calendar filter. Organisation-wide holidays (no branch / no department) are always shown; a scoped holiday is
 * shown when its scope equals the chosen filter ('' = no filter).
 */
export function filterHolidays(holidays: readonly Holiday[], filterBranch: string, filterDept: string): Holiday[] {
  return holidays.filter(
    (h) =>
      (!filterBranch || !h.branchName || h.branchName === filterBranch) && (!filterDept || !h.deptName || h.deptName === filterDept),
  );
}

export type HolidayGroup = {
  key: string;
  name: string;
  branchName: string | null;
  deptName: string | null;
  blockAttendance: boolean;
  /** Entries of the group sorted by date ascending. */
  entries: Holiday[];
  firstDate: string;
};

export function holidayGroupKey(h: Pick<Holiday, 'name' | 'branchName' | 'deptName' | 'blockAttendance'>): string {
  return `${h.name}|${h.branchName ?? ''}|${h.deptName ?? ''}|${h.blockAttendance ? 1 : 0}`;
}

/**
 * Groups the month's per-date records into "holidays". v1 grouped by name only, merging records with different
 * branch / department scope or punch policy and showing just the first record's scope; here the scope and policy are
 * part of the group key. Groups are ordered by their earliest date (v1 used the first record in API order).
 */
export function groupHolidays(holidays: readonly Holiday[]): HolidayGroup[] {
  const map = new Map<string, HolidayGroup>();
  for (const h of holidays) {
    const key = holidayGroupKey(h);
    let g = map.get(key);
    if (!g) {
      g = { key, name: h.name, branchName: h.branchName, deptName: h.deptName, blockAttendance: h.blockAttendance, entries: [], firstDate: h.date };
      map.set(key, g);
    }
    g.entries.push(h);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.entries.sort((a, b) => compareDateStr(a.date, b.date));
    g.firstDate = g.entries[0]?.date ?? '';
  }
  return groups.sort((a, b) => compareDateStr(a.firstDate, b.firstDate) || a.name.localeCompare(b.name));
}

/** Distinct holiday dates of the (filtered) month. */
export function holidayDateSet(holidays: readonly Holiday[]): Set<string> {
  return new Set(holidays.map((h) => h.date).filter(Boolean));
}

export type EditDiff = { toUpdate: Holiday[]; toDelete: Holiday[]; toAdd: string[] };

/**
 * Edit-as-diff (v1 behaviour): records whose date stays are renamed / re-flagged, records whose date was removed are
 * deleted and newly picked dates are created with the group's scope.
 */
export function computeEditDiff(entries: readonly Holiday[], newDates: readonly string[]): EditDiff {
  const keep = new Set(newDates);
  const existing = new Set(entries.map((e) => e.date));
  return {
    toUpdate: entries.filter((e) => keep.has(e.date)),
    toDelete: entries.filter((e) => !keep.has(e.date)),
    toAdd: sortDates([...keep].filter((d) => !existing.has(d))),
  };
}

export type HolidayScope = { name: string; branchName: string | null; deptName: string | null };

const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase();

/**
 * Splits picked dates into new ones and ones that already carry a holiday with the same name and scope
 * (duplicate-date protection - v1 had none).
 */
export function splitDuplicateDates(dates: readonly string[], existing: readonly Holiday[], scope: HolidayScope): { fresh: string[]; duplicates: string[] } {
  const taken = new Set(
    existing
      .filter((h) => norm(h.name) === norm(scope.name) && norm(h.branchName) === norm(scope.branchName) && norm(h.deptName) === norm(scope.deptName))
      .map((h) => h.date),
  );
  const fresh: string[] = [];
  const duplicates: string[] = [];
  for (const d of dates) (taken.has(d) ? duplicates : fresh).push(d);
  return { fresh, duplicates };
}

/** `Off: Sat, Sun` / `No off days — all days are working days` (em dash, v1 copy). */
export function offDaysSummary(offDays: readonly number[]): string {
  const sorted = [...new Set(offDays)].sort((a, b) => a - b);
  if (sorted.length === 0) return 'No off days — all days are working days';
  return `Off: ${sorted.map((d) => WEEKDAY_LABELS[d]).join(', ')}`;
}

/** Subtitle of the "Configure Off Days" row. */
export function offDaysSubtitle(offDays: readonly number[]): string {
  const sorted = [...new Set(offDays)].sort((a, b) => a - b);
  return sorted.length === 0 ? 'No off days set' : sorted.map((d) => WEEKDAY_LABELS[d]).join(', ');
}

export function toggleOffDay(offDays: readonly number[], day: number): number[] {
  return offDays.includes(day) ? offDays.filter((d) => d !== day) : [...offDays, day].sort((a, b) => a - b);
}

export function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? ''} ${year}`;
}

/** `05 Jan 2025` (IST calendar date, identical in every device time zone). */
export function holidayDateLabel(date: string): string {
  return formatDate(date);
}

/** `DD Month YYYY` used by the selected-dates badges. */
export function selectedDateLabel(date: string): string {
  return formatDate(date, 'dd MMMM yyyy');
}

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
