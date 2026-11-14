import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import {
  checkFirstPayment,
  createOrder,
  getFirstCoupon,
  invoiceDownloadUrl,
  invoiceFileName,
  listInvoices,
  mapCheckoutOrder,
  mapOrderQuote,
  parseInvoiceRecord,
  quote,
  validateCoupon,
  verifyPayment,
} from '../billing';
import { getOrgPlanStatus, getStaffLimit, getSubscription, listPlans, mapOrgPlanStatus, mapSubscription } from '../plans';
import { formatOvertimeMinutes, getOvertimeReport, loadMonthlyAttendanceBatched, resolveAttendanceReport } from '../reports';
import { getMonthlyAttendance } from '../home';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());
jest.mock('../home', () => ({ getMonthlyAttendance: jest.fn(), getStaffProfile: jest.fn() }));

const mocked = api as unknown as Record<'get' | 'post', jest.Mock>;
const monthly = getMonthlyAttendance as jest.Mock;

beforeEach(() => {
  mocked.get.mockReset();
  mocked.post.mockReset();
  monthly.mockReset();
});

describe('reports: attendance PDF resolution', () => {
  it('admin all staff', () => {
    const r = resolveAttendanceReport({ scope: 'admin', orgId: 'org1', year: 2026, month: 10, staff: 'all' });
    expect(r.url).toMatch(/\/api\/reports\/monthly-attendance-all\/org1\/2026-10$/);
    expect(r.filename).toBe('attendance_all_2026-10.pdf');
    expect(r.mimeType).toBe('application/pdf');
  });

  it('admin single staff uses the employee code in the file name', () => {
    const r = resolveAttendanceReport({ scope: 'admin', orgId: 'org1', year: 2026, month: 3, staff: { userId: 'u1', empId: 'E 01/A' } });
    expect(r.url).toMatch(/\/api\/reports\/monthly-attendance\/u1\/2026-03$/);
    expect(r.filename).toBe('attendance_E_01_A_2026-03.pdf');
  });

  it('manager variants and self selection', () => {
    expect(resolveAttendanceReport({ scope: 'manager', managerId: 'm1', year: 2026, month: 10, staff: 'all' }).url).toMatch(
      /\/api\/reports\/manager\/m1\/monthly-attendance-all\/2026-10$/,
    );
    expect(resolveAttendanceReport({ scope: 'manager', managerId: 'm1', year: 2026, month: 10, staff: { userId: 'u9' } }).url).toMatch(
      /\/api\/reports\/manager\/m1\/monthly-attendance\/u9\/2026-10$/,
    );
    expect(resolveAttendanceReport({ scope: 'manager', managerId: 'm1', year: 2026, month: 10, staff: { userId: 'm1', isSelf: true } }).url).toMatch(
      /\/api\/reports\/monthly-attendance\/m1\/2026-10$/,
    );
  });

  it('requires ids', () => {
    expect(() => resolveAttendanceReport({ scope: 'admin', orgId: ' ', year: 2026, month: 1, staff: 'all' })).toThrow('orgId is required');
  });
});

describe('reports: overtime', () => {
  it('formatOvertimeMinutes matches the v1 format', () => {
    expect(formatOvertimeMinutes(0)).toBe('—');
    expect(formatOvertimeMinutes(undefined)).toBe('—');
    expect(formatOvertimeMinutes(45)).toBe('45m');
    expect(formatOvertimeMinutes(120)).toBe('2h');
    expect(formatOvertimeMinutes(125)).toBe('2h 5m');
  });

  it('getOvertimeReport maps rows and checks success (v1 ignored it)', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [{ user_id: 'u1', ot_days: 2, ot_minutes: '135', ot_amount: 450.5 }] });
    expect(await getOvertimeReport('org', 10, 2026)).toEqual([{ userId: 'u1', otDays: 2, otMinutes: 135, otAmount: 450.5 }]);
    expect(mocked.get).toHaveBeenCalledWith('/api/incentive/overtime-report/org', { month: 10, year: 2026 });
    mocked.get.mockResolvedValue({ success: false, message: 'No data' });
    await expect(getOvertimeReport('org', 10, 2026)).rejects.toThrow('No data');
  });
});

