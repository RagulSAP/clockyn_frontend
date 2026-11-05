/**
 * Staff-location rules (pure, unit tested): freshness (15 minutes), counters, status text, branch filter,
 * "today" in IST and the map viewport maths.
 */
import { formatTime12, parseISO, todayIST } from '@/lib/datetime';
import type { StaffLocation } from '@/types/api/location';

/** A position is "fresh" when it was updated at most this many minutes ago. */
export const FRESH_MINUTES = 15;
export const ALL_BRANCHES = 'ALL';

export type Freshness = 'fresh' | 'stale' | 'none';

/** Minutes since the last position update; `null` when there is none (or it cannot be parsed). */
export function minutesSinceUpdate(updatedAt: string | undefined, now: number = Date.now()): number | null {
  if (!updatedAt) return null;
  const at = parseISO(updatedAt);
  return at ? (now - at.getTime()) / 60_000 : null;
}

/** fresh: updated within 15 min (a timestamp slightly in the future counts as fresh); stale: older; none: never. */
export function freshnessOf(staff: Pick<StaffLocation, 'updatedAt'>, now: number = Date.now()): Freshness {
  const minutes = minutesSinceUpdate(staff.updatedAt, now);
  if (minutes === null) return 'none';
  return minutes <= FRESH_MINUTES ? 'fresh' : 'stale';
}

export const hasCoordinates = (s: StaffLocation): s is StaffLocation & { latitude: number; longitude: number } =>
  s.latitude !== undefined && s.longitude !== undefined && Number.isFinite(s.latitude) && Number.isFinite(s.longitude);

/** Staff with a position (map markers, counters and the stat lists use these). */
export function withCoordinates(list: readonly StaffLocation[]): StaffLocation[] {
  return list.filter(hasCoordinates);
}

export const matchesBranch = (s: Pick<StaffLocation, 'branch'>, branch: string): boolean => branch === ALL_BRANCHES || s.branch === branch;

/** Keeps staff of the selected branch (`ALL` keeps everyone). Applies to markers, counters and lists. */
export function filterByBranch(list: readonly StaffLocation[], branch: string): StaffLocation[] {
  return branch === ALL_BRANCHES ? [...list] : list.filter((s) => matchesBranch(s, branch));
}

/** Completed / Working / Not Started. */
export function staffStatus(s: Pick<StaffLocation, 'punchIn' | 'punchOut'>): 'Completed' | 'Working' | 'Not Started' {
  if (s.punchIn && s.punchOut) return 'Completed';
  if (s.punchIn) return 'Working';
  return 'Not Started';
}

export interface LocationStats {
  /** Punched in, updated within 15 min. */
  recent: StaffLocation[];
  /** Punched in, updated before 15 min or never. */
  outdated: StaffLocation[];
}

/** The two counters (and their drill-down lists): only punched-in staff that have coordinates are counted. */
export function computeStats(list: readonly StaffLocation[], now: number = Date.now()): LocationStats {
  const recent: StaffLocation[] = [];
  const outdated: StaffLocation[] = [];
  for (const s of withCoordinates(list)) {
    if (!s.punchIn) continue;
    (freshnessOf(s, now) === 'fresh' ? recent : outdated).push(s);
  }
  return { recent, outdated };
}

/** `hh:mm AM` (IST) of the last update, or `''`. */
export function lastUpdatedLabel(updatedAt: string | undefined): string {
  const at = parseISO(updatedAt);
  return at ? formatTime12(at) : '';
}

/** Live refresh runs only for today's IST date. */
export const isTodayIST = (date: string, now?: number): boolean => date === todayIST(now);

// ── map viewport ──────────────────────────────────────────────────────────────────────────────

export type Viewport = { latitude: number; longitude: number; zoom: number };

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Centre + web-mercator zoom that fits all points in a `widthPx` x `heightPx` map (single point: street level). */
export function fitViewport(points: readonly { latitude: number; longitude: number }[], widthPx: number, heightPx: number): Viewport | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  const center = { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 };
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  if (points.length === 1 || (lngSpan <= 1e-5 && latSpan <= 1e-5)) return { ...center, zoom: 15 };
  // padding factor 1.4 keeps pins away from the edge
  const zoomLng = Math.log2((360 * (Math.max(widthPx, 200) / 256)) / (lngSpan * 1.4));
  const zoomLat = Math.log2((170 * (Math.max(heightPx, 200) / 256)) / (latSpan * 1.4));
  return { ...center, zoom: clamp(Math.floor(Math.min(zoomLng, zoomLat)), 3, 17) };
}
