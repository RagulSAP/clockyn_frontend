import type { FieldErrors } from '../types';
import { parseNumberInput, parsePositive } from './numbers';
import { findDuplicate, type TemplateBase } from './templates';

/** View item of a daily-wage / hourly-charge template. */
export interface WageItem extends TemplateBase {
  amount: number;
}

export interface WageFormValues {
  amount: string;
}

export function wageFormFromItem(item: WageItem | null): WageFormValues {
  return { amount: item ? String(item.amount) : '' };
}

export interface WageValidationContext {
  items: readonly WageItem[];
  editing: WageItem | null;
  /** Hourly charges refuse an amount already used by another template; the message prefix names that template. */
  duplicateLabel?: string;
}

/**
 * Daily wages: required, number greater than zero. Hourly charges additionally: unique amount
 * (`This amount already exists in Hour-Pay-{n}`), evaluated on save only.
 */
export function validateWageForm(form: WageFormValues, ctx: WageValidationContext): FieldErrors<WageFormValues> {
  if (form.amount.trim() === '') return { amount: 'Amount is required' };
  const amount = parsePositive(form.amount);
  if (amount === null) return { amount: 'Amount must be a valid number' };
  if (ctx.duplicateLabel) {
    const duplicate = findDuplicate(ctx.items, amount, (t) => t.amount, ctx.editing?.id);
    if (duplicate) return { amount: `This amount already exists in ${ctx.duplicateLabel}${duplicate.name}` };
  }
  return {};
}

/** Amount to send; throws when the form is invalid (callers validate first). */
export function wageAmount(form: WageFormValues): number {
  const amount = parseNumberInput(form.amount);
  if (amount === null || amount <= 0) throw new Error('Amount must be a valid number');
  return amount;
}
