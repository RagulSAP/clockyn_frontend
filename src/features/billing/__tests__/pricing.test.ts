import {
  GST_RATE,
  applyStaffInput,
  calcExtraStaff,
  calcMinStaff,
  calcPlanCredit,
  calcRemainingMonths,
  calcStaffCharge,
  calcTotals,
  calcValidTill,
  liveStaffLimit,
  monthLabel,
  parsePurchaseMode,
} from '../utils/pricing';
import { buildQuote, initialStaffLimit, resolveQuoteSource, type CurrentPlanInfo } from '../utils/quote';
import type { Plan, Subscription } from '@/types/api/plans';

const TODAY = '2026-10-18';

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  planId: 12,
  planName: 'Core',
  planAmount: 25,
  planMonths: 6,
  startDate: '2026-08-01',
  endDate: '2027-02-10',
  staffLimit: 12,
  status: 'ACTIVE',
  isExpired: false,
  isFreeTrial: false,
  freeTrialEnd: null,
  billingDate: null,
  raw: {},
  ...over,
});

describe('calcTotals (payment_summary §7 worked examples)', () => {
  it('15 staff × ₹40 × 12 months, no credit / coupon: ₹7,200 + GST ₹1,296 = ₹8,496', () => {
    const t = calcTotals({ staff: 15, price: 40, months: 12 });
    expect(t).toMatchObject({ staffCharge: 7200, afterCredit: 7200, discountAmount: 0, subtotal: 7200, gst: 1296, grandTotal: 8496 });
    expect(GST_RATE).toBe(0.18);
  });

  it('10 % coupon: discount 720, subtotal 6,480, GST round(1,166.4) = 1,166, total 7,646', () => {
    const t = calcTotals({ staff: 15, price: 40, months: 12, couponPercent: 10 });
    expect(t).toMatchObject({ discountPercent: 10, discountAmount: 720, subtotal: 6480, gst: 1166, grandTotal: 7646 });
  });

  it('credit applies BEFORE the coupon: 9,600 − 1,500 = 8,100; 10 % → 810; subtotal 7,290; GST 1,312; total 8,602', () => {
    const t = calcTotals({ staff: 20, price: 40, months: 12, credit: 1500, couponPercent: 10 });
    expect(t).toMatchObject({ staffCharge: 9600, afterCredit: 8100, discountAmount: 810, subtotal: 7290, gst: 1312, grandTotal: 8602 });
  });

  it('credit larger than the charge floors everything at 0', () => {
    expect(calcTotals({ staff: 10, price: 10, months: 1, credit: 5000, couponPercent: 20 })).toMatchObject({
      afterCredit: 0,
      discountAmount: 0,
      subtotal: 0,
      gst: 0,
      grandTotal: 0,
    });
  });

  it('rounds the discount and the GST half up and leaves the staff charge unrounded', () => {
    // 10 × 12.5 × 1 = 125 → 15 % = 18.75 → 19; subtotal 106; GST 19.08 → 19
    expect(calcTotals({ staff: 10, price: 12.5, months: 1, couponPercent: 15 })).toMatchObject({ staffCharge: 125, discountAmount: 19, subtotal: 106, gst: 19, grandTotal: 125 });
    expect(calcStaffCharge(10, 12.5, 1)).toBe(125);
    // 0.5 rounds up (JS Math.round semantics): 50 × 1 % = 0.5 → 1
    expect(calcTotals({ staff: 1, price: 50, months: 1, couponPercent: 1 }).discountAmount).toBe(1);
  });

  it('ignores a non-numeric coupon percentage', () => {
    expect(calcTotals({ staff: 10, price: 10, months: 1, couponPercent: Number.NaN }).discountAmount).toBe(0);
  });
});

