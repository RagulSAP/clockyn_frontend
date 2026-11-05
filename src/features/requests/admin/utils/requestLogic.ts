/**
 * Pure rules of the admin request screens (leave / permission / shift change / device change):
 * status derivations, list ordering, per-date grouping, copy for the confirmation dialogs and the optimistic
 * cache patch applied after a decision. No React, no I/O: everything here is unit tested.
 */
import { hasPending } from '@/api/mappers/requests';
import { MONTH_NAMES_SHORT, formatDate, formatTime12, parseDateParts, parseISO } from '@/lib/datetime';
import type { DateDecision, RequestStatus, RequestType, StaffRequest } from '@/types/api/requests';

export const REQUEST_TYPES: readonly RequestType[] = ['leave', 'permission', 'shift_change', 'device_change'];

export const EMPTY_VALUE = '—';

export function requestsOfType(requests: readonly StaffRequest[], type: RequestType): StaffRequest[] {
  return requests.filter((r) => r.type === type);
}

/** Status of one date of a request: the per-date decision, else the request status, else pending. */
export function dateStatus(request: StaffRequest, date: string): RequestStatus {
  return request.dateStatuses[date]?.status ?? request.status ?? 'pending';
}

/**
 * Overall status shown on a leave card: no dates -> the request status; all approved -> approved; all rejected ->
 * rejected; any pending -> pending; otherwise (mixed approved / rejected) the status of the first date.
 */
export function overallStatus(request: StaffRequest): RequestStatus {
  if (request.dates.length === 0) return request.status ?? 'pending';
  const statuses = request.dates.map((d) => dateStatus(request, d));
  if (statuses.every((s) => s === 'approved')) return 'approved';
  if (statuses.every((s) => s === 'rejected')) return 'rejected';
  if (statuses.some((s) => s === 'pending')) return 'pending';
  return statuses[0];
}

/** Header "N Pending": requests (not dates) that still need a decision. An empty `dateStatuses` falls back to the status. */
export function pendingRequestCount(requests: readonly StaffRequest[]): number {
  return requests.filter(hasPending).length;
}

/** Newest submission first; requests without a (valid) `createdAt` go last. Stable for equal timestamps. */
export function sortNewestFirst<T extends StaffRequest>(requests: readonly T[]): T[] {
  const stamp = (r: T): number => parseISO(r.createdAt)?.getTime() ?? 0;
  return requests
    .map((r, i) => ({ r, i, t: stamp(r) }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map((x) => x.r);
}

/** `05 Jan 2025` of an ISO timestamp / date, or the em dash. */
export function displayDate(value: string | undefined | null): string {
  const out = formatDate(value);
  return out === '--' ? EMPTY_VALUE : out;
}

/**
 * Requested leave dates on one line, grouped by month: `03, 04, 07 Jan 2025 • 01 Feb 2025`.
 * Empty -> em dash; when none of the dates parse the raw values are joined.
 */
export function formatDatesLine(dates: readonly string[]): string {
  if (dates.length === 0) return EMPTY_VALUE;
  const valid = dates
    .map((raw) => ({ raw, p: parseDateParts(raw) }))
    .filter((x): x is { raw: string; p: { year: number; month: number; day: number } } => x.p !== null)
    .sort((a, b) => (a.raw < b.raw ? -1 : a.raw > b.raw ? 1 : 0));
  if (valid.length === 0) return dates.join(', ');
  const groups: { label: string; days: string[] }[] = [];
  for (const { p } of valid) {
    const label = `${MONTH_NAMES_SHORT[p.month - 1]} ${p.year}`;
    const day = String(p.day).padStart(2, '0');
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.days.push(day);
    else groups.push({ label, days: [day] });
  }
  return groups.map((g) => `${g.days.join(', ')} ${g.label}`).join(' • ');
}

/** `2:30 PM` (empty when the time is missing). */
export function formatRequestTime(value: string | undefined | null): string {
  return value ? formatTime12(value, { pad: false }) : '';
}

/** `2:30 PM – 4:00 PM` (a missing side stays empty, like v1). */
export function formatPermissionRange(start: string | undefined, end: string | undefined): string {
  return `${formatRequestTime(start)} – ${formatRequestTime(end)}`;
}

export interface PermissionEntry {
  key: string;
  request: StaffRequest;
  date: string;
  status: RequestStatus;
}

export interface PermissionGroup {
  date: string;
  entries: PermissionEntry[];
}

/**
 * Permission requests become one entry per request x date (each with its own status and actions), grouped by date,
 * newest date first. Requests without dates produce no entry (the screen then shows its empty state).
 */
export function groupPermissionsByDate(requests: readonly StaffRequest[]): PermissionGroup[] {
  const byDate = new Map<string, PermissionEntry[]>();
  for (const request of requests) {
    for (const date of request.dates) {
      const list = byDate.get(date) ?? [];
      list.push({ key: `${request.id}-${date}`, request, date, status: dateStatus(request, date) });
      byDate.set(date, list);
    }
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, entries]) => ({ date, entries }));
}

