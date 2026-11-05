/**
 * Pure derivations behind the staff-detailed report: worked hours, absent days and the per-month
 * leave / permission / shift-change counters (rules of the v1 report, with the hours-parsing defect fixed).
 */
import type { AttendanceDay } from '@/types/api/attendance';
import type { StaffRequest } from '@/types/api/requests';
import { isInMonth } from './monthRange';

// ─── hours ────────────────────────────────────────────────────────────────────────────────────

/**
 * Hours worked on one day as a DECIMAL number. The backend sends `total_hours` as decimal hours (`"8.50"`);
 * a legacy `HH:MM` text (`"08:30"`) is still understood. (v1 split on ':' and dropped the fraction, so 7.75 h
 * showed up as 7 h.)
 */
export function dayHours(day: Pick<AttendanceDay, 'totalHours' | 'raw'>): number {
  if (typeof day.totalHours === 'number' && Number.isFinite(day.totalHours)) return Math.max(0, day.totalHours);
  const raw = day.raw?.total_hours;
  if (typeof raw === 'string' && raw.includes(':')) {
    const [h, m] = raw.split(':');
    const hours = Number(h);
    const minutes = Number(m);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) return Math.max(0, hours + minutes / 60);
  }
  return 0;
}

/** Total worked minutes of a month (decimal hours summed first, then rounded once). */
export function totalWorkedMinutes(days: readonly Pick<AttendanceDay, 'totalHours' | 'raw'>[]): number {
  const hours = days.reduce((sum, d) => sum + dayHours(d), 0);
  return Math.round(hours * 60);
}

/** `"{h}h {m}m"` (minutes always shown) or `"0h"` when nothing was worked — the v1 cell format. */
export function formatHoursWorked(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0h';
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

/** Days whose status is `half_day` (the backend never emits it today, so this is 0; kept for when it does). */
export function countHalfDays(days: readonly Pick<AttendanceDay, 'status'>[]): number {
  return days.filter((d) => d.status === 'half_day').length;
}

// ─── absent ───────────────────────────────────────────────────────────────────────────────────

/** Absent days = `max(0, workingDays − present − approvedLeaveDays)`. Late and half days are not subtracted. */
export function computeAbsent(workingDays: number, present: number, approvedLeaveDays: number): number {
  return Math.max(0, workingDays - present - approvedLeaveDays);
}

// ─── request counters ─────────────────────────────────────────────────────────────────────────

export type RequestBucket = 'approved' | 'rejected' | 'pending';

/** `approved` / `rejected`, everything else (missing, unknown) is `pending`. */
export function bucketOf(status: unknown): RequestBucket {
  const s = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending';
}

export interface StatusCounts {
  approved: number;
  rejected: number;
  pending: number;
}

export interface RequestCounts {
  leave: StatusCounts;
  permission: StatusCounts;
  shift: StatusCounts;
  /** Approved leave DATES in the month (subtracted from absent). */
  approvedLeaveDays: number;
}

const zero = (): StatusCounts => ({ approved: 0, rejected: 0, pending: 0 });

/**
 * Request-level status as stored on the request (the DTO's `status` is derived from the per-date decisions, which is
 * NOT what v1 counted). A missing request-level status counts as pending; the DTO status is only a fallback for
 * hand-built requests that carry no wire record at all.
 */
function requestLevelStatus(r: StaffRequest): RequestBucket {
  const raw = r.raw?.status;
  if (typeof raw === 'string' && raw.trim() !== '') return bucketOf(raw);
  return r.raw && Object.keys(r.raw).length > 0 ? 'pending' : bucketOf(r.status);
}

/** Groups requests by requesting user (requests without a user id are dropped). */
export function groupRequestsByUser(requests: readonly StaffRequest[]): Map<string, StaffRequest[]> {
  const map = new Map<string, StaffRequest[]>();
  for (const r of requests) {
    if (!r.userId) continue;
    const list = map.get(r.userId);
    if (list) list.push(r);
    else map.set(r.userId, [r]);
  }
  return map;
}

/**
 * Month counters of one staff member (v1 rules):
 *  - leave: per DATE of `dateStatuses` inside the month (approved dates also feed `approvedLeaveDays`);
 *  - permission: per REQUEST, counted when any date key is inside the month, by the request-level status;
 *  - shift change: per request whose `shiftChangeDate` is inside the month, by the request-level status.
 * Missing / unknown statuses count as pending.
 */
export function countRequests(userRequests: readonly StaffRequest[], prefix: string): RequestCounts {
  const out: RequestCounts = { leave: zero(), permission: zero(), shift: zero(), approvedLeaveDays: 0 };
  for (const r of userRequests) {
    if (r.type === 'leave') {
      for (const [date, decision] of Object.entries(r.dateStatuses)) {
        if (!isInMonth(date, prefix)) continue;
        const bucket = bucketOf(decision.status);
        out.leave[bucket] += 1;
        if (bucket === 'approved') out.approvedLeaveDays += 1;
      }
    } else if (r.type === 'permission') {
      if (Object.keys(r.dateStatuses).some((d) => isInMonth(d, prefix))) out.permission[requestLevelStatus(r)] += 1;
    } else if (r.type === 'shift_change') {
      if (isInMonth(r.shiftChangeDate, prefix)) out.shift[requestLevelStatus(r)] += 1;
    }
  }
  return out;
}