describe('upgrade_plan §7 rules', () => {
  it('credit = 10 × current price × current duration, only when buying a new plan over a live plan', () => {
    const base = { hasCurrentPlan: true, mode: 'new' as const, isPlanExpired: false, currentPlanAmount: 25, currentPlanMonths: 6 };
    expect(calcPlanCredit(base)).toBe(1500);
    expect(calcPlanCredit({ ...base, isPlanExpired: true })).toBe(0);
    expect(calcPlanCredit({ ...base, hasCurrentPlan: false })).toBe(0);
    expect(calcPlanCredit({ ...base, mode: 'upgrade' })).toBe(0);
    expect(calcPlanCredit({ ...base, mode: 'renew' })).toBe(0);
  });

  it('remaining months: whole calendar months between today and the end date, at least 1; plan months otherwise', () => {
    expect(calcRemainingMonths({ mode: 'upgrade', planMonths: 6, existingEndDate: '2027-02-10', today: TODAY })).toBe(4);
    expect(calcRemainingMonths({ mode: 'upgrade', planMonths: 6, existingEndDate: '2026-10-30', today: TODAY })).toBe(1);
    expect(calcRemainingMonths({ mode: 'upgrade', planMonths: 6, existingEndDate: '2026-01-01', today: TODAY })).toBe(1);
    expect(calcRemainingMonths({ mode: 'upgrade', planMonths: 6, existingEndDate: null, today: TODAY })).toBe(6);
    expect(calcRemainingMonths({ mode: 'renew', planMonths: 12, existingEndDate: '2027-02-10', today: TODAY })).toBe(12);
    expect(calcRemainingMonths({ mode: 'new', planMonths: 3, existingEndDate: null, today: TODAY })).toBe(3);
  });

  it('min staff and extra staff', () => {
    expect(calcMinStaff({ mode: 'new', hasCurrentPlan: true, currentStaff: 12 })).toBe(12);
    expect(calcMinStaff({ mode: 'new', hasCurrentPlan: false, currentStaff: 12 })).toBe(10);
    expect(calcMinStaff({ mode: 'upgrade', hasCurrentPlan: true, currentStaff: 12 })).toBe(10);
    expect(calcMinStaff({ mode: 'renew', hasCurrentPlan: true, currentStaff: 12 })).toBe(10);
    expect(calcExtraStaff({ mode: 'upgrade', staffLimit: 20, currentStaff: 12 })).toBe(8);
    expect(calcExtraStaff({ mode: 'upgrade', staffLimit: 11, currentStaff: 12 })).toBe(0);
    expect(calcExtraStaff({ mode: 'new', staffLimit: 20, currentStaff: 12 })).toBe(0);
  });

  it('valid till: capacity upgrade keeps the end date, renewal adds 12 months to the start, otherwise today + months', () => {
    expect(calcValidTill({ mode: 'upgrade', months: 4, existingEndDate: '2027-02-10', today: TODAY })).toBe('2027-02-10');
    expect(calcValidTill({ mode: 'renew', months: 12, existingEndDate: '2027-02-10', today: TODAY })).toBe('2028-02-10');
    expect(calcValidTill({ mode: 'new', months: 12, today: TODAY })).toBe('2027-10-18');
    // month-end is clamped instead of overflowing into the next month
    expect(calcValidTill({ mode: 'new', months: 1, today: '2026-01-31' })).toBe('2026-02-28');
  });

  it('staff count input: lenient parseInt, never below the minimum, text leaves the value unchanged', () => {
    expect(applyStaffInput('5', 10, 12)).toBe(10);
    expect(applyStaffInput('0', 10, 12)).toBe(10);
    expect(applyStaffInput('-3', 10, 12)).toBe(10);
    expect(applyStaffInput('25', 10, 12)).toBe(25);
    expect(applyStaffInput('12abc', 10, 15)).toBe(12);
    expect(applyStaffInput('12.9', 10, 15)).toBe(12);
    expect(applyStaffInput('abc', 10, 15)).toBe(15);
    expect(applyStaffInput('', 10, 15)).toBe(15);
  });

  it('live staff limit is at least 10 and 10 when unknown', () => {
    expect(liveStaffLimit(12)).toBe(12);
    expect(liveStaffLimit(7)).toBe(10);
    expect(liveStaffLimit(null)).toBe(10);
    expect(liveStaffLimit(undefined)).toBe(10);
  });

  it('labels and mode parsing', () => {
    expect(monthLabel(1)).toBe('1 Month');
    expect(monthLabel(6)).toBe('6 Months');
    expect(monthLabel(12)).toBe('1 Year');
    expect(parsePurchaseMode('renew')).toBe('renew');
    expect(parsePurchaseMode(['upgrade'])).toBe('upgrade');
    expect(parsePurchaseMode('nonsense')).toBe('new');
    expect(parsePurchaseMode(undefined)).toBe('new');
  });
});

