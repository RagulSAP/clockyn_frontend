/**
 * Checkout orchestration (order → payment sheet → verification) with injectable dependencies so it can be unit tested.
 *
 *   createOrder (throws on failure)  →  openCheckout  →  verifyPayment
 *
 * Outcomes are values, never thrown, after the order exists: a payment that was captured but could not be verified
 * returns `verify-failed` with the pending proof so the UI can offer "retry verification" (v1 only showed an alert).
 */
import type { CheckoutOptions, CheckoutResult } from '@/lib/platform/payment';
import type { CheckoutOrder, CreateOrderInput, OrderMode, VerifiedPayment, VerifyPaymentInput } from '@/types/api/billing';

export interface CheckoutDeps {
  createOrder: (input: CreateOrderInput) => Promise<CheckoutOrder>;
  openCheckout: (options: CheckoutOptions) => Promise<CheckoutResult>;
  verifyPayment: (input: VerifyPaymentInput) => Promise<VerifiedPayment>;
}

export interface CheckoutContext {
  userId: string;
  orgId: string;
  email: string;
  userName: string;
  orgName: string;
  planId: number;
  planName: string;
  /** Grand total in INR (GST inclusive). */
  amount: number;
  /** Staff charged (extra staff for a capacity upgrade). */
  staffLimit: number;
  couponCode: string | null;
  /** Purchase kind (`new` | `renew` | `upgrade`), sent with the order. */
  mode?: OrderMode;
}

export interface PendingVerification {
  input: VerifyPaymentInput;
}

export type CheckoutOutcome =
  | { kind: 'success'; payment: VerifiedPayment }
  | { kind: 'dismissed' }
  | { kind: 'failed'; message: string }
  | { kind: 'verify-failed'; message: string; pending: PendingVerification };

/** Options of the payment sheet for an order. The merchant name falls back to the organisation, then the app. */
export function buildCheckoutOptions(order: CheckoutOrder, ctx: CheckoutContext): CheckoutOptions {
  return {
    key: order.keyId,
    orderId: order.orderId,
    // The server amount is in rupees (converted to paise by the platform layer); fall back to what we asked for.
    amount: order.amount > 0 ? order.amount : ctx.amount,
    currency: order.currency || 'INR',
    name: order.notes.org_name || ctx.orgName || 'Clockyn',
    description: order.orderName || `${ctx.planName} Plan Subscription`,
    prefill: {
      name: order.prefill.name || ctx.userName,
      email: order.prefill.email || ctx.email,
      contact: order.prefill.contact,
    },
    notes: order.notes,
  };
}

function verifyMessage(e: unknown): string {
  const m = e instanceof Error ? e.message.trim() : '';
  return m !== '' ? m : 'Payment could not be verified';
}

/** Verifies a payment; on failure keeps the proof for a retry. */
export async function verifyPending(deps: CheckoutDeps, pending: PendingVerification): Promise<CheckoutOutcome> {
  try {
    return { kind: 'success', payment: await deps.verifyPayment(pending.input) };
  } catch (e) {
    return { kind: 'verify-failed', message: verifyMessage(e), pending };
  }
}

/** Runs one purchase. Throws only when the ORDER cannot be created (nothing was charged). */
export async function runCheckout(deps: CheckoutDeps, ctx: CheckoutContext, onOrderCreated?: () => void): Promise<CheckoutOutcome> {
  const order = await deps.createOrder({
    userId: ctx.userId,
    orgId: ctx.orgId,
    planId: ctx.planId,
    amount: ctx.amount,
    staffLimit: ctx.staffLimit,
    couponCode: ctx.couponCode,
    mode: ctx.mode,
  });
  onOrderCreated?.();

  const result = await deps.openCheckout(buildCheckoutOptions(order, ctx));
  if (result.status === 'dismissed') return { kind: 'dismissed' };
  if (result.status === 'failed') return { kind: 'failed', message: result.error?.trim() || 'Payment failed' };

  return verifyPending(deps, {
    input: {
      userId: ctx.userId,
      email: ctx.email,
      wantsGstInvoice: false,
      razorpayOrderId: result.orderId ?? order.orderId,
      razorpayPaymentId: result.paymentId ?? '',
      razorpaySignature: result.signature ?? '',
    },
  });
}
