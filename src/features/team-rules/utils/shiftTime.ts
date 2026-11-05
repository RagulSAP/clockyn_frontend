/**
 * Shift form validation and display helpers.
 *
 * Times are kept as 24-hour `HH:mm` in the app (the API layer converts to the wire format `hh:mmAM/PM`).
 * The backend rejects shifts longer than 18 hours (wrapping past midnight), so that check is repeated here with the
 * server's explanation instead of failing with a generic toast like v1.
 */
import { formatTime12, shiftSpanMinutes, timeToMinutes, toTime24 } from '@/lib/datetime';
import type { Shift } from '@/types/api/shifts';

export const MAX_SHIFT_MINUTES = 18 * 60;

export const SHIFT_MESSAGES = {
  nameRequired: 'Enter a shift name',
  startRequired: 'Select a start time',
  endRequired: 'Select an end time',
  sameTime: 'Start time and end time cannot be the same',
  duplicateName: 'Shift with this name already exists',
  duplicateTime: 'Shift with this time already exists',
} as const;

export type ShiftFormValues = { name: string; startTime: string; endTime: string };
export type ShiftFormErrors = { name?: string; startTime?: string; endTime?: string; form?: string };

/** "9h", "8h 30m". `null` when either time is invalid. */
export function shiftDurationLabel(start: string, end: string): string | null {
  const span = shiftSpanMinutes(start, end);
  if (span === null) return null;
  const h = Math.floor(span / 60);
  const m = Math.round(span % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Message for a shift that is longer than the backend allows; `null` when the length is acceptable. */
export function shiftTooLongMessage(start: string, end: string): string | null {
  const span = shiftSpanMinutes(start, end);
  if (span === null || span <= MAX_SHIFT_MINUTES) return null;
  const hours = (span / 60).toFixed(1);
  return `This shift works out to ${hours} hours (${formatTime12(start)} to ${formatTime12(end)}). Please double-check the start/end time, especially AM/PM.`;
}

/**
 * Validates the add / edit shift form against the loaded list. Rule order (v1): empty fields (now reported instead of
 * silently ignored) -> same start/end -> duplicate name (case-insensitive) -> duplicate (start, end) pair ->
 * longer than 18 hours. Only the first failing rule is returned. When editing, `editingId` is excluded from the
 * duplicate checks so a shift may keep its own name/time.
 */
export function validateShiftForm(values: ShiftFormValues, existing: readonly Shift[], editingId?: number | null): ShiftFormErrors {
  const name = values.name.trim();
  const errors: ShiftFormErrors = {};
  if (!name) errors.name = SHIFT_MESSAGES.nameRequired;
  if (!values.startTime) errors.startTime = SHIFT_MESSAGES.startRequired;
  if (!values.endTime) errors.endTime = SHIFT_MESSAGES.endRequired;
  if (errors.name || errors.startTime || errors.endTime) return errors;

  const start = toTime24(values.startTime);
  const end = toTime24(values.endTime);
  if (!start) return { startTime: SHIFT_MESSAGES.startRequired };
  if (!end) return { endTime: SHIFT_MESSAGES.endRequired };

  if (start === end) return { form: SHIFT_MESSAGES.sameTime };

  const others = existing.filter((s) => editingId === null || editingId === undefined || s.id !== editingId);
  const lower = name.toLowerCase();
  if (others.some((s) => s.name.trim().toLowerCase() === lower)) return { name: SHIFT_MESSAGES.duplicateName };
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (others.some((s) => timeToMinutes(s.startTime) === startMin && timeToMinutes(s.endTime) === endMin)) {
    return { form: SHIFT_MESSAGES.duplicateTime };
  }

  const tooLong = shiftTooLongMessage(start, end);
  if (tooLong) return { form: tooLong };
  return {};
}

export function hasShiftErrors(errors: ShiftFormErrors): boolean {
  return Boolean(errors.name || errors.startTime || errors.endTime || errors.form);
}

/** "09:00 AM - 06:00 PM" */
export function formatShiftRange(start: string, end: string): string {
  return `${formatTime12(start)} - ${formatTime12(end)}`;
}