describe('buildQuote (the four worked examples of upgrade_plan §7.10)', () => {
  const primeTier = { id: 22, name: 'Prime', amount: 40, months: 12 };
  const current = (over: Partial<CurrentPlanInfo> = {}): CurrentPlanInfo => ({
    planName: 'Core',
    amount: 25,
    months: 6,
    validTill: '2027-02-10',
    endDate: '2027-02-10',
    ...over,
  });

  it('(a) new Prime 12 months @ ₹40, no current plan, 15 staff: charge 7,200, credit 0', () => {
    const q = buildQuote({ mode: 'new', target: primeTier, current: null, currentStaff: 10, staffLimit: 15, today: TODAY });
    expect(q).toMatchObject({ hasCurrentPlan: false, minStaff: 10, credit: 0, chargedStaff: 15, chargedMonths: 12, noCoupon: false, canContinue: true });
    expect(calcTotals({ staff: q.chargedStaff, price: 40, months: q.chargedMonths, credit: q.credit }).staffCharge).toBe(7200);
  });

  it('(b) change from Core 6 months @ ₹25 (active) to Prime 12 months @ ₹40, 20 staff: pay 8,100 before GST', () => {
    const q = buildQuote({ mode: 'new', target: primeTier, current: current(), currentStaff: 12, staffLimit: 20, today: TODAY });
    expect(q).toMatchObject({ hasCurrentPlan: true, minStaff: 12, credit: 1500, isPlanExpired: false });
    expect(calcTotals({ staff: q.chargedStaff, price: 40, months: q.chargedMonths, credit: q.credit })).toMatchObject({ staffCharge: 9600, afterCredit: 8100 });
  });

  it('(b) an expired current plan gives no credit', () => {
    const q = buildQuote({ mode: 'new', target: primeTier, current: current({ validTill: '2026-09-01', endDate: '2026-09-01' }), currentStaff: 12, staffLimit: 20, today: TODAY });
    expect(q.credit).toBe(0);
    expect(q.isPlanExpired).toBe(true);
  });

  it('(c) renew @ ₹40 with 10 staff: 4,800 for 12 months, valid till renew start + 12 months, coupon allowed', () => {
    const q = buildQuote({
      mode: 'renew',
      target: { id: 22, name: 'Prime', amount: 40, months: 12 },
      current: current(),
      currentStaff: 12,
      staffLimit: initialStaffLimit('renew', 12),
      today: TODAY,
      renewStart: '2027-02-10',
    });
    expect(q).toMatchObject({ staffLimit: 10, minStaff: 10, chargedStaff: 10, chargedMonths: 12, credit: 0, noCoupon: false, validTill: '2028-02-10' });
    expect(calcStaffCharge(q.chargedStaff, 40, q.chargedMonths)).toBe(4800);
  });

  it('(d) staff upgrade 12 → 20 with 4 months left @ ₹40: extra 8, charge 1,280, no coupon, no credit', () => {
    const q = buildQuote({
      mode: 'upgrade',
      target: { id: 22, name: 'Prime', amount: 40, months: 12 },
      current: current({ planName: 'Prime', amount: 40, months: 12 }),
      currentStaff: 12,
      staffLimit: 20,
      today: TODAY,
    });
    expect(q).toMatchObject({ extraStaff: 8, chargedStaff: 8, chargedMonths: 4, credit: 0, noCoupon: true, isStaffUpgrade: true, canContinue: true, validTill: '2027-02-10', minStaff: 10 });
    expect(calcStaffCharge(q.chargedStaff, 40, q.chargedMonths)).toBe(1280);
  });

  it('a capacity upgrade at or below the current limit cannot continue (stepper may go down to 10)', () => {
    const q = buildQuote({ mode: 'upgrade', target: primeTier, current: current(), currentStaff: 12, staffLimit: 12, today: TODAY });
    expect(q.canContinue).toBe(false);
    expect(buildQuote({ mode: 'upgrade', target: primeTier, current: current(), currentStaff: 12, staffLimit: 10, today: TODAY }).canContinue).toBe(false);
  });
});