describe('reports: batched monthly attendance', () => {
  it('loads in batches, reports progress and collects failures', async () => {
    monthly.mockImplementation(async (id: string) => {
      if (id === 'bad') throw new ApiError({ status: 500, message: 'Server exploded', detail: 'Server exploded' });
      return { month: 10, year: 2026, totalDays: 31, presentDays: 1, absentDays: 30, lateDays: 0, days: [] };
    });
    const progress: [number, number][] = [];
    const res = await loadMonthlyAttendanceBatched(['a', 'b', 'bad', 'd', 'e'], 'org', 10, 2026, {
      batchSize: 2,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect([...res.byUser.keys()]).toEqual(['a', 'b', 'd', 'e']);
    expect(res.failed).toEqual([{ userId: 'bad', message: 'Server exploded' }]);
    expect(progress).toEqual([
      [2, 5],
      [4, 5],
      [5, 5],
    ]);
    expect(monthly).toHaveBeenCalledWith('a', 'org', 10, 2026);
  });
});

describe('plans', () => {
  it('getOrgPlanStatus keeps the snake_case shape', async () => {
    mocked.get.mockResolvedValue({ plan_id: '2', is_free_trial: false, is_expired: 0 });
    expect(await getOrgPlanStatus('org')).toEqual({ plan_id: 2, is_free_trial: false, is_expired: false });
    expect(mocked.get).toHaveBeenCalledWith('/plans/plan-status/org');
    mocked.get.mockResolvedValue({ plan_id: null, is_free_trial: true, is_expired: false });
    expect(await getOrgPlanStatus('org')).toEqual({ plan_id: null, is_free_trial: true, is_expired: false });
    expect(mapOrgPlanStatus({})).toEqual({ plan_id: null, is_free_trial: false, is_expired: false });
  });

  it('mapSubscription reads data and top-level trial fields', () => {
    const s = mapSubscription({
      success: true,
      is_free_trial: true,
      free_trial_end: '2026-11-01',
      data: { plan_id: 1, plan_name: 'Core', plan_amount: '999', plan_month: 12, start_date: '2026-01-01', end_date: '2026-12-31', staff_limit: 25, status: 'ACTIVE', is_expired: false },
    });
    expect(s).toMatchObject({ planId: 1, planAmount: 999, planMonths: 12, staffLimit: 25, isFreeTrial: true, freeTrialEnd: '2026-11-01', status: 'ACTIVE', endDate: '2026-12-31' });
  });

  it('mapSubscription defaults the staff limit and handles the trial placeholder', () => {
    const s = mapSubscription({ success: true, data: { is_free_trial: true, free_trial_end: '2026-11-01', end_date: '2026-11-01', staff_limit: null, status: 'FREE_TRIAL', plan_name: 'Free Trial' } });
    expect(s).toMatchObject({ planId: null, staffLimit: 10, isFreeTrial: true, status: 'FREE_TRIAL', endDate: '2026-11-01' });
  });

  it('getSubscription / getStaffLimit / listPlans', async () => {
    mocked.get.mockResolvedValue({ success: true, data: { plan_id: 3, staff_limit: 40 } });
    expect((await getSubscription('org')).planId).toBe(3);
    expect(await getStaffLimit('org')).toBe(40);
    mocked.get.mockResolvedValue({ success: true, data: [{ plan_id: 1, plan_name: 'Core', plan_amount: 499, plan_month: 1 }] });
    // an older server sends no offer fields: no free months, no wording
    expect(await listPlans()).toEqual([{ id: 1, name: 'Core', amount: 499, months: 1, freeMonths: 0, offerText: null }]);
  });

  it('listPlans maps the free months and the offer wording of a duration tier', async () => {
    mocked.get.mockResolvedValue({
      success: true,
      data: [
        { plan_id: 4, plan_name: 'Core', plan_amount: '49.00', plan_month: 6, plan_free_months: 1, plan_offer_text: '  Pay 5, get 1 free ' },
        { plan_id: 5, plan_name: 'Core', plan_amount: 49, plan_month: 12, plan_free_months: '2', plan_offer_text: '   ' },
        { plan_id: 6, plan_name: 'Core', plan_amount: 49, plan_month: 3, plan_free_months: -1, plan_offer_text: null },
      ],
    });
    expect(await listPlans()).toEqual([
      { id: 4, name: 'Core', amount: 49, months: 6, freeMonths: 1, offerText: 'Pay 5, get 1 free' },
      { id: 5, name: 'Core', amount: 49, months: 12, freeMonths: 2, offerText: null },
      { id: 6, name: 'Core', amount: 49, months: 3, freeMonths: 0, offerText: null },
    ]);
  });

  it('mapSubscription carries the free months of the running plan (null when the server has none)', () => {
    expect(mapSubscription({ data: { plan_id: 5, plan_name: 'Core', plan_month: 12, plan_free_months: 2 } }).planFreeMonths).toBe(2);
    expect(mapSubscription({ data: { plan_id: 1, plan_name: 'Core', plan_month: 1 } }).planFreeMonths).toBeNull();
  });
});

describe('billing', () => {
  it('mapCheckoutOrder prefers the checkout block and falls back to top level', () => {
    const full = mapCheckoutOrder({
      success: true,
      is_first_payment: true,
      order_name: 'Core plan',
      checkout: { order_id: 'order_1', key_id: 'key_1', amount: 1180, currency: 'INR', prefill: { name: 'A', email: 'a@x.in', contact: '999' }, notes: { org_name: 'Org', staff_limit: 10 } },
    });
    expect(full).toEqual({
      orderId: 'order_1',
      keyId: 'key_1',
      amount: 1180,
      currency: 'INR',
      orderName: 'Core plan',
      isFirstPayment: true,
      prefill: { name: 'A', email: 'a@x.in', contact: '999' },
      notes: { org_name: 'Org', staff_limit: '10' },
    });
    const flat = mapCheckoutOrder({ order_id: 'order_2', key_id: 'key_2', amount: 100, currency: 'INR', customer: { name: 'B', email: 'b@x.in', contact: '888' } });
    expect(flat).toMatchObject({ orderId: 'order_2', keyId: 'key_2', amount: 100, prefill: { name: 'B', contact: '888' } });
  });

  it('createOrder posts the v1 body and validates the response', async () => {
    mocked.post.mockResolvedValue({ success: true, order_id: 'o1', key_id: 'k1', amount: 590, currency: 'INR' });
    const order = await createOrder({ userId: 'u', orgId: 'org', planId: 1, amount: 590, staffLimit: 10, couponCode: ' ' });
    expect(mocked.post).toHaveBeenCalledWith('/orders/create', { user_id: 'u', org_id: 'org', plan_id: 1, amount: 590, staff_limit: 10, coupon_code: null });
    expect(order.orderId).toBe('o1');
    await createOrder({ userId: 'u', orgId: 'org', planId: 1, amount: 590, staffLimit: 10, couponCode: ' WELCOME ' });
    expect(mocked.post).toHaveBeenLastCalledWith('/orders/create', expect.objectContaining({ coupon_code: 'WELCOME' }));
    // the purchase kind is sent when the checkout knows it (the call above, without it, sends an undefined `mode`: dropped by JSON)
    await createOrder({ userId: 'u', orgId: 'org', planId: 1, amount: 590, staffLimit: 4, mode: 'upgrade' });
    expect(mocked.post).toHaveBeenLastCalledWith('/orders/create', expect.objectContaining({ mode: 'upgrade', staff_limit: 4 }));
    mocked.post.mockResolvedValue({ success: true });
    await expect(createOrder({ userId: 'u', orgId: 'org', planId: 1, amount: 1, staffLimit: 10 })).rejects.toThrow('could not be started');
    mocked.post.mockResolvedValue({ success: false, message: 'Plan not found' });
    await expect(createOrder({ userId: 'u', orgId: 'org', planId: 9, amount: 1, staffLimit: 10 })).rejects.toThrow('Plan not found');
  });

  it('verifyPayment posts the v1 body', async () => {
    mocked.post.mockResolvedValue({ success: true, message: 'Payment verified successfully', valid_till: '2027-10-18' });
    const res = await verifyPayment({ userId: 'u', email: 'a@x.in', razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 's' });
    expect(mocked.post).toHaveBeenCalledWith('/payments/verify', {
      user_id: 'u',
      email: 'a@x.in',
      wants_gst_invoice: false,
      razorpay_order_id: 'o',
      razorpay_payment_id: 'p',
      razorpay_signature: 's',
    });
    expect(res).toEqual({ message: 'Payment verified successfully', validTill: '2027-10-18', planId: null });
  });

  it('coupons', async () => {
    mocked.get.mockResolvedValueOnce({ success: true, data: { coupon_id: 3, coupon_name: 'WELCOME', discount: '10' } });
    expect(await getFirstCoupon()).toEqual({ id: 3, name: 'WELCOME', discountPercent: 10 });
    mocked.get.mockResolvedValueOnce({ success: false, message: 'No active coupons' });
    expect(await getFirstCoupon()).toBeNull();
    mocked.get.mockResolvedValueOnce({ success: true, data: { coupon_name: 'SAVE5', discount: 5 } });
    expect(await validateCoupon(' SAVE5 ')).toEqual({ id: null, name: 'SAVE5', discountPercent: 5 });
    expect(mocked.get).toHaveBeenLastCalledWith('/plans/coupon/validate', { coupon_name: 'SAVE5' });
    mocked.get.mockResolvedValueOnce({ success: false, message: 'Invalid or expired coupon' });
    await expect(validateCoupon('BAD')).rejects.toThrow('Invalid or expired coupon');
    await expect(validateCoupon('  ')).rejects.toThrow('Enter a coupon code');
    mocked.get.mockResolvedValueOnce({ is_first_payment: true });
    expect(await checkFirstPayment('u')).toBe(true);
  });

  it('parseInvoiceRecord tolerates the legacy key spellings', () => {
    expect(parseInvoiceRecord({ invoice_no: 'INV-9', created_at: '2026-10-01T00:00:00', plan_name: 'Core', staff_limit: 20, amount: '1180', expiry_date: '2027-10-01' })).toMatchObject({
      id: 'INV-9',
      number: 'INV-9',
      paymentDate: '2026-10-01T00:00:00',
      planName: 'Core',
      staffCount: 20,
      totalAmount: 1180,
      validTill: '2027-10-01',
    });
    expect(parseInvoiceRecord({ invoice_id: 12, invoice_number: 'N-12', payment_date: '2026-09-01', total_amount: 5, valid_till: '2026-10-01' })).toMatchObject({ id: '12', number: 'N-12' });
  });

  it('listInvoices and download helpers', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [{ invoice_number: 'N1' }] });
    expect(await listInvoices('u', 'org')).toHaveLength(1);
    expect(mocked.get).toHaveBeenCalledWith('/invoice/history', { user_id: 'u', org_id: 'org' });
    const url = invoiceDownloadUrl({ userId: 'u', orgId: 'org', invoiceNumber: 'INV/1 2' });
    expect(url).toMatch(/\/invoice\/download\?user_id=u&org_id=org&invoice_number=INV%2F1%202$/);
    expect(invoiceFileName('INV/1 2')).toBe('Invoice_INV_1_2.pdf');
    expect(invoiceFileName('')).toBe('Invoice_download.pdf');
  });

  it('prefers the signed download_url of a history row when the server sends one', () => {
    const signed = '/invoice/download?user_id=u&org_id=org&invoice_number=N1&exp=1735689600&sig=abc123';
    const invoice = parseInvoiceRecord({ invoice_number: 'N1', download_url: signed });
    expect(invoice.downloadUrl).toBe(signed);
    expect(invoiceDownloadUrl({ userId: 'u', orgId: 'org', invoiceNumber: 'N1', downloadUrl: invoice.downloadUrl })).toMatch(
      /\/invoice\/download\?user_id=u&org_id=org&invoice_number=N1&exp=1735689600&sig=abc123$/,
    );
    // no link from the server (or not a relative path): the plain link is built as before
    expect(parseInvoiceRecord({ invoice_number: 'N1' }).downloadUrl).toBeUndefined();
    expect(parseInvoiceRecord({ invoice_number: 'N1', download_url: 'https://evil.example/x' }).downloadUrl).toBeUndefined();
    expect(invoiceDownloadUrl({ userId: 'u', orgId: 'org', invoiceNumber: 'N1' })).toMatch(/invoice_number=N1$/);
  });
});

