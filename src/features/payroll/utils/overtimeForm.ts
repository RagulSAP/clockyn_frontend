import type { OvertimeIncentive } from '@/types/api/payroll';
import type { FieldErrors } from '../types';
import { parsePositive } from './numbers';
import { findDuplicate } from './templates';

export interface OvertimeFormValues {
  hours: string;
  minutes: string;
  amount: string;
}

/** Duration chip text: 90 -> "1h 30m", 120 -> "2h", 45 -> "45m". */
export function formatOvertimeDuration(durationMinutes: number): string {
  const total = Math.max(0, Math.trunc(durationMinutes));
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs > 0) return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`.trim();
  return `${mins}m`;
}

export function overtimeFormFromItem(item: OvertimeIncentive | null): OvertimeFormValues {
  if (!item) return { hours: '', minutes: '', amount: '' };
  const mins = item.durationMinutes % 60;
  return {
    hours: String(Math.floor(item.durationMinutes / 60)),
    minutes: mins > 0 ? String(mins) : '',
    amount: String(item.amount),
  };
}

const wholeNumber = (raw: string): number | null => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null);

/** Total minutes of the typed duration (blank parts count as 0; invalid parts as 0). */
export function overtimeTotalMinutes(form: Pick<OvertimeFormValues, 'hours' | 'minutes'>): number {
  return (wholeNumber(form.hours) ?? 0) * 60 + (wholeNumber(form.minutes) ?? 0);
}

/** Live message for the minutes box. */
export function liveMinutesError(raw: string): string {
  const n = wholeNumber(raw);
  return raw.trim() !== '' && (n === null || n >= 60) ? 'Minutes must be 0-59' : '';
}

export interface OvertimeValidationContext {
  items: readonly OvertimeIncentive[];
  editing: OvertimeIncentive | null;
}

/**
 * Overtime rules: duration (hours : minutes, minutes 0-59, total > 0) unique across templates, amount > 0.
 * Messages follow the v1 wording; a blank / zero duration reads "Enter the Duration".
 */
export function validateOvertimeForm(form: OvertimeFormValues, ctx: OvertimeValidationContext): FieldErrors<OvertimeFormValues> {
  const errors: FieldErrors<OvertimeFormValues> = {};
  const hoursBlank = form.hours.trim() === '';
  const minutesBlank = form.minutes.trim() === '';
  const amountBlank = form.amount.trim() === '';

  if (amountBlank) errors.amount = 'Amount is required';
  if (!hoursBlank && wholeNumber(form.hours) === null) errors.hours = 'Invalid hours';
  if (!minutesBlank) {
    const n = wholeNumber(form.minutes);
    if (n === null || n >= 60) errors.minutes = 'Minutes must be 0-59';
  }
  if (!errors.hours && !errors.minutes && overtimeTotalMinutes(form) === 0) errors.hours = 'Enter the Duration';
  if (!amountBlank && parsePositive(form.amount) === null) errors.amount = 'Amount must be a valid number';
  if (errors.hours || errors.minutes || errors.amount) return errors;

  const duplicate = findDuplicate(ctx.items, overtimeTotalMinutes(form), (t) => t.durationMinutes, ctx.editing?.id);
  if (duplicate) errors.hours = `This duration already exists in Over Time ${duplicate.name}`;
  return errors;
}
