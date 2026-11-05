/**
 * Pure rules for the employee expense screens (odometer, travel tickets, other bills): date navigation,
 * amount / reading validation, totals, odometer mode, and the two submit sequences.
 * Dates are IST `YYYY-MM-DD` strings (see `@/lib/datetime`).
 */
import { getErrorMessage } from '@/lib/api/errors';
import { addDaysStr } from '@/lib/datetime';
import { parseMoney, validateMoney } from '@/lib/format';
import type { Expense, OdometerReading } from '@/types/api/expenses';

// ─── date navigation ────────────────────────────────────────────────────────────────────────────

/** Previous day. */
export const prevDate = (date: string): string => addDaysStr(date, -1) || date;

/** Next day, clamped to today (v1 let the arrow walk into the future while the picker blocked it). */
export function nextDate(date: string, today: string): string {
  if (date >= today) return today;
  const next = addDaysStr(date, 1);
  return next === '' || next > today ? today : next;
}

/** Keeps a picked date within `..today`. */
export const clampToToday = (date: string, today: string): string => (date > today ? today : date);

export const canGoNext = (date: string, today: string): boolean => date < today;

// ─── validation ─────────────────────────────────────────────────────────────────────────────────

export const MISSING_PHOTO_OR_AMOUNT = 'Please add a photo and enter amount';

/** Amount of a ticket / bill: a positive number with at most 2 decimals. `null` when valid. */
export function validateExpenseAmount(text: string): string | null {
  return validateMoney(text, 'Amount', { maxDecimals: 2 });
}

export function parseExpenseAmount(text: string): number | null {
  return parseMoney(text, { maxDecimals: 2 });
}

export type OdometerMode = 'start' | 'stop';

/** A reading in km: a non-negative number with at most 2 decimals; a stop reading may not be below the start. */
export function validateOdometerKm(text: string, mode: OdometerMode, startKm?: number): string | null {
  const km = parseMoney(text, { allowZero: true, maxDecimals: 2 });
  if (km === null) return 'Enter a valid odometer reading';
  if (mode === 'stop' && startKm !== undefined && km < startKm) return 'Stop reading cannot be less than the start reading';
  return null;
}

export function parseOdometerKm(text: string): number | null {
  return parseMoney(text, { allowZero: true, maxDecimals: 2 });
}

// ─── totals / lists ─────────────────────────────────────────────────────────────────────────────

/** Sum of the amounts (the badge shows it rounded to whole rupees, like v1: 150.5 -> 151). */
export function totalAmount(expenses: readonly Pick<Expense, 'amount'>[]): number {
  return expenses.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0);
}

export const roundedTotal = (expenses: readonly Pick<Expense, 'amount'>[]): number => Math.round(totalAmount(expenses));

/** Keeps the rows of one date (the list call may return more than the selected day). */
export const expensesOnDate = (expenses: readonly Expense[], date: string): Expense[] => expenses.filter((e) => e.date === date);

// ─── odometer mode ──────────────────────────────────────────────────────────────────────────────

/**
 * The reading waiting for its stop km on `date` (start recorded, no stop yet). v1 looked only at the first reading of the
 * day (so a day with a finished trip and an open one stayed in "start" mode) and treated a start of 0 as missing.
 */
export function openReading(readings: readonly OdometerReading[], date: string): OdometerReading | undefined {
  return readings.find((r) => r.date === date && r.startKm !== undefined && r.stopKm === undefined);
}

export function odometerMode(readings: readonly OdometerReading[], date: string): OdometerMode {
  return openReading(readings, date) ? 'stop' : 'start';
}

// ─── submit sequences ───────────────────────────────────────────────────────────────────────────

export interface ExpenseSubmitDeps {
  /** Step 1: create the record. */
  create: () => Promise<{ expenseId: string }>;
  /** Step 2: upload the photo of that record. */
  upload: (expenseId: string) => Promise<void>;
}

export type ExpenseSubmitOutcome =
  | { status: 'ok'; expenseId: string }
  /** The record exists but its photo is missing: the caller offers a retry that reuses `expenseId` (no duplicate record). */
  | { status: 'photo_failed'; expenseId: string; error: unknown };

/**
 * Travel tickets and bills: create the record, THEN upload the photo. If the upload fails the record is kept and
 * reported (v1 silently left an orphan record and a retry created a second one). Pass `existingExpenseId` to retry
 * only the upload. A failing `create` throws and nothing exists on the server.
 */
export async function submitExpenseWithPhoto(deps: ExpenseSubmitDeps, existingExpenseId?: string): Promise<ExpenseSubmitOutcome> {
  let expenseId = existingExpenseId;
  if (!expenseId) {
    expenseId = (await deps.create()).expenseId;
    if (!expenseId) throw new Error('The server did not return an expense id. Please try again.');
  }
  try {
    await deps.upload(expenseId);
  } catch (error) {
    return { status: 'photo_failed', expenseId, error };
  }
  return { status: 'ok', expenseId };
}

export interface OdometerSubmitDeps<R> {
  uploadPhoto: () => Promise<void>;
  record: () => Promise<R>;
}

/**
 * Odometer: upload the photo FIRST, then create / complete the record (the reverse of travel / bills). A failed upload
 * stops before any record is written and surfaces the server message.
 */
export async function submitOdometerReading<R>(deps: OdometerSubmitDeps<R>): Promise<R> {
  try {
    await deps.uploadPhoto();
  } catch (e) {
    throw new Error(getErrorMessage(e, 'Failed to upload photo'));
  }
  return deps.record();
}
