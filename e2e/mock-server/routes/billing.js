'use strict';
/** Plans, subscription, orders, payment verification, coupons, invoices (PDF) and support tickets. */
const { fail, bizFail, Raw } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');
const { makePdf } = require('../lib/pdf');

const ok = (extra) => ({ success: true, ...extra });

// ── pricing (same arithmetic as src/features/billing/utils/pricing.ts + quote.ts) ─────────────────────────────────
const GST_RATE = 0.18;
const MIN_STAFF = 10;
const CREDIT_BASELINE_STAFF = 10;
const RENEW_MONTHS = 12;

function addMonths(dateStr, n) {
  const p = T.parseDate(dateStr);
  const total = p.year * 12 + (p.month - 1) + Math.trunc(n);
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12 + 1;
  return `${year}-${T.pad(month)}-${T.pad(Math.min(p.day, T.daysInMonth(year, month)))}`;
}

/**
 * `POST /orders/quote` body -> the quote the real server returns in `data` (core_functions/pricing.py `to_dict`).
 * Money fields are numbers in rupees; `amount_paise` is an integer. `mode` is optional (`new` | `renew` | `upgrade`);
 * without it the mock reads `new` (the app's own default). `staff_limit` is the staff count, or the EXTRA staff for `upgrade`.
 */
function computeQuote(s, b) {
  const today = T.today();
  const mode = b.mode === undefined || b.mode === null || b.mode === '' ? 'new' : String(b.mode);
  if (!['new', 'renew', 'upgrade'].includes(mode)) fail(400, 'mode must be one of new, upgrade, renew');
  const sub = D.subscriptionData(s);
  const hasCurrentPlan = !!sub.plan_name;
  const expired = !!sub.end_date && sub.end_date < today;
  const currentStaff = Math.max(MIN_STAFF, Number.isFinite(Number(sub.staff_limit)) && Number(sub.staff_limit) > 0 ? Math.trunc(Number(sub.staff_limit)) : MIN_STAFF);

  let plan;
  if (mode === 'new') {
    if (b.plan_id === undefined || b.plan_id === null) fail(400, 'plan_id is required');
    plan = D.catalogue(s).find((p) => p.plan_id === Number(b.plan_id));
    if (!plan) fail(404, 'Plan not found');
  } else {
    plan = sub.plan_id === null ? null : D.catalogue(s).find((p) => p.plan_id === sub.plan_id);
    if (!plan) fail(400, 'No current plan to renew or upgrade');
  }

  const staff = Math.trunc(Number(b.staff_limit));
  if (!Number.isFinite(staff) || staff <= 0) fail(400, 'Staff count must be a whole number');
  const minStaff = mode === 'new' && hasCurrentPlan ? currentStaff : MIN_STAFF;
  if (mode !== 'upgrade' && staff < minStaff) fail(400, `Staff count must be at least ${minStaff}`);

  const termMonths = mode === 'renew' ? RENEW_MONTHS : plan.plan_month;
  const paidActive = !!sub.plan_id && !sub.is_free_trial && !expired;
  const renewStart = paidActive && sub.end_date ? sub.end_date : today;
  let chargedMonths = termMonths;
  if (mode === 'upgrade' && sub.end_date) {
    const e = T.parseDate(sub.end_date);
    const t = T.parseDate(today);
    chargedMonths = Math.max(1, (e.year - t.year) * 12 + (e.month - t.month));
  }
  const credit = mode === 'new' && hasCurrentPlan && !expired ? CREDIT_BASELINE_STAFF * (sub.plan_amount || 0) * (sub.plan_month || 1) : 0;

  let couponPercent = null;
  let couponApplied = false;
  let couponMessage = null;
  const staffCharge = staff * plan.plan_amount * chargedMonths;
  const afterCredit = Math.max(0, staffCharge - credit);
  let discountAmount = 0;
  const code = b.coupon_code && String(b.coupon_code).trim() !== '' ? String(b.coupon_code).trim() : null;
  if (code && mode !== 'upgrade') {
    if (code.toUpperCase() === s.coupon.coupon_name) {
      // Same rules as core_functions/pricing.py `Coupon.discount_for`: percent (default) or flat, optional cap and minimum amount.
      const c = s.coupon;
      const flat = c.discount_type === 'flat';
      if (c.min_amount !== undefined && c.min_amount !== null && afterCredit < c.min_amount) {
        couponMessage = `This coupon needs a minimum order of Rs ${Math.round(c.min_amount).toLocaleString('en-IN')}`;
      } else {
        let d = flat ? Math.round(Number(c.flat_amount) || 0) : Math.round((afterCredit * c.discount) / 100);
        if (c.max_discount !== undefined && c.max_discount !== null) d = Math.min(d, Math.round(c.max_discount));
        discountAmount = Math.max(0, Math.min(d, afterCredit));
        couponApplied = true;
        couponPercent = flat ? null : c.discount;
      }
    } else {
      couponMessage = 'Invalid or expired coupon';
    }
  } else if (code) {
    couponMessage = 'Coupons do not apply to adding staff';
  }

  const subtotal = Math.max(0, afterCredit - discountAmount);
  const gst = Math.round(subtotal * GST_RATE);
  const grandTotal = subtotal + gst;
  const validFrom = mode === 'renew' ? renewStart : today;
  const validTill = mode === 'upgrade' && sub.end_date ? sub.end_date : addMonths(mode === 'renew' ? renewStart : today, termMonths);
  return {
    mode,
    plan_id: plan.plan_id,
    plan_name: plan.plan_name,
    price_per_staff_month: plan.plan_amount,
    charged_staff: staff,
    charged_months: chargedMonths,
    term_months: termMonths,
    staff_charge: staffCharge,
    credit,
    after_credit: afterCredit,
    coupon_code: couponApplied ? s.coupon.coupon_name : code,
    coupon_applied: couponApplied,
    coupon_message: couponMessage,
    discount_percent: couponPercent,
    discount_amount: discountAmount,
    subtotal,
    gst_percent: GST_RATE * 100,
    gst,
    grand_total: grandTotal,
    amount_paise: Math.round(grandTotal * 100),
    currency: 'INR',
    valid_from: validFrom,
    valid_till: validTill,
    resulting_staff_limit: mode === 'upgrade' ? currentStaff + staff : staff,
    min_staff: minStaff,
    has_current_plan: hasCurrentPlan,
    is_plan_expired: expired,
    payable: grandTotal > 0,
  };
}

