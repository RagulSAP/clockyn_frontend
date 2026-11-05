import type { ApprovalStatus, DateString, RawRecord, TimeString } from './common';

export type RequestType = 'leave' | 'permission' | 'shift_change' | 'device_change';

export type RequestStatus = ApprovalStatus;

/** Per-date decision of a leave / permission request. */
export interface DateDecision {
  status: RequestStatus;
  actionBy?: string;
  actionAt?: string;
}

interface RequestBase {
  id: string;
  reason: string;
  /**
   * Overall status. Leave requests have no request-level status on the server, so it is derived from
   * `dateStatuses`: any pending date -> `pending`; else any approved date -> `approved`; else `rejected`.
   * Falls back to the request-level status, then `pending`.
   */
  status: RequestStatus;
  /** Dates the request applies to (`YYYY-MM-DD`). */
  dates: DateString[];
  /** Per-date decisions (admin endpoint only; empty for the employee endpoint). */
  dateStatuses: Record<DateString, DateDecision>;
  /** ISO timestamp. */
  createdAt?: string;
  actionBy?: string;
  actionByName?: string;
  actionAt?: string;
  /** Requester (admin endpoint). */
  userId?: string;
  staffName?: string;
  empId?: string;
  photoUrl?: string;
  raw: RawRecord;
}

export interface LeaveRequest extends RequestBase {
  type: 'leave';
}

export interface PermissionRequest extends RequestBase {
  type: 'permission';
  /** `HH:mm` */
  startTime?: TimeString;
  endTime?: TimeString;
}

export interface ShiftChangeRequest extends RequestBase {
  type: 'shift_change';
  requestedShiftId?: number;
  currentShiftId?: number;
  /** Display text, e.g. `"09:00 AM - 06:00 PM"`. */
  requestedShiftTiming?: string;
  currentShiftTiming?: string;
  shiftChangeDate?: DateString;
}

export interface DeviceChangeRequest extends RequestBase {
  type: 'device_change';
}

export type StaffRequest = LeaveRequest | PermissionRequest | ShiftChangeRequest | DeviceChangeRequest;

export interface LeaveRequestInput {
  userId: string;
  orgId: string;
  dates: DateString[];
  reason: string;
}

export interface PermissionRequestInput {
  userId: string;
  orgId: string;
  date: DateString;
  startTime: TimeString;
  endTime: TimeString;
  reason: string;
}

export interface ShiftChangeRequestInput {
  userId: string;
  orgId: string;
  requestedShiftId: number;
  date: DateString;
  reason: string;
}

export interface DeviceChangeRequestInput {
  userId: string;
  orgId: string;
  reason: string;
}

export interface SubmitRequestResult {
  requestId: string;
  message: string;
}

export interface UpdateRequestStatusInput {
  requestId: string;
  status: RequestStatus;
  /** Acting user id. */
  actionBy: string;
  /** Acting role id. */
  roleId: number;
  /** Target a single date of a leave / permission request; omit for all dates. */
  date?: DateString;
}

/** Date already covered by a request (employee calendar greying). */
export interface RequestCalendarDay {
  date: DateString;
  status: RequestStatus;
  type: 'leave' | 'permission';
}

export interface PendingCounts {
  total: number;
  leave: number;
  permission: number;
  shiftChange: number;
  deviceChange: number;
}

export interface SessionCheck {
  valid: boolean;
  forceLogout: boolean;
  /** `user_not_found | account_inactive | device_change_approved | logged_in_on_another_device` */
  reason?: string;
}
