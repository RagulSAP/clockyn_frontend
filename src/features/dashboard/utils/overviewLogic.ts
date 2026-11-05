/**
 * Pure logic of the Overview screen (status buckets, punch-time column, hours formatting, sessions).
 */
import { formatTime12 } from '@/lib/datetime';
import type { PunchSession } from '@/types/api/attendance';
import type { DashboardStats, StaffStatusFilter } from '@/types/api/home';
import type { DailyAttendanceRow, StaffMember } from '@/types/api/staff';
import type { StaffFilter } from './dashboardLogic';

export type OverviewFilter = StaffFilter;

/** Tile order, labels (verbatim) and the stat each tile counts. */
export const OVERVIEW_TILES: { key: OverviewFilter; label: string; read: (s: DashboardStats) => number }[] = [
  { key: 'total', label: 'Total', read: (s) => s.totalStaff },
  { key: 'absent', label: 'Absent', read: (s) => s.absent },
  { key: 'late', label: 'Late', read: (s) => s.latePunchedIn },
  { key: 'punched_in', label: 'Punched In', read: (s) => s.punchedIn },
  { key: 'working', label: 'Working', read: (s) => s.working },
  { key: 'punched_out', label: 'Punched Out', read: (s) => s.punchedOut },
];

export function tileLabel(filter: OverviewFilter): string {
  return OVERVIEW_TILES.find((t) => t.key === filter)?.label ?? 'Total';
}

/** API status bucket of a filter; `null` for `total` (served by the daily attendance report). */
export function statusBucketOf(filter: OverviewFilter): StaffStatusFilter | null {
  switch (filter) {
    case 'absent':
      return 'absent';
    case 'late':
      return 'late_punched_in';
    case 'punched_in':
      return 'punched_in';
    case 'working':
      return 'working';
    case 'punched_out':
      return 'punched_out';
    default:
      return null;
  }
}

const FILTERS: readonly string[] = ['total', 'absent', 'late', 'punched_in', 'working', 'punched_out'];

/** Route param -> filter (unknown / missing values mean `total`). */
export function parseOverviewFilter(value: string | string[] | undefined): OverviewFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v && FILTERS.includes(v) ? (v as OverviewFilter) : 'total';
}

/** A-Z by name (locale aware, case-insensitive); returns a new array. */
export function sortByName<T extends { name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
}

/** Drops duplicate user ids (first wins). */
export function dedupeByUserId<T extends { userId: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    out.push(r);
  }
  return out;
}

export type PunchMaps = {
  /** user id -> `HH:mm` shown in the time column. */
  punchMap: Record<string, string>;
  /** user id -> total hours (decimal). */
  hoursMap: Record<string, number>;
};

/**
 * Punch-time column source (spec overview §7.2): for the Punched In filter the punch-in time wins, for Punched Out
 * the punch-out time, otherwise the punch-in time and finally the punch-out time.
 */
export function buildPunchMaps(rows: readonly DailyAttendanceRow[], filter: OverviewFilter): PunchMaps {
  const punchMap: Record<string, string> = {};
  const hoursMap: Record<string, number> = {};
  for (const a of rows) {
    const pi = a.punchIn;
    const po = a.punchOut;
    if (filter === 'punched_in' && pi) punchMap[a.userId] = pi;
    else if (filter === 'punched_out' && po) punchMap[a.userId] = po;
    else if (pi) punchMap[a.userId] = pi;
    else if (po) punchMap[a.userId] = po;
    if (a.totalHours) hoursMap[a.userId] = a.totalHours;
  }
  return { punchMap, hoursMap };
}

export type PunchColumn = {
  /** `hh:mm AM` text or `--:--`; `null` = show nothing. */
  time: string | null;
  /** Small caption above the time (`Punch In` on the Punched In filter). */
  label: string | null;
  tone: 'success' | 'warning' | 'danger';
  /** `{n} hrs` second line (Punched Out filter). */
  hours: string | null;
};

/** What the right-hand column of a list row shows (spec overview §7.2). */
export function punchColumn(filter: OverviewFilter, userId: string, maps: PunchMaps): PunchColumn {
  const value = maps.punchMap[userId];
  const tone: PunchColumn['tone'] = filter === 'punched_out' ? 'danger' : filter === 'punched_in' ? 'warning' : 'success';
  const hours = filter === 'punched_out' && maps.hoursMap[userId] ? `${trimNumber(maps.hoursMap[userId])} hrs` : null;
  if (value) return { time: formatPunchTime(value), label: filter === 'punched_in' ? 'Punch In' : null, tone, hours };
  if (filter === 'punched_in') return { time: '--:--', label: null, tone, hours };
  return { time: null, label: null, tone, hours };
}

/** `HH:mm` -> `hh:mm AM`; empty -> `--:--`. */
export function formatPunchTime(value: string | null | undefined): string {
  return value ? formatTime12(value) : '--:--';
}

/** Up to 2 decimals without trailing zeros (`8.5`, `7.25`, `8`). */
export function trimNumber(n: number): string {
  return String(Number(n.toFixed(2)));
}

/**
 * Decimal hours -> `HH:MM` (floor hours, rounded minutes; a rounded 60 carries into the hour — v1 could print
 * `07:60`). Non-finite input gives `--:--`.
 */
export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return '--:--';
  let h = Math.floor(value);
  let m = Math.round((value - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type DaySession = {
  punchIn?: string;
  punchOut?: string;
  punchInPhoto?: string;
  punchOutPhoto?: string;
};

/**
 * Sessions to render for the day: the server sessions when there are any, else one synthetic session from the
 * monthly record (nulls when nothing is known).
 */
export function resolveDaySessions(
  sessions: readonly PunchSession[] | undefined,
  day: { punchIn?: string; punchOut?: string; punchInPhoto?: string; punchOutPhoto?: string } | null | undefined,
): DaySession[] {
  if (sessions && sessions.length > 0) {
    return sessions.map((s) => ({ punchIn: s.punchIn, punchOut: s.punchOut, punchInPhoto: s.punchInPhoto, punchOutPhoto: s.punchOutPhoto }));
  }
  return [{ punchIn: day?.punchIn, punchOut: day?.punchOut, punchInPhoto: day?.punchInPhoto, punchOutPhoto: day?.punchOutPhoto }];
}

/** Status pill tone of the staff hero (live status label from the server). */
export function statusTone(status: StaffMember['status'] | string, label = ''): 'success' | 'danger' | 'warning' | 'primary' | 'neutral' {
  const s = (status || label).toString().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (s === 'working') return 'success';
  if (s === 'absent') return 'danger';
  if (s === 'punched in') return 'warning';
  if (s === 'punched out') return 'primary';
  return 'neutral';
}
