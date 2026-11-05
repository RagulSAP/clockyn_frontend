/** Employee expenses (odometer readings, travel tickets, other bills) and the admin review side. */
import { api } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult } from '@/types/api/common';
import type {
  Expense,
  ExpensePhotoInput,
  ExpenseType,
  OdometerPhotoInput,
  OdometerReading,
  OdometerStartInput,
  OdometerStopInput,
  OdometerStopResult,
  SubmitExpenseInput,
  SubmitExpenseResult,
} from '@/types/api/expenses';
import { listOf, messageOf, num, optNum, rec, str } from './mappers/common';
import { mapExpense, mapOdometerReading } from './mappers/expenses';
import { dateParam, requiredDateParam, toUploadFile } from './params';
import { seg } from './sharedHelpers';

type Review = 'approved' | 'rejected';

// ─── Employee: odometer ──────────────────────────────────────────────────────────────────────

/** The employee's readings, optionally for one date (without a date the server returns the last 30). `GET /expenses/odometer/readings`. */
export async function getOdometerReadings(userId: string, date?: string | Date): Promise<OdometerReading[]> {
  const body = assertSuccess(
    await api.get<unknown>('/expenses/odometer/readings', { user_id: userId, reading_date: dateParam(date) }),
    'Failed to load odometer readings',
  );
  return listOf(body).map(mapOdometerReading);
}

/** Records the start-of-day odometer km. `POST /expenses/odometer/start`. */
export async function startOdometer(input: OdometerStartInput): Promise<ActionResult> {
  const body = assertSuccess(
    await api.post<unknown>('/expenses/odometer/start', {
      user_id: input.userId,
      reading_date: requiredDateParam(input.date, 'reading date'),
      start_km: input.startKm,
    }),
    'Failed to submit',
  );
  return { message: messageOf(body, 'Start reading saved') };
}

/** Records the end-of-day odometer km and returns the distance. `POST /expenses/odometer/stop`. */
export async function stopOdometer(input: OdometerStopInput): Promise<OdometerStopResult> {
  const body = assertSuccess(
    await api.post<unknown>('/expenses/odometer/stop', {
      user_id: input.userId,
      reading_date: requiredDateParam(input.date, 'reading date'),
      stop_km: input.stopKm,
    }),
    'Failed to submit',
  );
  return { distanceKm: optNum(rec(body).distance), message: messageOf(body, 'Stop reading saved') };
}

/** Uploads the odometer photo (taken before submitting the km). `POST /expenses/odometer/upload-photo?user_id&reading_date&photo_type`. */
export async function uploadOdometerPhoto(input: OdometerPhotoInput): Promise<void> {
  const body = await api.upload<unknown>('/expenses/odometer/upload-photo', toUploadFile(input.file, 'file', `odometer_${input.photoType}`), {
    query: {
      user_id: input.userId,
      reading_date: requiredDateParam(input.date, 'reading date'),
      photo_type: input.photoType,
    },
  });
  assertSuccess(body, 'Failed to upload photo');
}

// ─── Employee: travel tickets & bills ────────────────────────────────────────────────────────

/**
 * Step 1 of an expense: creates the row and returns its `expenseId` (then upload the photo).
 * `POST /expenses/travel-bill/submit`.
 */
export async function submitExpense(input: SubmitExpenseInput): Promise<SubmitExpenseResult> {
  const body = assertSuccess(
    await api.post<unknown>('/expenses/travel-bill/submit', {
      user_id: input.userId,
      expense_date: requiredDateParam(input.date, 'expense date'),
      expense_type: input.type,
      amount: input.amount,
    }),
    'Failed to submit expense',
  );
  return { expenseId: str(rec(body).expense_id), message: messageOf(body, 'Expense submitted successfully') };
}

