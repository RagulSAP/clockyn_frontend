import type {
  DateDecision,
  PendingCounts,
  RequestCalendarDay,
  RequestStatus,
  RequestType,
  SessionCheck,
  StaffRequest,
} from '@/types/api/requests';
import { arr, bool, dateOnly, isRecord, optNum, optStr, rec, str, toHHmm } from './common';

const STATUSES: RequestStatus[] = ['pending', 'approved', 'rejected'];
const TYPES: RequestType[] = ['leave', 'permission', 'shift_change', 'device_change'];

function parseStatus(v: unknown): RequestStatus | undefined {
  const s = str(v).toLowerCase();
  return (STATUSES as string[]).includes(s) ? (s as RequestStatus) : undefined;
}

function mapDateStatuses(v: unknown): Record<string, DateDecision> {
  const out: Record<string, DateDecision> = {};
  if (!isRecord(v)) return out;
  for (const [key, value] of Object.entries(v)) {
    const date = dateOnly(key);
    if (!date) continue;
    const d = rec(value);
    out[date] = {
      status: parseStatus(d.status) ?? 'pending',
      actionBy: optStr(d.action_by),
      actionAt: optStr(d.action_at),
    };
  }
  return out;
}

/** Overall status of a request (see `RequestBase.status`). */
export function deriveStatus(requestStatus: RequestStatus | undefined, decisions: Record<string, DateDecision>): RequestStatus {
  const values = Object.values(decisions);
  if (values.length > 0) {
    if (values.some((d) => d.status === 'pending')) return 'pending';
    if (values.some((d) => d.status === 'approved')) return 'approved';
    return 'rejected';
  }
  return requestStatus ?? 'pending';
}

/** One request row of the employee (`/requests/employee/..`) or admin (`/requests/admin/..`) list. */
export function mapRequest(input: unknown): StaffRequest {
  const r = rec(input);
  const typeStr = str(r.request_type).toLowerCase();
  const type: RequestType = (TYPES as string[]).includes(typeStr) ? (typeStr as RequestType) : 'leave';
  const dateStatuses = mapDateStatuses(r.date_statuses);
  const dates = arr(r.dates)
    .map(dateOnly)
    .filter((d): d is string => d !== undefined);
  const base = {
    id: str(r.request_id),
    reason: str(r.reason),
    status: deriveStatus(parseStatus(r.status), dateStatuses),
    dates,
    dateStatuses,
    createdAt: optStr(r.created_at),
    actionBy: optStr(r.action_by),
    actionByName: optStr(r.action_by_name),
    actionAt: optStr(r.action_at),
    userId: optStr(r.user_id),
    staffName: optStr(r.staff_name),
    empId: optStr(r.emp_id),
    photoUrl: optStr(r.profile_photo),
    raw: r,
  };
  switch (type) {
    case 'permission':
      return {
        ...base,
        type,
        startTime: toHHmm(r.permission_start_time),
        endTime: toHHmm(r.permission_end_time),
      };
    case 'shift_change':
      return {
        ...base,
        type,
        requestedShiftId: optNum(r.requested_shift_id),
        currentShiftId: optNum(r.current_shift_id),
        requestedShiftTiming: optStr(r.requested_shift_timing),
        currentShiftTiming: optStr(r.current_shift_timing),
        shiftChangeDate: dateOnly(r.shift_change_date),
      };
    default:
      return { ...base, type };
  }
}

export function mapCalendarDay(input: unknown): RequestCalendarDay {
  const r = rec(input);
  return {
    date: dateOnly(r.date) ?? '',
    status: parseStatus(r.status) ?? 'pending',
    type: str(r.type).toLowerCase() === 'permission' ? 'permission' : 'leave',
  };
}

/** True when the request still needs an admin decision (any pending date, or a pending request-level status). */
export function hasPending(request: StaffRequest): boolean {
  const decisions = Object.values(request.dateStatuses);
  if (decisions.length > 0) return decisions.some((d) => d.status === 'pending');
  return request.status === 'pending';
}

export const EMPTY_PENDING_COUNTS: PendingCounts = {
  total: 0,
  leave: 0,
  permission: 0,
  shiftChange: 0,
  deviceChange: 0,
};

/** Pending-request counters per type, computed like v1 from the admin list. */
export function computePendingCounts(requests: StaffRequest[]): PendingCounts {
  const count = (type: RequestType) => requests.filter((r) => r.type === type && hasPending(r)).length;
  const leave = count('leave');
  const permission = count('permission');
  const shiftChange = count('shift_change');
  const deviceChange = count('device_change');
  return { total: leave + permission + shiftChange + deviceChange, leave, permission, shiftChange, deviceChange };
}

/** `pending - seen` per type, clamped at 0 (badge counts the admin has not looked at yet). */
export function computeUnreadCounts(
  pending: PendingCounts,
  seen: Partial<Omit<PendingCounts, 'total'>> | null | undefined,
): PendingCounts {
  const diff = (type: Exclude<keyof PendingCounts, 'total'>) => Math.max(0, pending[type] - (seen?.[type] ?? 0));
  const leave = diff('leave');
  const permission = diff('permission');
  const shiftChange = diff('shiftChange');
  const deviceChange = diff('deviceChange');
  return { total: leave + permission + shiftChange + deviceChange, leave, permission, shiftChange, deviceChange };
}

/** `/requests/check-session` body -> DTO. */
export function mapSessionCheck(body: unknown): SessionCheck {
  const r = rec(body);
  const forceLogout = bool(r.force_logout);
  return {
    valid: r.valid === undefined ? !forceLogout : bool(r.valid),
    forceLogout,
    reason: optStr(r.reason),
  };
}
