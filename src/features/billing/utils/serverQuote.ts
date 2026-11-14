/**
 * Glue between the server's price quote (`POST /orders/quote`, `OrderQuote`) and the checkout's local shapes
 * (`Totals`, `Quote`). Pure helpers: the screen shows the server numbers when a quote is available and keeps the
 * local pricing (`pricing.ts` / `quote.ts`) otherwise.
 */
import { formatINR } from '@/lib/format';
import type { Coupon, OrderQuote } from '@/types/api/billing';

import type { Totals } from './pricing';
import type { Quote } from './quote';

/** The totals the server will charge, in the shape the breakdown renders. */
export function quoteToTotals(q: OrderQuote): Totals {
  return {
    staffCharge: q.staffCharge,
    afterCredit: q.afterCredit,
    discountPercent: q.referralApplied ? (q.referralPercent ?? 0) : (q.discountPercent ?? 0),
    // `discountAmount` is the coupon's OR the referral reward's discount (never both: the server rejects the combination).
    discountAmount: q.couponApplied || q.referralApplied ? q.discountAmount : 0,
    subtotal: q.subtotal,
    gst: q.gst,
    grandTotal: q.grandTotal,
  };
}

/** The local quote with the server's facts (credit, months, price, validity) laid over it. */
export function withServerQuote(local: Quote, q: OrderQuote): Quote {
  return {
    ...local,
    plan: { ...local.plan, amount: q.pricePerStaffMonth > 0 ? q.pricePerStaffMonth : local.plan.amount },
    chargedStaff: q.chargedStaff > 0 ? q.chargedStaff : local.chargedStaff,
    chargedMonths: q.chargedMonths > 0 ? q.chargedMonths : local.chargedMonths,
    // the months-free figure belongs to the same server answer as the paid months (an older server reports none)
    freeMonths: q.chargedMonths > 0 ? (q.freeMonths ?? 0) : local.freeMonths,
    credit: q.credit,
    validTill: q.validTill ?? local.validTill,
  };
}

/** A percent coupon whose discount was reduced by a cap (`max_discount`) or the amount itself. */
function isCapped(q: OrderQuote): boolean {
  if (q.discountPercent === null) return false;
  return q.discountAmount !== Math.round((q.afterCredit * q.discountPercent) / 100);
}

/** Label of the discount row: the classic percent wording for plain percent coupons, the server's facts otherwise. */
export function quoteDiscountLabel(q: OrderQuote): string | undefined {
  if (!q.couponApplied) return undefined;
  if (q.discountPercent !== null && !isCapped(q)) return `Coupon Discount (${q.discountPercent}% on ${formatINR(q.afterCredit)})`;
  if (q.discountPercent !== null) return `Coupon Discount (${q.discountPercent}%, capped)`;
  return `Coupon Discount${q.couponCode ? ` (${q.couponCode})` : ''}`;
}

/** Badge text of the applied coupon (`NAME (10% off)` / `NAME (₹500 off)`), or `undefined` for the default wording. */
export function quoteBadgeLabel(q: OrderQuote, coupon: Coupon | null): string | undefined {
  if (!coupon || !q.couponApplied) return undefined;
  if (q.discountPercent !== null && !isCapped(q)) return undefined;
  return `${coupon.name} (${formatINR(q.discountAmount)} off)`;
}

/** Why the coupon in the box does not discount (the server's message), or `null` when it does / none is entered. */
export function quoteNotice(q: OrderQuote): string | null {
  if (!q.couponCode || q.couponApplied) return null;
  return q.couponMessage ?? 'This coupon cannot be applied.';
}

/** Percent of the referral reward the quote talks about (`referral_percent`, else the offer's), or `null` when unknown. */
export function quoteReferralPercent(q: OrderQuote | null | undefined): number | null {
  const p = q?.referralPercent ?? q?.referral?.percent ?? null;
  return p !== null && p > 0 ? p : null;
}

/** Label of the referral discount row (`Referral reward (10%)`). */
export function quoteReferralLabel(q: OrderQuote): string {
  const p = quoteReferralPercent(q);
  return p === null ? 'Referral reward' : `Referral reward (${p}%)`;
}
