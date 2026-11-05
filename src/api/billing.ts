/**
 * Billing API: Razorpay orders (`/orders/*`), payment verification (`/payments/verify`), coupons
 * (`/plans/coupon/*`) and invoices (`/invoice/*`).
 *
 * Decisions
 *  - The server prices every order (`POST /orders/quote` shows the numbers, `/orders/create` recomputes them); the local
 *    pricing in the billing feature is only the fallback for servers without the quote route (`quote` answers `null`).
 *    `createOrder` posts the grand total the screen displayed.
 *  - Invoice PDFs are binary: `invoiceDownloadUrl` / `invoiceFileName` feed `@/lib/platform/files` `downloadAndOpen`.
 *  - `getFirstCoupon` resolves `null` when no welcome coupon exists (not an error); `validateCoupon` throws the
 *    server message (`Invalid or expired coupon`) for unknown coupons.
 */
import { api } from '@/lib/api/client';
import type {
  CheckoutOrder,
  Coupon,
  CreateOrderInput,
  Invoice,
  InvoiceRef,
  OrderQuote,
  QuoteOrderInput,
  VerifiedPayment,
  VerifyPaymentInput,
} from '@/types/api/billing';
import { bool, dateOnly, isRecord, listOf, num, objectOf, optNum, optStr, pick, rec, str } from './mappers/common';
import { apiUrl, ensureSuccess, requireId, serverMessage, successBody } from './sharedHelpers';

/** Maps a coupon payload (`{coupon_id?, coupon_name, discount}`); `discount` is a percentage. */
export function mapCoupon(input: unknown): Coupon {
  const r = rec(input);
  return { id: optNum(r.coupon_id) ?? null, name: str(r.coupon_name), discountPercent: num(r.discount) };
}

/** Maps a string-valued object (Razorpay `notes`) dropping non-primitive values. */
function mapNotes(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec(input))) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
  }
  return out;
}

/**
 * Maps the `orders/create` response. The checkout block is preferred; top-level `key_id` / `amount` /
 * `currency` / `order_id` are the fallback (v1 behaviour).
 */
export function mapCheckoutOrder(input: unknown): CheckoutOrder {
  const root = rec(input);
  const checkout = isRecord(root.checkout) ? root.checkout : {};
  const prefill = rec(checkout.prefill ?? root.customer);
  const read = (key: string): unknown => pick(checkout, key) ?? pick(root, key);
  return {
    orderId: str(read('order_id')),
    keyId: str(read('key_id')),
    amount: num(read('amount')),
    currency: str(read('currency'), 'INR') || 'INR',
    orderName: str(root.order_name),
    isFirstPayment: bool(root.is_first_payment),
    prefill: { name: str(prefill.name), email: str(prefill.email), contact: str(prefill.contact) },
    notes: mapNotes(checkout.notes),
  };
}

/** Maps an invoice row, tolerating the legacy key spellings the screens accepted. */
export function parseInvoiceRecord(input: unknown): Invoice {
  const r = rec(input);
  const number = str(pick(r, 'invoice_number', 'invoice_no', 'invoice_id', 'id'));
  return {
    id: str(pick(r, 'invoice_id', 'invoice_number', 'invoice_no', 'id')),
    number,
    paymentDate: optStr(pick(r, 'payment_date', 'created_at', 'payment_at')) ?? null,
    planName: str(r.plan_name),
    staffCount: num(pick(r, 'staff_count', 'staff_limit')),
    totalAmount: num(pick(r, 'total_amount', 'amount')),
    validTill: dateOnly(pick(r, 'valid_till', 'expiry_date', 'plan_valid_till')) ?? null,
    ...(typeof r.download_url === 'string' && r.download_url.startsWith('/') ? { downloadUrl: r.download_url } : {}),
    raw: r,
  };
}

/** `GET /orders/check_first_payment?user_id` — true when the user has never paid (welcome coupon applies). */
export async function checkFirstPayment(userId: string): Promise<boolean> {
  const body = await api.get<unknown>('/orders/check_first_payment', { user_id: requireId(userId, 'userId') });
  return bool(rec(body).is_first_payment);
}

/** `GET /plans/coupon/first` — the welcome coupon, or `null` when none is active. */
export async function getFirstCoupon(): Promise<Coupon | null> {
  const body = await api.get<unknown>('/plans/coupon/first');
  const r = rec(body);
  if (r.success === false) return null;
  const coupon = mapCoupon(objectOf(body));
  return coupon.name === '' ? null : coupon;
}

/** `GET /plans/coupon/validate?coupon_name` — validates a coupon code; throws the server message when invalid. */
export async function validateCoupon(couponName: string): Promise<Coupon> {
  const name = couponName.trim();
  if (name === '') throw new Error('Enter a coupon code');
  const body = await api.get<unknown>('/plans/coupon/validate', { coupon_name: name });
  ensureSuccess(body, 'Invalid or expired coupon');
  const coupon = mapCoupon(objectOf(body));
  return { ...coupon, name: coupon.name || name };
}

