/**
 * Pure rules for the employee request screens (leave / permission / shift change / device change):
 * which calendar dates may be picked, the permission time-slot grid, validation order + copy, and the
 * pending-badge counters. All dates are IST `YYYY-MM-DD` strings (see `@/lib/datetime`).
 */
import { isSunday, makeDateStr, minutesToTime12, monthKey, monthRange, timeToMinutes } from '@/lib/datetime';
import type { RequestCalendarDay, RequestStatus, RequestType, StaffRequest } from '@/types/api/requests';

// ─── calendar dates ─────────────────────────────────────────────────────────────────────────────

export type CalendarKind = 'leave' | 'permission';

/** Status of every date that already has a request of one kind (`YYYY-MM-DD` -> status). */
export type StatusMap = Record<string, RequestStatus>;

const STATUS_RANK: Record<RequestStatus, number> = { rejected: 0, pending: 1, approved: 2 };

/** Calendar days of one kind -> status per date (when a date repeats the most "settled" status wins). */
export function buildStatusMap(days: readonly RequestCalendarDay[], kind: CalendarKind): StatusMap {
  const out: StatusMap = {};
  for (const d of days) {
    if (d.type !== kind || !d.date) continue;
    const prev = out[d.date];
    if (prev === undefined || STATUS_RANK[d.status] > STATUS_RANK[prev]) out[d.date] = d.status;
  }
  return out;
}

export type DateBlockReason = 'past' | 'sunday' | 'requested';

/**
 * Why a date cannot be picked, or `null` when it can. v1 rules (kept): today is allowed, earlier days are not,
 * Sundays are not, and a date that already has a request of ANY status (rejected included) is not.
 */
export function dateBlockReason(date: string, today: string, statuses: StatusMap): DateBlockReason | null {
  if (date < today) return 'past';
  if (isSunday(date)) return 'sunday';
  if (statuses[date] !== undefined) return 'requested';
  return null;
}

export const isSelectableDate = (date: string, today: string, statuses: StatusMap): boolean =>
  dateBlockReason(date, today, statuses) === null;

/** Every Sunday of a month (the calendar greys them out). `month` is 1-12. */
export function sundaysOfMonth(year: number, month: number): string[] {
  const { days } = monthRange(year, month);
  const out: string[] = [];
  for (let d = 1; d <= days; d += 1) {
    const date = makeDateStr(year, month, d);
    if (isSunday(date)) out.push(date);
  }
  return out;
}

/** Adds the date when absent, removes it when present; always returns an ascending, de-duplicated list. */
export function toggleDate(selected: readonly string[], date: string): string[] {
  const next = selected.includes(date) ? selected.filter((d) => d !== date) : [...selected, date];
  return Array.from(new Set(next)).sort();
}

/** IST month range for the calendar fetch (v1 used UTC and dropped the last day of the month). */
export function calendarRange(year: number, month: number): { start: string; end: string } {
  const { start, end } = monthRange(year, month);
  return { start, end };
}

/** Month key used in the calendar cache key (`YYYY-MM`). */
export const calendarMonthKey = monthKey;

/** `{ year, month }` of a `YYYY-MM-DD` string. */
export function monthOfDate(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

// ─── permission time slots ──────────────────────────────────────────────────────────────────────

export const MAX_PERMISSION_MINUTES = 360;
const SLOT_STEP = 30;

export type TimeSlot = {
  /** `HH:mm` 24h, the value sent to the API. */
  value: string;
  /** `9:30 AM` */
  label: string;
  /** Minutes since midnight. */
  minutes: number;
};

/** 48 half-hour slots, 00:00 - 23:30. */
export const TIME_SLOTS: readonly TimeSlot[] = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * SLOT_STEP;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return { value: `${hh}:${mm}`, label: minutesToTime12(minutes, { pad: false }), minutes };
});

/** Label of a stored `HH:mm` value (`9:30 AM`), or '' when empty. */
export function slotLabel(value: string): string {
  const m = value ? timeToMinutes(value) : null;
  return m === null ? '' : minutesToTime12(m, { pad: false });
}

