/** DTOs for orders, payments, coupons and invoices (`src/api/billing.ts`). */
import type { DateString, RawRecord } from './common';

/** A discount coupon; `discountPercent` is a percentage. */
export interface Coupon {
  id: number | null;
  name: string;
  discountPercent: number;
}

/** Purchase kind the server prices: a new / changed plan, a renewal of the current plan, or extra staff on it. */
export type OrderMode = 'new' | 'renew' | 'upgrade';

/** Input of `createOrder`. `amount` is the grand total incl. GST (display value; the server recomputes the price). */
export interface CreateOrderInput {
  userId: string;
  orgId: string;
  planId: number;
  amount: number;
  /** Staff count; the EXTRA staff for `mode: 'upgrade'`. */
  staffLimit: number;
  couponCode?: string | null;
  /** Sent as `mode` so the server prices the same purchase kind the screen showed. Omitted by older callers. */
  mode?: OrderMode;
  /** Redeem one referral reward on this purchase (never together with a coupon). Sent as `apply_referral` only when true. */
  applyReferral?: boolean;
}

/** Input of `billingApi.quote` (`POST /orders/quote`). `staffLimit` is the EXTRA staff for `mode: 'upgrade'`. */
export interface QuoteOrderInput {
  userId: string;
  orgId: string;
  /** Used for `mode: 'new'`; the server prices renewals / upgrades on the organisation's current plan. */
  planId: number | null;
  staffLimit: number;
  couponCode?: string | null;
  mode?: OrderMode;
  /** Price the order with one referral reward (`apply_referral`); sent only when true. */
  applyReferral?: boolean;
}

/** What the server says about the organisation's referral rewards for THIS quote (`referral` block of the quote). */
export interface ReferralOffer {
  /** Rewards the organisation can still redeem (one per purchase). */
  availableCount: number;
  /** Whether a reward can be used on this plan + mode. */
  eligible: boolean;
  percent: number;
  /** Why it cannot be used (`eligible: false`), e.g. "Referral rewards are valid on Prime and Elite plans only". */
  message: string | null;
}

/**
 * The server's price breakdown (`data` of `POST /orders/quote`). Money is in rupees as numbers; this is what the order
 * will charge. A coupon the server cannot use is reported here (`couponApplied: false` + `couponMessage`), not as an error.
 */
export interface OrderQuote {
  mode: OrderMode;
  planId: number | null;
  planName: string;
  pricePerStaffMonth: number;
  chargedStaff: number;
  /** Months PAID for (plan months minus free months; the whole calendar months left for an upgrade). */
  chargedMonths: number;
  termMonths: number;
  /** Months of the term that are free in this purchase (0 for an upgrade or a plan without an offer). */
  freeMonths?: number;
  staffCharge: number;
  credit: number;
  afterCredit: number;
  couponCode: string | null;
  couponApplied: boolean;
  couponMessage: string | null;
  /** Percentage of a percent coupon; `null` for a flat coupon or no coupon. */
  discountPercent: number | null;
  discountAmount: number;
  subtotal: number;
  gstPercent: number;
  gst: number;
  grandTotal: number;
  amountPaise: number;
  currency: string;
  validFrom: DateString | null;
  validTill: DateString | null;
  resultingStaffLimit: number | null;
  /** False when the total is 0 (nothing to charge). */
  payable: boolean;
  /** A referral reward discounts this quote (`discountAmount` is then the referral discount and no coupon applies). */
  referralApplied: boolean;
  referralPercent: number | null;
  /** The server's reason when a requested reward could not be used. */
  referralMessage: string | null;
  /** `null` for servers that do not know referrals. */
  referral: ReferralOffer | null;
}

/** Everything the checkout sheet needs; maps 1:1 onto `openCheckout` options. */
export interface CheckoutOrder {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  orderName: string;
  isFirstPayment: boolean;
  prefill: { name: string; email: string; contact: string };
  notes: Record<string, string>;
}

/** Input of `verifyPayment` (values posted back by the checkout). */
export interface VerifyPaymentInput {
  userId: string;
  email: string;
  wantsGstInvoice?: boolean;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/** Result of a successful payment verification. */
export interface VerifiedPayment {
  message: string;
  /** Subscription end date set by the payment. */
  validTill: DateString | null;
  /** Plan id when the server reports it. */
  planId: number | null;
}

/** One invoice row (tolerant to the legacy field spellings). */
export interface Invoice {
  id: string;
  number: string;
  paymentDate: string | null;
  planName: string;
  staffCount: number;
  totalAmount: number;
  validTill: DateString | null;
  /** Signed, expiring link of the PDF (`download_url` of `/invoice/history`), when the server sends one. */
  downloadUrl?: string;
  raw: RawRecord;
}

/** Inputs identifying an invoice PDF. */
export interface InvoiceRef {
  userId: string;
  orgId: string;
  invoiceNumber: string;
  /** `Invoice.downloadUrl`: preferred over the plain link when present. */
  downloadUrl?: string;
}
