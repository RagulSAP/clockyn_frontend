/** Validation of the "Add advance" form (v1 accepted 0, negative and "5abc" amounts; fixed). */
import { isValidDateStr } from '@/lib/datetime';

export type AdvanceField = 'date' | 'amount';

export type AdvanceValidation =
  | { ok: true; amount: number; date: string }
  | { ok: false; field: AdvanceField; message: string };

export const ADVANCE_MESSAGES = {
  dateRequired: 'Please select a date',
  dateFuture: 'Advance date cannot be in the future',
  amountInvalid: 'Please enter a valid amount',
  amountPositive: 'Amount must be greater than 0',
} as const;

/** Keep digits and at most one decimal point (typing helper for the amount field). */
export function sanitizeAmountInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
}

const NUMERIC = /^(\d+(\.\d*)?|\.\d+)$/;

/** `today` is the IST business date (`todayIST()`); the advance date may not be after it. */
export function validateAdvance(input: { date: string; amount: string }, today: string): AdvanceValidation {
  const date = input.date.trim();
  if (!date) return { ok: false, field: 'date', message: ADVANCE_MESSAGES.dateRequired };
  if (!isValidDateStr(date)) return { ok: false, field: 'date', message: ADVANCE_MESSAGES.dateRequired };
  if (date > today) return { ok: false, field: 'date', message: ADVANCE_MESSAGES.dateFuture };

  const text = input.amount.trim();
  if (!NUMERIC.test(text)) return { ok: false, field: 'amount', message: ADVANCE_MESSAGES.amountInvalid };
  const amount = Number(text);
  if (!Number.isFinite(amount)) return { ok: false, field: 'amount', message: ADVANCE_MESSAGES.amountInvalid };
  if (amount <= 0) return { ok: false, field: 'amount', message: ADVANCE_MESSAGES.amountPositive };
  return { ok: true, amount, date };
}
