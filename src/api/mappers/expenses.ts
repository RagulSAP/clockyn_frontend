import type { Expense, ExpenseStatus, ExpenseType, OdometerReading } from '@/types/api/expenses';
import { dateOnly, num, optNum, optStr, pick, rec, str } from './common';

function parseStatus(v: unknown): ExpenseStatus {
  const s = str(v).toLowerCase();
  return s === 'approved' || s === 'rejected' ? s : 'pending';
}

export function mapExpenseType(v: unknown): ExpenseType {
  return str(v).toLowerCase() === 'bill' ? 'bill' : 'travel';
}

/** Travel / bill row. Admin rows use `expense_id|id`, employee rows both. */
export function mapExpense(input: unknown): Expense {
  const r = rec(input);
  const expenseId = str(pick(r, 'expense_id', 'id'));
  return {
    id: str(pick(r, 'id', 'expense_id')),
    expenseId,
    userId: optStr(r.user_id),
    orgId: optStr(r.org_id),
    userName: optStr(r.user_name),
    date: dateOnly(r.expense_date) ?? '',
    type: mapExpenseType(r.expense_type),
    amount: num(r.amount),
    status: parseStatus(r.status),
    photoUrl: optStr(r.photo_url),
    createdAt: optStr(r.created_at),
    updatedAt: optStr(r.updated_at),
    raw: r,
  };
}

export function mapOdometerReading(input: unknown): OdometerReading {
  const r = rec(input);
  return {
    id: str(pick(r, 'id', 'readings_id')),
    readingId: str(pick(r, 'readings_id', 'id')),
    userId: optStr(r.user_id),
    orgId: optStr(r.org_id),
    userName: optStr(r.user_name),
    date: dateOnly(r.reading_date) ?? '',
    startKm: optNum(r.start_km),
    stopKm: optNum(r.stop_km),
    distanceKm: optNum(r.distance_km),
    status: parseStatus(r.status),
    startPhotoUrl: optStr(r.start_photo_url),
    stopPhotoUrl: optStr(r.stop_photo_url),
    allowanceRate: optNum(r.allowance_rate),
    createdAt: optStr(r.created_at),
    updatedAt: optStr(r.updated_at),
    raw: r,
  };
}

/** Today's reading mode: `stop` once a start km exists without a stop km, else `start`. */
export function odometerMode(reading: OdometerReading | undefined): 'start' | 'stop' | 'done' {
  if (!reading || reading.startKm === undefined) return 'start';
  return reading.stopKm === undefined ? 'stop' : 'done';
}
