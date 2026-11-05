import type { ApprovalStatus, DateString, RawRecord, UploadFileInput } from './common';

export type ExpenseType = 'travel' | 'bill';

export type ExpenseStatus = ApprovalStatus;

/** Travel ticket or other bill submitted by an employee. */
export interface Expense {
  /** Row id. */
  id: string;
  /** Public expense id: use it for the photo upload and the admin status update. */
  expenseId: string;
  userId?: string;
  orgId?: string;
  /** Employee name (admin lists only). */
  userName?: string;
  date: DateString;
  type: ExpenseType;
  /** Amount in INR. */
  amount: number;
  status: ExpenseStatus;
  photoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  raw: RawRecord;
}

/** Daily odometer reading of a field employee. */
export interface OdometerReading {
  /** Row id. */
  id: string;
  /** Public reading id: use it for the admin status update. */
  readingId: string;
  userId?: string;
  orgId?: string;
  userName?: string;
  date: DateString;
  startKm?: number;
  stopKm?: number;
  distanceKm?: number;
  status: ExpenseStatus;
  startPhotoUrl?: string;
  stopPhotoUrl?: string;
  /** Per-km allowance rate (admin list only). */
  allowanceRate?: number;
  createdAt?: string;
  updatedAt?: string;
  raw: RawRecord;
}

export interface SubmitExpenseInput {
  userId: string;
  date: DateString | Date;
  type: ExpenseType;
  amount: number;
}

export interface SubmitExpenseResult {
  expenseId: string;
  message: string;
}

export interface ExpensePhotoInput {
  userId: string;
  expenseId: string;
  file: UploadFileInput;
}

export interface OdometerStartInput {
  userId: string;
  date: DateString | Date;
  startKm: number;
}

export interface OdometerStopInput {
  userId: string;
  date: DateString | Date;
  stopKm: number;
}

export interface OdometerPhotoInput {
  userId: string;
  date: DateString | Date;
  photoType: 'start' | 'stop';
  file: UploadFileInput;
}

export interface OdometerStopResult {
  distanceKm?: number;
  message: string;
}