describe('resolveQuoteSource', () => {
  const catalogue: Plan[] = [
    { id: 21, name: 'Prime', amount: 45, months: 6 },
    { id: 22, name: 'Prime', amount: 40, months: 12 },
  ];

  it('new: looks the tier up in the catalogue', () => {
    const r = resolveQuoteSource({ mode: 'new', planId: 22, subscription: sub(), catalogue, today: TODAY });
    expect(r).toMatchObject({ ok: true, target: { id: 22, amount: 40, months: 12 }, currentStaff: 12 });
    expect(resolveQuoteSource({ mode: 'new', planId: 99, subscription: sub(), catalogue, today: TODAY })).toEqual({ ok: false, reason: 'plan-not-found' });
  });

  it('new during a trial: the placeholder subscription is a zero-priced current plan (credit 0, min staff 10)', () => {
    const trial = sub({ planId: null, planName: 'Free Trial', planAmount: null, planMonths: null, startDate: null, endDate: '2026-10-25', staffLimit: 10, isFreeTrial: true, freeTrialEnd: '2026-10-25' });
    const r = resolveQuoteSource({ mode: 'new', planId: 22, subscription: trial, catalogue, today: TODAY });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const q = buildQuote({ mode: 'new', target: r.target, current: r.current, currentStaff: r.currentStaff, staffLimit: 10, today: TODAY });
    expect(q).toMatchObject({ hasCurrentPlan: true, credit: 0, minStaff: 10 });
  });

  it('upgrade / renew use the CURRENT paid tier; renewals are 12 months and start at the end date while active, else today', () => {
    const up = resolveQuoteSource({ mode: 'upgrade', planId: null, subscription: sub(), catalogue, today: TODAY });
    expect(up).toMatchObject({ ok: true, target: { id: 12, name: 'Core', amount: 25, months: 6 } });
    const renew = resolveQuoteSource({ mode: 'renew', planId: null, subscription: sub(), catalogue, today: TODAY });
    expect(renew).toMatchObject({ ok: true, target: { months: 12, amount: 25 }, renewStart: '2027-02-10' });
    const expired = resolveQuoteSource({ mode: 'renew', planId: null, subscription: sub({ endDate: '2026-09-01' }), catalogue, today: TODAY });
    expect(expired).toMatchObject({ ok: true, renewStart: TODAY });
  });

  it('upgrade / renew without a paid plan are not possible', () => {
    const none = sub({ planId: null, planName: null });
    expect(resolveQuoteSource({ mode: 'upgrade', planId: null, subscription: none, catalogue, today: TODAY })).toEqual({ ok: false, reason: 'no-plan' });
    expect(resolveQuoteSource({ mode: 'renew', planId: null, subscription: null, catalogue, today: TODAY })).toEqual({ ok: false, reason: 'no-plan' });
  });
});