function register(r) {
  r.get('/plans/plan-status/:org', (c) => {
    const p = D.planStatus(c.s);
    return { plan_id: p.plan_id, is_free_trial: p.is_free_trial, is_expired: p.is_expired };
  });

  r.get('/plans/subscription/:org', (c) => ok({ data: D.subscriptionData(c.s) }));
  r.get('/plans/get_plans', (c) => ok({ data: D.catalogue(c.s) }));

  r.get('/plans/coupon/first', (c) => (c.s.flags.noCoupon ? bizFail('No coupon available') : ok({ ...c.s.coupon })));
  r.get('/plans/coupon/validate', (c) => {
    if (String(c.q.coupon_name || '').trim().toUpperCase() !== c.s.coupon.coupon_name) return bizFail('Invalid or expired coupon');
    return ok({ ...c.s.coupon });
  });

  r.get('/orders/check_first_payment', (c) => ({ is_first_payment: c.s.invoices.filter((i) => i.user_id === c.q.user_id).length === 0 }));

  r.post('/orders/quote', (c) => ok({ data: computeQuote(c.s, c.b) }));

  r.post('/orders/create', (c) => {
    const plan = D.catalogue(c.s).find((p) => p.plan_id === Number(c.b.plan_id));
    if (!plan) return bizFail('Plan not found');
    const amount = Number(c.b.amount);
    if (!Number.isFinite(amount) || amount <= 0) return bizFail('Invalid amount');
    if (c.b.mode !== undefined && c.b.mode !== null && !['new', 'renew', 'upgrade'].includes(c.b.mode)) fail(400, 'mode must be one of new, upgrade, renew');
    const u = D.user(c.s, c.b.user_id) || {};
    c.s.seq.order += 1;
    const orderId = `order_mock_${c.s.seq.order}`;
    const order = { order_id: orderId, plan_id: plan.plan_id, amount, staff_limit: Number(c.b.staff_limit) || c.s.subscription.staff_limit, user_id: c.b.user_id, org_id: c.b.org_id, coupon: c.b.coupon_code, mode: c.b.mode || null };
    (c.s.orders = c.s.orders || []).push(order);
    // Like the real server: `amount` is in RUPEES (the app converts to paise for the payment sheet).
    const checkout = { order_id: orderId, key_id: 'rzp_test_mockkey', amount, currency: 'INR', prefill: { name: u.name || '', email: u.email || '', contact: u.mobile_number || '' }, notes: { org_id: String(c.b.org_id || ''), plan_id: String(plan.plan_id) } };
    return ok({ order_id: orderId, key_id: checkout.key_id, amount: checkout.amount, currency: 'INR', order_name: `${plan.plan_name} plan`, is_first_payment: c.s.invoices.length === 0, checkout });
  });

  r.post('/payments/verify', (c) => {
    const order = (c.s.orders || []).find((o) => o.order_id === c.b.razorpay_order_id);
    if (!order) return bizFail('Order not found');
    if (!c.b.razorpay_payment_id || !c.b.razorpay_signature || c.b.razorpay_signature === 'invalid') fail(400, 'Payment verification failed');
    const plan = D.catalogue(c.s).find((p) => p.plan_id === order.plan_id);
    const validTill = T.addDays(T.today(), 30 * plan.plan_month);
    c.s.subscription = { plan_id: plan.plan_id, start_date: T.today(), end_date: validTill, staff_limit: order.staff_limit, status: 'ACTIVE' };
    c.s.flags.plan = plan.plan_id === 1 ? 'core' : plan.plan_id === 2 ? 'prime' : 'elite';
    c.s.seq.invoice += 1;
    c.s.invoices.unshift({ invoice_number: `INV-2026-${String(1000 + c.s.seq.invoice)}`, payment_date: T.isoNow(), plan_name: plan.plan_name, staff_count: order.staff_limit, total_amount: order.amount, valid_till: validTill, user_id: order.user_id, org_id: order.org_id });
    return ok({ message: 'Payment verified successfully', valid_till: validTill, plan_id: plan.plan_id });
  });

  r.get('/invoice/history', (c) => ok({ data: c.s.invoices.filter((i) => i.org_id === D.resolveOrg(c.s, c.q.org_id)) }));
  r.get('/invoice/download', (c) => {
    const inv = c.s.invoices.find((i) => i.invoice_number === c.q.invoice_number);
    if (!inv) fail(404, 'Invoice not found');
    return new Raw(makePdf(`Invoice ${inv.invoice_number}`, [`Plan: ${inv.plan_name}`, `Staff: ${inv.staff_count}`, `Total: INR ${inv.total_amount}`]), 'application/pdf', { 'Content-Disposition': `attachment; filename="Invoice_${inv.invoice_number}.pdf"` });
  });

  // ── support ────────────────────────────────────────────────────────────────────────────────────
  r.get('/support/subjects', (c) => c.s.subjects);
  r.get('/support/requests/:org', (c) =>
    c.s.tickets.filter((t) => t.org_id === D.resolveOrg(c.s, c.p.org)).map((t) => ({ id: t.id, sub_id: t.sub_id, sub_name: t.sub_name, client_msg: t.client_msg, photo_url: D.abs(c.origin, t.photo_url), status: t.status, created_at: t.created_at, replies: t.replies })),
  );
  r.post('/support/submit', (c) => {
    const subject = c.s.subjects.find((x) => x.sub_name === c.b.subject);
    if (!subject) return bizFail('Invalid subject');
    if (!String(c.b.message || '').trim()) return bizFail('Message is required');
    c.s.seq.ticket += 1;
    const photo = c.files.find((f) => f.field === 'photo');
    c.s.tickets.unshift({ id: `tkt-${c.s.seq.ticket}`, org_id: D.resolveOrg(c.s, c.b.org_id), user_id: c.b.user_id, sub_id: subject.sub_id, sub_name: subject.sub_name, client_msg: c.b.message, photo_url: photo ? `/files/support/${c.s.seq.ticket}.png` : null, status: 'open', created_at: T.isoNow(), replies: [] });
    return ok({ message: 'Your request has been submitted' });
  });
  r.get('/support/videos', (c) => c.s.videos.filter((v) => v.status === 1).map((v) => ({ id: v.id, name: v.video_name, url: `${c.origin}/guide/${v.path}?sig=mock` })));
  r.post('/support/videos/:id/view', (c) => {
    const v = c.s.videos.find((x) => String(x.id) === c.p.id && x.status === 1);
    if (!v) fail(404, 'Video not found');
    c.s.videoViews.push({ video_id: v.id, video_name: v.video_name, user_id: c.b.user_id, org_id: c.b.org_id, viewed_at: T.isoNow() });
    return ok({});
  });
  r.post('/support/:id/reply', (c) => {
    const t = c.s.tickets.find((x) => x.id === c.p.id);
    if (!t) return bizFail('Ticket not found');
    if (!String(c.b.reply_text || '').trim()) return bizFail('Reply cannot be empty');
    t.replies.push({ reply_text: String(c.b.reply_text).trim(), author_name: c.b.author_name || '', is_admin: !!c.b.is_admin, created_at: T.isoNow() });
    return ok({ message: 'Reply added' });
  });
}

module.exports = { register };