/** Step 2 of an expense: uploads the receipt photo. `POST /expenses/travel-bill/upload-photo?user_id&expense_id` (field `file`). */
export async function uploadExpensePhoto(input: ExpensePhotoInput): Promise<void> {
  const body = await api.upload<unknown>('/expenses/travel-bill/upload-photo', toUploadFile(input.file, 'file', 'expense'), {
    query: { user_id: input.userId, expense_id: input.expenseId },
  });
  assertSuccess(body, 'Failed to upload photo');
}

/**
 * The employee's tickets / bills, newest first (the server returns at most 30 per call).
 * `GET /expenses/travel-bill/expenses?user_id&expense_type=TRAVEL|BILL[&expense_date=]`.
 */
export async function listMyExpenses(userId: string, filter: { type?: ExpenseType; date?: string | Date } = {}): Promise<Expense[]> {
  const body = assertSuccess(
    await api.get<unknown>('/expenses/travel-bill/expenses', {
      user_id: userId,
      expense_type: filter.type?.toUpperCase(),
      expense_date: dateParam(filter.date),
    }),
    'Failed to load expenses',
  );
  return listOf(body).map(mapExpense);
}

// ─── Admin ───────────────────────────────────────────────────────────────────────────────────

/** All odometer readings of the organisation (with employee name and allowance rate). `GET /expenses/admin/odometer-readings/{orgId}`. */
export async function listOdometerReadings(orgId: string): Promise<OdometerReading[]> {
  const body = assertSuccess(await api.get<unknown>(`/expenses/admin/odometer-readings/${seg(orgId)}`), 'Failed to load odometer readings');
  return listOf(body).map(mapOdometerReading);
}

/** Approves / rejects an odometer reading. `PUT /expenses/admin/odometer-readings/{readingId}/status`. */
export async function reviewOdometerReading(readingId: string, status: Review, orgId: string): Promise<ActionResult> {
  const body = assertSuccess(
    await api.put<unknown>(`/expenses/admin/odometer-readings/${seg(readingId)}/status`, { status, org_id: orgId }),
    'Failed to update reading',
  );
  return { message: messageOf(body, `Reading ${status}`) };
}

/** Travel tickets and / or bills of the organisation (with employee name). `GET /expenses/admin/travel-bill/{orgId}?expense_type=`. */
export async function listExpenses(orgId: string, type?: ExpenseType): Promise<Expense[]> {
  const body = assertSuccess(
    await api.get<unknown>(`/expenses/admin/travel-bill/${seg(orgId)}`, { expense_type: type?.toUpperCase() }),
    'Failed to load expenses',
  );
  return listOf(body).map(mapExpense);
}

/** Approves / rejects a ticket or bill. `PUT /expenses/admin/travel-bill/{expenseId}/status`. */
export async function reviewExpense(expenseId: string, status: Review, orgId: string): Promise<ActionResult> {
  const body = assertSuccess(
    await api.put<unknown>(`/expenses/admin/travel-bill/${seg(expenseId)}/status`, { status, org_id: orgId }),
    'Failed to update expense',
  );
  return { message: messageOf(body, `Expense ${status}`) };
}

/** Per-km travel allowance rate (INR). `GET /expenses/admin/allowance-rate/{orgId}`. */
export async function getAllowanceRate(orgId: string): Promise<number> {
  const body = assertSuccess(await api.get<unknown>(`/expenses/admin/allowance-rate/${seg(orgId)}`), 'Failed to load allowance rate');
  return num(rec(body).rate);
}

/**
 * Saves the per-km allowance rate. The server only accepts a whole number of rupees, so the rate is
 * rounded to the nearest integer before sending. `POST /expenses/admin/allowance-rate`.
 */
export async function setAllowanceRate(orgId: string, rate: number): Promise<ActionResult> {
  const whole = Math.round(rate);
  if (!Number.isFinite(rate) || whole < 1) throw new Error('Allowance rate must be at least 1 rupee per km');
  const body = assertSuccess(
    await api.post<unknown>('/expenses/admin/allowance-rate', { org_id: orgId, rate: whole }),
    'Failed to save allowance rate',
  );
  return { message: messageOf(body, 'Allowance rate saved') };
}