describe('billing: server quote (POST /orders/quote)', () => {
  const wire = {
    mode: 'new', plan_id: 22, plan_name: 'Prime', price_per_staff_month: 40, charged_staff: 15, charged_months: 12, term_months: 12,
    staff_charge: 7200, credit: 0, after_credit: 7200, coupon_code: 'FLAT500', coupon_applied: true, coupon_message: null,
    discount_percent: null, discount_amount: 500, subtotal: 6700, gst_percent: 18, gst: 1206, grand_total: 7906, amount_paise: 790600,
    currency: 'INR', valid_from: '2026-11-02', valid_till: '2027-11-02', resulting_staff_limit: 15, min_staff: 10, has_current_plan: false,
    is_plan_expired: false, payable: true,
  };

  it('maps the free months of the term (paid months in charged_months, the full validity in term_months)', () => {
    const q = mapOrderQuote({ data: { ...wire, charged_months: 5, term_months: 6, free_months: 1, staff_charge: 2450 } });
    expect(q).toMatchObject({ chargedMonths: 5, termMonths: 6, freeMonths: 1, staffCharge: 2450 });
    expect(mapOrderQuote({ data: { ...wire, free_months: -2 } })?.freeMonths).toBe(0);
  });

  it('maps the breakdown with numbers as numbers (a flat coupon has no percent)', () => {
    const q = mapOrderQuote({ success: true, data: wire });
    expect(q).toEqual({
      mode: 'new', planId: 22, planName: 'Prime', pricePerStaffMonth: 40, chargedStaff: 15, chargedMonths: 12, termMonths: 12, freeMonths: 0,
      staffCharge: 7200, credit: 0, afterCredit: 7200, couponCode: 'FLAT500', couponApplied: true, couponMessage: null,
      discountPercent: null, discountAmount: 500, subtotal: 6700, gstPercent: 18, gst: 1206, grandTotal: 7906, amountPaise: 790600,
      currency: 'INR', validFrom: '2026-11-02', validTill: '2027-11-02', resultingStaffLimit: 15, payable: true,
      // an older server sends no referral fields: defaults, no offer
      referralApplied: false, referralPercent: null, referralMessage: null, referral: null,
    });
    // numeric strings (decimal columns) are numbers too; a percent coupon keeps its percent; an unusable coupon carries its message
    const s = mapOrderQuote({ data: { ...wire, grand_total: '7906.00', discount_percent: '10', coupon_applied: false, coupon_message: 'Invalid or expired coupon', mode: 'renew' } });
    expect(s).toMatchObject({ grandTotal: 7906, discountPercent: 10, couponApplied: false, couponMessage: 'Invalid or expired coupon', mode: 'renew' });
    expect(typeof s?.grandTotal).toBe('number');
  });

  it('maps the referral reward fields (applied reward, percent, message and the offer block)', () => {
    const applied = mapOrderQuote({
      data: {
        ...wire, coupon_code: null, coupon_applied: false, discount_percent: 10, discount_amount: 720,
        referral_applied: true, referral_percent: 10, referral_message: null,
        referral: { available_count: 2, eligible: true, percent: 10, message: null },
      },
    });
    expect(applied).toMatchObject({
      referralApplied: true, referralPercent: 10, referralMessage: null,
      referral: { availableCount: 2, eligible: true, percent: 10, message: null },
    });
    const refused = mapOrderQuote({
      data: {
        ...wire, referral_applied: false, referral_percent: '10', referral_message: 'Referral rewards are valid on Prime and Elite plans only',
        referral: { available_count: '1', eligible: false, message: 'Referral rewards are valid on Prime and Elite plans only' },
      },
    });
    expect(refused).toMatchObject({
      referralApplied: false, referralPercent: 10, referralMessage: 'Referral rewards are valid on Prime and Elite plans only',
      referral: { availableCount: 1, eligible: false, percent: 10, message: 'Referral rewards are valid on Prime and Elite plans only' },
    });
    // a malformed block is no offer; a negative count is clamped
    expect(mapOrderQuote({ data: { ...wire, referral: 'x' } })?.referral).toBeNull();
    expect(mapOrderQuote({ data: { ...wire, referral: { available_count: -3 } } })?.referral).toMatchObject({ availableCount: 0, eligible: false });
  });

  it('apply_referral is sent to /orders/quote and /orders/create only when true', async () => {
    mocked.post.mockResolvedValue({ success: true, data: wire });
    await quote({ userId: 'u', orgId: 'org', planId: 22, staffLimit: 15, couponCode: null, mode: 'new', applyReferral: true });
    expect(mocked.post).toHaveBeenLastCalledWith('/orders/quote', expect.objectContaining({ apply_referral: true, coupon_code: null }), {});
    await quote({ userId: 'u', orgId: 'org', planId: 22, staffLimit: 15, applyReferral: false });
    expect(mocked.post.mock.calls[mocked.post.mock.calls.length - 1][1]).not.toHaveProperty('apply_referral');
    mocked.post.mockResolvedValue({ success: true, order_id: 'o1', key_id: 'k1', amount: 590, currency: 'INR' });
    await createOrder({ userId: 'u', orgId: 'org', planId: 2, amount: 590, staffLimit: 10, couponCode: null, mode: 'renew', applyReferral: true });
    expect(mocked.post).toHaveBeenLastCalledWith('/orders/create', expect.objectContaining({ apply_referral: true, coupon_code: null, mode: 'renew' }));
    await createOrder({ userId: 'u', orgId: 'org', planId: 2, amount: 590, staffLimit: 10 });
    expect(mocked.post.mock.calls[mocked.post.mock.calls.length - 1][1]).not.toHaveProperty('apply_referral');
    // a coupon and a reward are never sent together (the server answers 400 on quote and create): the coupon wins
    await createOrder({ userId: 'u', orgId: 'org', planId: 2, amount: 590, staffLimit: 10, couponCode: 'SAVE10', applyReferral: true });
    expect(mocked.post.mock.calls[mocked.post.mock.calls.length - 1][1]).toMatchObject({ coupon_code: 'SAVE10' });
    expect(mocked.post.mock.calls[mocked.post.mock.calls.length - 1][1]).not.toHaveProperty('apply_referral');
    mocked.post.mockResolvedValue({ success: true, data: wire });
    await quote({ userId: 'u', orgId: 'org', planId: 22, staffLimit: 15, couponCode: 'SAVE10', applyReferral: true });
    expect(mocked.post.mock.calls[mocked.post.mock.calls.length - 1][1]).not.toHaveProperty('apply_referral');
  });

  it('is null when the payload has no total (the caller keeps its local numbers)', () => {
    expect(mapOrderQuote({ success: true, data: {} })).toBeNull();
    expect(mapOrderQuote(null)).toBeNull();
    expect(mapOrderQuote({ detail: 'x' })).toBeNull();
  });

  it('quote posts the body (blank coupon -> null, mode kept) and returns the mapped quote', async () => {
    mocked.post.mockResolvedValue({ success: true, data: wire });
    const controller = new AbortController();
    const q = await quote({ userId: 'u', orgId: 'org', planId: 22, staffLimit: 15, couponCode: ' flat500 ', mode: 'new' }, { signal: controller.signal });
    expect(q?.grandTotal).toBe(7906);
    expect(mocked.post).toHaveBeenCalledWith(
      '/orders/quote',
      { user_id: 'u', org_id: 'org', plan_id: 22, staff_limit: 15, coupon_code: 'flat500', mode: 'new' },
      { signal: controller.signal },
    );
    await quote({ userId: 'u', orgId: 'org', planId: null, staffLimit: 10, couponCode: '  ', mode: 'renew' });
    expect(mocked.post).toHaveBeenLastCalledWith('/orders/quote', expect.objectContaining({ plan_id: null, coupon_code: null, mode: 'renew' }), {});
  });

  it('never throws: a server without the route (404 / 405), a network failure, a timeout or any error answers null', async () => {
    const input = { userId: 'u', orgId: 'org', planId: 22, staffLimit: 15 };
    for (const status of [404, 405, 422, 500]) {
      mocked.post.mockRejectedValueOnce(new ApiError({ status, message: 'x' }));
      await expect(quote(input)).resolves.toBeNull();
    }
    mocked.post.mockRejectedValueOnce(new ApiError({ status: 0, isNetwork: true }));
    await expect(quote(input)).resolves.toBeNull();
    mocked.post.mockRejectedValueOnce(new ApiError({ status: 0, isTimeout: true }));
    await expect(quote(input)).resolves.toBeNull();
    mocked.post.mockRejectedValueOnce(new Error('boom'));
    await expect(quote(input)).resolves.toBeNull();
    mocked.post.mockResolvedValueOnce({ success: false, message: 'nope' });
    await expect(quote(input)).resolves.toBeNull();
    mocked.post.mockResolvedValueOnce('<html>not json</html>');
    await expect(quote(input)).resolves.toBeNull();
  });
});