/** The opposite decision offered on an already decided card ("Change to ..."). */
export function oppositeDecision(status: RequestStatus): 'approved' | 'rejected' {
  return status === 'approved' ? 'rejected' : 'approved';
}

/**
 * Dates sent to `update-status`, one call each. Leave: every date of the request (a request without dates is decided
 * with ONE call without a date so the screen never reports a success that did not reach the server). Permission: the
 * card's date. Shift change / device change: the whole request.
 */
export function decisionTargets(type: RequestType, request: StaffRequest, date?: string): (string | undefined)[] {
  if (type === 'permission') return date ? [date] : [undefined];
  if (type === 'leave') return request.dates.length > 0 ? [...request.dates] : [undefined];
  return [undefined];
}

export interface DecisionCopy {
  title: string;
  message: string;
  confirmText: 'Approve' | 'Reject';
  successMessage: string;
}

const NOUN: Record<RequestType, string> = {
  leave: 'leave',
  permission: 'permission',
  shift_change: 'shift change',
  device_change: 'device change',
};

/** Verbatim confirmation / success copy of the four screens. */
export function decisionCopy(args: {
  type: RequestType;
  status: 'approved' | 'rejected';
  isChange: boolean;
  staffName?: string;
  /** Leave: the dates line. Permission: the card date (`dd Mon yyyy`). Others: unused. */
  when?: string;
}): DecisionCopy {
  const { type, status, isChange } = args;
  const name = args.staffName?.trim() || 'this employee';
  const approve = status === 'approved';
  const verb = approve ? 'Approve' : 'Reject';
  const noun = NOUN[type];
  const suffix = type === 'leave' || type === 'permission' ? ` on ${args.when ?? EMPTY_VALUE}` : '';
  const title = isChange ? (approve ? 'Change to Approved' : 'Change to Rejected') : type === 'leave' ? `${verb} Leave` : `${verb} Request`;
  const message = isChange
    ? `Change ${noun} status for ${name}${suffix} to ${status}?`
    : `${verb} ${noun} for ${name}${suffix}?`;
  const successMessage = type === 'leave' ? (approve ? 'Leave Approved' : 'Leave Rejected') : approve ? 'Request Approved' : 'Request Rejected';
  return { title, message, confirmText: verb, successMessage };
}

/**
 * Optimistic cache patch after a successful decision: stamps the decision on every targeted date and, when the request
 * is now decided uniformly (or was decided as a whole), on the request status. Pure; returns a new array.
 */
export function applyDecision(
  requests: readonly StaffRequest[],
  args: { requestId: string; status: 'approved' | 'rejected'; dates: readonly (string | undefined)[]; actionBy: string; at: string },
): StaffRequest[] {
  return requests.map((r) => {
    if (r.id !== args.requestId) return r;
    const decision: DateDecision = { status: args.status, actionBy: args.actionBy, actionAt: args.at };
    const dateStatuses = { ...r.dateStatuses };
    let whole = false;
    for (const d of args.dates) {
      if (d === undefined) whole = true;
      else dateStatuses[d] = decision;
    }
    const known = Object.values(dateStatuses);
    const uniform = known.length > 0 && known.every((s) => s.status === args.status) && r.dates.every((d) => dateStatuses[d]);
    const status = whole || uniform ? args.status : r.status;
    return { ...r, dateStatuses, status };
  });
}