/**
 * Start-time choices. With no date chosen, or today, only slots strictly later than the current IST minute are
 * offered (v1 treats "no date yet" as today); any later date offers all 48.
 */
export function startSlots(date: string | null, today: string, nowMinutes: number): TimeSlot[] {
  if (!date || date === today) return TIME_SLOTS.filter((s) => s.minutes > nowMinutes);
  return [...TIME_SLOTS];
}

/** End-time choices: later than the start and at most 6 h after it (never crossing midnight: last slot is 23:30). */
export function endSlots(start: string): TimeSlot[] {
  const s = start ? timeToMinutes(start) : null;
  if (s === null) return [];
  return TIME_SLOTS.filter((slot) => slot.minutes > s && slot.minutes <= s + MAX_PERMISSION_MINUTES);
}

// ─── validation (v1 order and copy) ─────────────────────────────────────────────────────────────

export function validateLeave(input: { dates: readonly string[]; reason: string }): string | null {
  if (input.dates.length === 0) return 'Select at least one date';
  if (!input.reason.trim()) return 'Enter a reason for leave';
  return null;
}

export interface PermissionDraft {
  date: string | null;
  startTime: string;
  endTime: string;
  reason: string;
  /** IST today, `YYYY-MM-DD`. */
  today: string;
  /** Whole minutes since IST midnight right now. */
  nowMinutes: number;
}

export function validatePermission(d: PermissionDraft): string | null {
  if (!d.date) return 'Select a date';
  if (!d.startTime) return 'Select start time';
  if (!d.endTime) return 'Select end time';
  if (d.startTime === d.endTime) return 'Start and end time cannot be same';
  const start = timeToMinutes(d.startTime) ?? 0;
  const end = timeToMinutes(d.endTime) ?? 0;
  if (d.date === d.today && start <= d.nowMinutes) return 'Start time must be greater than the current time';
  if (end - start > MAX_PERMISSION_MINUTES) return 'End time cannot be more than 6 hours after start time';
  if (!d.reason.trim()) return 'Enter a reason';
  return null;
}

export function validateShiftChange(input: { reason: string; shiftId: number | null; date: string }): string | null {
  if (!input.reason.trim()) return 'Please enter a reason';
  if (input.shiftId === null) return 'Please select a preferred shift';
  if (!input.date) return 'Please select a requested shift date';
  return null;
}

export function validateDeviceReason(reason: string): string | null {
  return reason.trim() ? null : 'Please enter a reason';
}

// ─── pending badges ─────────────────────────────────────────────────────────────────────────────

export type PendingByType = Record<RequestType, number>;

/**
 * True when a request still waits for a decision. Uses the per-date statuses when the server sent them
 * (any pending date), otherwise the request-level status. One rule for the hub and the home quick action
 * (v1 used two different rules).
 */
export function isPendingRequest(r: StaffRequest): boolean {
  const decisions = Object.values(r.dateStatuses);
  if (decisions.length > 0) return decisions.some((d) => d.status === 'pending');
  return r.status === 'pending';
}

const KNOWN_TYPES: readonly string[] = ['leave', 'permission', 'shift_change', 'device_change'];

/**
 * Pending requests per request type. A row whose server `request_type` is none of the four known types counts for no
 * card (the API mapper files unknown types under `leave`, so the raw value is checked here, as v1 keyed by the raw type).
 */
export function countPendingByType(requests: readonly StaffRequest[]): PendingByType {
  const out: PendingByType = { leave: 0, permission: 0, shift_change: 0, device_change: 0 };
  for (const r of requests) {
    const rawType = typeof r.raw.request_type === 'string' ? r.raw.request_type.toLowerCase() : null;
    if (rawType !== null && !KNOWN_TYPES.includes(rawType)) continue;
    if (isPendingRequest(r)) out[r.type] += 1;
  }
  return out;
}
