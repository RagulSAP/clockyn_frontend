/**
 * Pricing, credit, GST and coupon maths of the plan purchase flow.
 *
 * Ported EXACTLY from the previous generation (spec: payment_summary §7, upgrade_plan §7) including the
 * rounding points (coupon discount and GST are rounded half-up, the staff charge is not) and the order of
 * operations: staff charge → minus credit → minus coupon → plus 18 % GST. Client prices are display values; the
 * server must recompute (see the change log, Backend needs).
 */
import { addMonthsStr, parseDateParts } from '@/lib/datetime';

export const GST_RATE = 0.18;
/** Minimum staff capacity that can be bought. */
export const MIN_STAFF = 10;
/** The credit for the current plan assumes this fixed baseline of staff (v1 rule, product review pending). */
export const CREDIT_BASELINE_STAFF = 10;
/** Renewals are always priced for 12 months. */
export const RENEW_MONTHS = 12;

/** A = buy / change plan, B = add staff capacity, C = renew. */
export type PurchaseMode = 'new' | 'upgrade' | 'renew';

export function parsePurchaseMode(value: string | string[] | undefined | null): PurchaseMode {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'upgrade' || v === 'renew' ? v : 'new';
}

export interface TotalsInput {
  /** Number of staff being charged (the EXTRA staff for a capacity upgrade). */
  staff: number;
  /** INR per staff per month. */
  price: number;
  /** Months charged. */
  months: number;
  /** Credit deducted from the staff charge (>= 0). */
  credit?: number;
  /** Coupon discount in percent. */
  couponPercent?: number;
}

export interface Totals {
  staffCharge: number;
  afterCredit: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  gst: number;
  grandTotal: number;
}

/** `staffCharge = staff × price × months` (NOT rounded). */
export function calcStaffCharge(staff: number, price: number, months: number): number {
  return staff * price * months;
}

/** Final amounts for the payment summary. */
export function calcTotals({ staff, price, months, credit = 0, couponPercent = 0 }: TotalsInput): Totals {
  const staffCharge = calcStaffCharge(staff, price, months);
  const afterCredit = Math.max(0, staffCharge - credit);
  const discountPercent = Number(couponPercent) || 0;
  const discountAmount = Math.round((afterCredit * discountPercent) / 100);
  const subtotal = Math.max(0, afterCredit - discountAmount);
  const gst = Math.round(subtotal * GST_RATE);
  const grandTotal = subtotal + gst;
  return { staffCharge, afterCredit, discountPercent, discountAmount, subtotal, gst, grandTotal };
}

/** Credit for the current plan: fixed baseline staff × the CURRENT per-staff price × the current plan's own duration. */
export function calcPlanCredit(input: {
  hasCurrentPlan: boolean;
  mode: PurchaseMode;
  isPlanExpired: boolean;
  currentPlanAmount: number;
  currentPlanMonths: number;
}): number {
  if (!input.hasCurrentPlan || input.mode !== 'new' || input.isPlanExpired) return 0;
  return CREDIT_BASELINE_STAFF * input.currentPlanAmount * input.currentPlanMonths;
}

/**
 * Months charged for the purchase. Capacity upgrades (mode B) are charged for the whole calendar months left on the
 * subscription (day of month ignored, at least 1); everything else for the plan duration.
 */
export function calcRemainingMonths(input: { mode: PurchaseMode; planMonths: number; existingEndDate?: string | null; today: string }): number {
  if (input.mode !== 'upgrade' || !input.existingEndDate) return input.planMonths;
  const end = parseDateParts(input.existingEndDate);
  const today = parseDateParts(input.today);
  if (!end || !today) return input.planMonths;
  return Math.max(1, (end.year - today.year) * 12 + (end.month - today.month));
}

/** Smallest selectable staff count: the live limit only when buying/changing a plan with a current plan, else 10. */
export function calcMinStaff(input: { mode: PurchaseMode; hasCurrentPlan: boolean; currentStaff: number }): number {
  return input.mode === 'new' && input.hasCurrentPlan ? input.currentStaff : MIN_STAFF;
}

/** Extra staff of a capacity upgrade (0 for the other modes). */
export function calcExtraStaff(input: { mode: PurchaseMode; staffLimit: number; currentStaff: number }): number {
  return input.mode === 'upgrade' ? Math.max(0, input.staffLimit - input.currentStaff) : 0;
}

/**
 * Display date until which the purchase is valid (the server decides the real end date).
 * Capacity upgrade → the existing end date; renewal → existing end + months; otherwise today + months.
 */
export function calcValidTill(input: { mode: PurchaseMode; months: number; existingEndDate?: string | null; today: string }): string {
  if (input.mode === 'upgrade' && input.existingEndDate) return input.existingEndDate;
  const base = input.mode === 'renew' && input.existingEndDate ? input.existingEndDate : input.today;
  return addMonthsStr(base, input.months);
}

/**
 * Applies the text typed in the "Set Staff Count" dialog (v1 `parseInt` semantics): non-numeric → unchanged,
 * below the minimum → the minimum.
 */
export function applyStaffInput(input: string, min: number, current: number): number {
  const parsed = parseInt(input, 10);
  if (Number.isNaN(parsed)) return current;
  return parsed >= min ? parsed : min;
}

/** Live staff limit from the subscription payload: at least 10, 10 when unknown. */
export function liveStaffLimit(staffLimit: number | null | undefined): number {
  const n = typeof staffLimit === 'number' ? Math.trunc(staffLimit) : NaN;
  return Math.max(MIN_STAFF, Number.isFinite(n) && n > 0 ? n : MIN_STAFF);
}

/** `1 → "1 Month"`, `12 → "1 Year"`, otherwise `"{n} Months"`. */
export function monthLabel(months: number): string {
  if (months === 1) return '1 Month';
  if (months === 12) return '1 Year';
  return `${months} Months`;
}
