/**
 * Leave / permission / shift-change / device-change requests: submit, lists, approval, calendar,
 * pending counters and the single-device session check.
 */
import { api, isApiError } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult } from '@/types/api/common';
import type {
  DeviceChangeRequestInput,
  LeaveRequestInput,
  PendingCounts,
  PermissionRequestInput,
  RequestCalendarDay,
  RequestStatus,
  SessionCheck,
  ShiftChangeRequestInput,
  StaffRequest,
  SubmitRequestResult,
  UpdateRequestStatusInput,
} from '@/types/api/requests';
import { listOf, messageOf, rec, str, toHHmm } from './mappers/common';
import { computePendingCounts, mapCalendarDay, mapRequest, mapSessionCheck } from './mappers/requests';
import { dateParam, requiredDateParam } from './params';
import { seg } from './sharedHelpers';

/** `{success:false}` without a message reads "Failed to submit" (v1); the success text is only the message fallback. */
function submitResult(body: unknown, successMessage: string): SubmitRequestResult {
  const checked = assertSuccess(body, 'Failed to submit');
  return { requestId: str(rec(checked).request_id), message: messageOf(checked, successMessage) };
}

/** Submits a leave request for one or more dates. `POST /requests/leave/submit`. */
export async function submitLeave(input: LeaveRequestInput): Promise<SubmitRequestResult> {
  const body = await api.post<unknown>('/requests/leave/submit', {
    user_id: input.userId,
    org_id: input.orgId,
    leave_dates: input.dates.map((d) => requiredDateParam(d, 'leave date')),
    reason: input.reason,
  });
  return submitResult(body, 'Leave request submitted successfully');
}

/** Submits a permission (short absence) request; times are `HH:mm`. `POST /requests/permission/submit`. */
export async function submitPermission(input: PermissionRequestInput): Promise<SubmitRequestResult> {
  const start = toHHmm(input.startTime);
  const end = toHHmm(input.endTime);
  if (!start || !end) throw new Error('Permission times must be in HH:mm format');
  const body = await api.post<unknown>('/requests/permission/submit', {
    user_id: input.userId,
    org_id: input.orgId,
    permission_date: requiredDateParam(input.date, 'permission date'),
    start_time: start,
    end_time: end,
    reason: input.reason,
  });
  return submitResult(body, 'Permission request submitted successfully');
}

/** Submits a shift-change request for a date. `POST /requests/shift-change/submit`. */
export async function submitShiftChange(input: ShiftChangeRequestInput): Promise<SubmitRequestResult> {
  const body = await api.post<unknown>('/requests/shift-change/submit', {
    user_id: input.userId,
    org_id: input.orgId,
    reason: input.reason,
    requested_shift_id: input.requestedShiftId,
    shift_change_date: requiredDateParam(input.date, 'shift change date'),
  });
  return submitResult(body, 'Shift change request submitted successfully');
}

/** Asks the admin to approve a new device (works before login). `POST /requests/device-change/submit`. */
export async function submitDeviceChange(input: DeviceChangeRequestInput): Promise<SubmitRequestResult> {
  const body = await api.post<unknown>('/requests/device-change/submit', {
    user_id: input.userId,
    org_id: input.orgId,
    reason: input.reason,
  });
  return submitResult(body, 'Device change request submitted successfully');
}

/**
 * The employee's own requests, newest first. `GET /requests/employee/{userId}/{orgId}`.
 * The server omits per-date statuses here, so leave / permission `status` falls back to the request-level value.
 */
export async function listEmployeeRequests(userId: string, orgId: string): Promise<StaffRequest[]> {
  const body = assertSuccess(await api.get<unknown>(`/requests/employee/${seg(userId)}/${seg(orgId)}`), 'Failed to load requests');
  return listOf(body).map(mapRequest);
}

/**
 * All requests of an organisation with per-date statuses. `GET /requests/admin/{orgId}[?status=]`.
 * (The server's `status` filter never matches leave requests; filter client-side instead.)
 */
export async function listAdminRequests(orgId: string, status?: RequestStatus): Promise<StaffRequest[]> {
  const body = assertSuccess(await api.get<unknown>(`/requests/admin/${seg(orgId)}`, { status }), 'Failed to load requests');
  return listOf(body).map(mapRequest);
}

/**
 * Approves / rejects a request (or one date of a leave / permission request). `POST /requests/update-status`.
 * Approving a device change forces the employee to sign in again with OTP on the new device.
 */
export async function updateRequestStatus(input: UpdateRequestStatusInput): Promise<ActionResult> {
  const body = assertSuccess(
    await api.post<unknown>('/requests/update-status', {
      request_id: input.requestId,
      status: input.status,
      action_by: input.actionBy,
      role_id: input.roleId,
      leave_date: dateParam(input.date),
    }),
    'Failed to update request',
  );
  return { message: messageOf(body, `Request ${input.status} successfully`) };
}

/** Dates already covered by the employee's requests in a range (calendar greying). `GET /requests/calendar/{userId}/{orgId}`. */
export async function getRequestCalendar(
  userId: string,
  orgId: string,
  startDate: string | Date,
  endDate: string | Date,
): Promise<RequestCalendarDay[]> {
  const body = assertSuccess(
    await api.get<unknown>(`/requests/calendar/${seg(userId)}/${seg(orgId)}`, {
      start_date: requiredDateParam(startDate, 'start date'),
      end_date: requiredDateParam(endDate, 'end date'),
    }),
    'Failed to load request calendar',
  );
  return listOf(body)
    .map(mapCalendarDay)
    .filter((d) => d.date !== '');
}

/**
 * Pending-request counters per type for the admin badge, computed from the admin list (the server has no
 * counts endpoint). Throws on failure (v1 returned zeros).
 */
export async function getPendingCounts(orgId: string): Promise<PendingCounts> {
  return computePendingCounts(await listAdminRequests(orgId));
}

/**
 * Single-device session check. `GET /requests/check-session/{userId}?device_token=`.
 * Deliberately FAILS OPEN: any HTTP / network failure resolves `{valid:true, forceLogout:false}` so a
 * flaky connection never signs the user out (v1 behaviour); only a definite answer can force a logout.
 */
export async function checkSession(userId: string, deviceToken: string): Promise<SessionCheck> {
  try {
    const body = await api.get<unknown>(`/requests/check-session/${seg(userId)}`, { device_token: deviceToken });
    return mapSessionCheck(body);
  } catch (e) {
    if (isApiError(e)) return { valid: true, forceLogout: false };
    throw e;
  }
}