/** `POST /orders/create` — creates the payment order for a plan purchase / renewal; returns what the checkout needs. */
export async function createOrder(input: CreateOrderInput): Promise<CheckoutOrder> {
  const body = await api.post<unknown>('/orders/create', {
    user_id: input.userId,
    org_id: input.orgId,
    plan_id: input.planId,
    amount: input.amount,
    staff_limit: input.staffLimit,
    coupon_code: input.couponCode && input.couponCode.trim() !== '' ? input.couponCode.trim() : null,
    mode: input.mode,
  });
  ensureSuccess(body, 'Failed to create order');
  const order = mapCheckoutOrder(body);
  if (order.orderId === '' || order.keyId === '') throw new Error('Payment could not be started. Please try again.');
  return order;
}

/**
 * Maps the `data` block of `POST /orders/quote`; `null` when the payload has no usable total (so a caller keeps its
 * local numbers). Accepts the bare object as well as `{success, data}`.
 */
export function mapOrderQuote(input: unknown): OrderQuote | null {
  const r = objectOf(input);
  const grandTotal = optNum(r.grand_total);
  if (grandTotal === undefined) return null;
  const mode = r.mode === 'renew' || r.mode === 'upgrade' ? r.mode : 'new';
  return {
    mode,
    planId: optNum(r.plan_id) ?? null,
    planName: str(r.plan_name),
    pricePerStaffMonth: num(r.price_per_staff_month),
    chargedStaff: num(r.charged_staff),
    chargedMonths: num(r.charged_months),
    termMonths: num(r.term_months),
    staffCharge: num(r.staff_charge),
    credit: num(r.credit),
    afterCredit: num(r.after_credit),
    couponCode: optStr(r.coupon_code) ?? null,
    couponApplied: bool(r.coupon_applied),
    couponMessage: optStr(r.coupon_message) ?? null,
    discountPercent: optNum(r.discount_percent) ?? null,
    discountAmount: num(r.discount_amount),
    subtotal: num(r.subtotal),
    gstPercent: num(r.gst_percent, 18),
    gst: num(r.gst),
    grandTotal,
    amountPaise: optNum(r.amount_paise) ?? Math.round(grandTotal * 100),
    currency: str(r.currency, 'INR') || 'INR',
    validFrom: dateOnly(r.valid_from) ?? null,
    validTill: dateOnly(r.valid_till) ?? null,
    resultingStaffLimit: optNum(r.resulting_staff_limit) ?? null,
    payable: r.payable === undefined ? grandTotal > 0 : bool(r.payable),
  };
}

/**
 * `POST /orders/quote` — the price breakdown the server will charge (plan, staff, coupon, mode). NEVER throws: a server
 * without the route (404 / 405), a network failure, a timeout, an abort or any other error answers `null` and the
 * caller falls back to its local pricing. A coupon the server cannot use comes back INSIDE the quote
 * (`couponApplied: false`, `couponMessage`).
 */
export async function quote(input: QuoteOrderInput, opts: { signal?: AbortSignal } = {}): Promise<OrderQuote | null> {
  try {
    const body = await api.post<unknown>(
      '/orders/quote',
      {
        user_id: input.userId,
        org_id: input.orgId,
        plan_id: input.planId,
        staff_limit: input.staffLimit,
        coupon_code: input.couponCode && input.couponCode.trim() !== '' ? input.couponCode.trim() : null,
        mode: input.mode,
      },
      opts.signal ? { signal: opts.signal } : {},
    );
    if (isRecord(body) && body.success === false) return null;
    return mapOrderQuote(body);
  } catch {
    return null;
  }
}

/** `POST /payments/verify` — verifies the payment signature and activates the plan. */
export async function verifyPayment(input: VerifyPaymentInput): Promise<VerifiedPayment> {
  const body = await api.post<unknown>('/payments/verify', {
    user_id: input.userId,
    email: input.email,
    wants_gst_invoice: input.wantsGstInvoice ?? false,
    razorpay_order_id: input.razorpayOrderId,
    razorpay_payment_id: input.razorpayPaymentId,
    razorpay_signature: input.razorpaySignature,
  });
  const r = successBody(body, 'Payment verification failed');
  return {
    message: serverMessage(r, 'Payment verified successfully'),
    validTill: dateOnly(r.valid_till) ?? null,
    planId: optNum(r.plan_id) ?? null,
  };
}

/** `GET /invoice/history?user_id&org_id` — payment invoices of the organisation (latest first). */
export async function listInvoices(userId: string, orgId: string): Promise<Invoice[]> {
  const body = await api.get<unknown>('/invoice/history', { user_id: requireId(userId, 'userId'), org_id: requireId(orgId, 'orgId') });
  ensureSuccess(body, 'Failed to load invoices');
  return listOf(body).map(parseInvoiceRecord);
}

/**
 * `GET /invoice/download?user_id&org_id&invoice_number` — absolute URL of the invoice PDF. Uses the signed link the
 * server put in the history row (`download_url`) when there is one, else builds the plain link.
 */
export function invoiceDownloadUrl(ref: InvoiceRef): string {
  if (ref.downloadUrl && ref.downloadUrl.startsWith('/')) return apiUrl(ref.downloadUrl);
  return apiUrl('/invoice/download', { user_id: ref.userId, org_id: ref.orgId, invoice_number: ref.invoiceNumber });
}

/** Local file name for a downloaded invoice: `Invoice_{number}.pdf` with unsafe characters replaced. */
export function invoiceFileName(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `Invoice_${safe || 'download'}.pdf`;
}
