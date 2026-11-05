import { MONTH_NAMES } from '@/lib/datetime';
import type { BonusIncentive } from '@/types/api/payroll';
import type { FieldErrors } from '../types';
import { parseNumberInput } from './numbers';
import { findDuplicate } from './templates';

export interface BonusFormValues {
  percent: string;
  /** English month name, `''` when none is chosen. */
  month: string;
  year: number | null;
}

export const BONUS_MONTHS: readonly string[] = MONTH_NAMES;

export function bonusFormFromItem(item: BonusIncentive | null): BonusFormValues {
  if (!item) return { percent: '', month: '', year: null };
  return { percent: String(item.bonusPercent), month: item.month, year: item.year };
}

/** Year choices: `currentYear - 5 ... currentYear + 4`; a stored year outside the window is added so it stays selectable. */
export function bonusYearOptions(currentYear: number, selected?: number | null): number[] {
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
  if (selected && !years.includes(selected)) years.push(selected);
  return years.sort((a, b) => a - b);
}

const PERCENT_RANGE_MESSAGE = 'Enter a number between 0-100';

function percentValue(raw: string): number | null {
  const n = parseNumberInput(raw);
  return n !== null && n >= 0 && n <= 100 ? n : null;
}

/** Live message while typing the percentage. */
export function livePercentError(raw: string): string {
  return raw.trim() !== '' && percentValue(raw) === null ? PERCENT_RANGE_MESSAGE : '';
}

export interface BonusValidationContext {
  items: readonly BonusIncentive[];
  editing: BonusIncentive | null;
}

/** Bonus rules: percentage 0-100 (0 allowed) unique across templates; month and year required. All errors are reported together. */
export function validateBonusForm(form: BonusFormValues, ctx: BonusValidationContext): FieldErrors<BonusFormValues> {
  const errors: FieldErrors<BonusFormValues> = {};
  if (form.percent.trim() === '') errors.percent = 'Percentage is required';
  else if (percentValue(form.percent) === null) errors.percent = PERCENT_RANGE_MESSAGE;
  if (form.month === '') errors.month = 'Month is required';
  if (form.year === null) errors.year = 'Year is required';
  if (errors.percent || errors.month || errors.year) return errors;

  const percent = percentValue(form.percent) as number;
  const duplicate = findDuplicate(ctx.items, percent, (t) => t.bonusPercent, ctx.editing?.id);
  if (duplicate) errors.percent = `This percentage already exists in Bonus ${duplicate.name}`;
  return errors;
}

/** Percentage to send; throws when invalid (callers validate first). */
export function bonusPercentValue(form: BonusFormValues): number {
  const n = percentValue(form.percent);
  if (n === null) throw new Error(PERCENT_RANGE_MESSAGE);
  return n;
}
