/**
 * Free months ("pay for 5, get 1 free") in the plan purchase maths. A plan keeps ONE list price per staff per month; a longer
 * duration tier adds free months to the validity without adding to the charge. These tests also pin down that nothing changes
 * for plans without an offer and that capacity upgrades (staff-only) and plan switches are not affected by free months.
 */
import type { Plan, Subscription } from '@/types/api/plans';

import { isTierDisabled } from '../utils/planState';
import { calcPlanCredit, calcStaffCharge, calcTotals, freeMonthsForTerm, paidMonths, tierSavings } from '../utils/pricing';
import { buildQuote, resolveQuoteSource, type CurrentPlanInfo, type TargetPlan } from '../utils/quote';

const TODAY = '2026-10-18';

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  planId: 5,
  planName: 'Core',
  planAmount: 49,
  planMonths: 12,
  planFreeMonths: 2,
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

// Core: 1 month, 6 months (1 free), 12 months (2 free) — all at the same list price per staff per month.
const catalogue: Plan[] = [
  { id: 1, name: 'Core', amount: 49, months: 1, freeMonths: 0, offerText: null },
  { id: 4, name: 'Core', amount: 49, months: 6, freeMonths: 1, offerText: null },
  { id: 5, name: 'Core', amount: 49, months: 12, freeMonths: 2, offerText: 'Pay 10, get 2 free' },
  { id: 2, name: 'Prime', amount: 99, months: 1, freeMonths: 0, offerText: null },
  { id: 6, name: 'Prime', amount: 99, months: 6, freeMonths: 1, offerText: null },
  { id: 7, name: 'Prime', amount: 99, months: 12, freeMonths: 2, offerText: null },
];

const tier = (id: number): TargetPlan => {
  const p = catalogue.find((x) => x.id === id)!;
  return { id: p.id, name: p.name, amount: p.amount, months: p.months, freeMonths: p.freeMonths };
};

describe('paidMonths / freeMonthsForTerm', () => {
  it('paid months = duration minus the free months, clamped so at least one month is paid', () => {
    expect(paidMonths(1)).toBe(1);
    expect(paidMonths(6, 1)).toBe(5);
    expect(paidMonths(12, 2)).toBe(10);
    expect(paidMonths(6, 6)).toBe(1);
    expect(paidMonths(6, 99)).toBe(1);
    expect(paidMonths(6, -3)).toBe(6);
    expect(paidMonths(6, Number.NaN)).toBe(6);
    expect(paidMonths(0, 0)).toBe(0); // junk duration: stays 0, as before
  });

  it("the plan's own offer applies to its own term, other terms get the proportional share rounded down", () => {
    expect(freeMonthsForTerm(6, 1, 6)).toBe(1);
    expect(freeMonthsForTerm(12, 2, 12)).toBe(2);
    expect(freeMonthsForTerm(6, 1, 12)).toBe(2); // 12 × 1/6
    expect(freeMonthsForTerm(12, 2, 12)).toBe(2);
    expect(freeMonthsForTerm(1, 0, 12)).toBe(0);
    expect(freeMonthsForTerm(4, 1, 6)).toBe(1); // floor(1.5)
    expect(freeMonthsForTerm(12, 2, 3)).toBe(0); // floor(0.5)
  });
});

describe('tierSavings', () => {
  it('no free months: nothing is saved', () => {
    expect(tierSavings({ amount: 49, months: 1 })).toMatchObject({ freeMonths: 0, savePerStaff: 0, percent: 0, effectiveMonthly: 49 });
  });

  it('6 months with 1 free: save one month of the list price per staff', () => {
    expect(tierSavings({ amount: 49, months: 6, freeMonths: 1 })).toEqual({
      freeMonths: 1,
      savePerStaff: 49,
      percent: 17,
      effectiveMonthly: (49 * 5) / 6,
      label: '1 month free',
    });
  });

  it('12 months with 2 free: pluralises and uses the offer wording of the plan when it has one', () => {
    expect(tierSavings({ amount: 49, months: 12, freeMonths: 2 })).toMatchObject({ freeMonths: 2, savePerStaff: 98, percent: 17, label: '2 months free' });
    expect(tierSavings({ amount: 49, months: 12, freeMonths: 2, offerText: '  Pay 10, get 2 free ' }).label).toBe('Pay 10, get 2 free');
  });
});

describe('buying a plan with free months (mode new)', () => {
  it('6 months, 1 free, 10 staff @ ₹49: pays 5 months = 2,450, valid for the full 6 months', () => {
    const q = buildQuote({ mode: 'new', target: tier(4), current: null, currentStaff: 10, staffLimit: 10, today: TODAY });
    expect(q).toMatchObject({ chargedMonths: 5, freeMonths: 1, validTill: '2027-04-18', credit: 0 });
    expect(calcStaffCharge(q.chargedStaff, 49, q.chargedMonths)).toBe(2450);
  });

  it('12 months, 2 free, 10 staff @ ₹49: pays 10 months = 4,900, valid for 12 months', () => {
    const q = buildQuote({ mode: 'new', target: tier(5), current: null, currentStaff: 10, staffLimit: 10, today: TODAY });
    expect(q).toMatchObject({ chargedMonths: 10, freeMonths: 2, validTill: '2027-10-18' });
    expect(calcTotals({ staff: q.chargedStaff, price: 49, months: q.chargedMonths })).toMatchObject({ staffCharge: 4900, gst: 882, grandTotal: 5782 });
  });

  it('the 1 month tier has no free months', () => {
    const q = buildQuote({ mode: 'new', target: tier(1), current: null, currentStaff: 10, staffLimit: 15, today: TODAY });
    expect(q).toMatchObject({ chargedMonths: 1, freeMonths: 0, validTill: '2026-11-18' });
    expect(calcStaffCharge(q.chargedStaff, 49, q.chargedMonths)).toBe(735);
  });
});

describe('switching plan while a plan with free months is running (credit)', () => {
  const current = (over: Partial<CurrentPlanInfo> = {}): CurrentPlanInfo => ({
    planName: 'Core',
    amount: 49,
    months: 12,
    freeMonths: 2,
    validTill: '2027-02-10',
    endDate: '2027-02-10',
    ...over,
  });

  it('the credit is for the months the current plan was PAID for: 10 × 49 × 10 = 4,900 (not 12 months = 5,880)', () => {
    expect(calcPlanCredit({ hasCurrentPlan: true, mode: 'new', isPlanExpired: false, currentPlanAmount: 49, currentPlanMonths: 12, currentPlanFreeMonths: 2 })).toBe(4900);
    const q = buildQuote({ mode: 'new', target: tier(7), current: current(), currentStaff: 12, staffLimit: 20, today: TODAY });
    expect(q.credit).toBe(4900);
    // Prime 12 months with 2 free for 20 staff: 20 × 99 × 10 = 19,800, minus the credit
    expect(calcTotals({ staff: q.chargedStaff, price: 99, months: q.chargedMonths, credit: q.credit })).toMatchObject({ staffCharge: 19800, afterCredit: 14900 });
  });

  it('a current plan without free months is credited exactly as before', () => {
    expect(calcPlanCredit({ hasCurrentPlan: true, mode: 'new', isPlanExpired: false, currentPlanAmount: 25, currentPlanMonths: 6 })).toBe(1500);
    const q = buildQuote({ mode: 'new', target: tier(7), current: current({ amount: 25, months: 6, freeMonths: 0 }), currentStaff: 12, staffLimit: 20, today: TODAY });
    expect(q.credit).toBe(1500);
  });

  it('an expired plan gives no credit however many months were free', () => {
    const q = buildQuote({ mode: 'new', target: tier(7), current: current({ validTill: '2026-09-01', endDate: '2026-09-01' }), currentStaff: 12, staffLimit: 20, today: TODAY });
    expect(q.credit).toBe(0);
  });

  it('the credit reaches the quote through the subscription (planFreeMonths)', () => {
    const r = resolveQuoteSource({ mode: 'new', planId: 7, subscription: sub(), catalogue, today: TODAY });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.current).toMatchObject({ months: 12, freeMonths: 2 });
    expect(r.target).toMatchObject({ id: 7, months: 12, freeMonths: 2 });
    expect(buildQuote({ mode: 'new', target: r.target, current: r.current, currentStaff: r.currentStaff, staffLimit: 20, today: TODAY }).credit).toBe(4900);
  });
});

describe('downgrade matrix with 1 / 6 / 12 month tiers', () => {
  const disabled = (active: { name: string; months: number }, id: number): boolean => {
    const t = catalogue.find((x) => x.id === id)!;
    return isTierDisabled({ isActive: true, planName: active.name, planMonths: active.months }, { name: t.name, months: t.months });
  };

  it('running Core 6 months: Core 1 and 6 are blocked, Core 12 and every longer Prime tier is open, Prime 1 is a shorter tier', () => {
    const core6 = { name: 'Core', months: 6 };
    expect(disabled(core6, 1)).toBe(true);
    expect(disabled(core6, 4)).toBe(true);
    expect(disabled(core6, 5)).toBe(false);
    expect(disabled(core6, 2)).toBe(true);
    expect(disabled(core6, 6)).toBe(false);
    expect(disabled(core6, 7)).toBe(false);
  });

  it('running Prime 12 months: Core is blocked at every duration, Prime only below 12 is blocked (the running tier itself is "Active")', () => {
    const prime12 = { name: 'Prime', months: 12 };
    for (const id of [1, 4, 5, 2, 6]) expect(disabled(prime12, id)).toBe(true);
    expect(disabled(prime12, 7)).toBe(true); // same plan, not longer
  });

  it('running Core 1 month: every longer tier of every plan is open', () => {
    const core1 = { name: 'Core', months: 1 };
    for (const id of [4, 5, 6, 7, 2]) expect(disabled(core1, id)).toBe(false);
    expect(disabled(core1, 1)).toBe(true);
  });
});

describe('renewal (always 12 months) with free months', () => {
  const renewQuote = (planMonths: number, planFree: number) => {
    const s = sub({ planMonths, planFreeMonths: planFree });
    const r = resolveQuoteSource({ mode: 'renew', planId: null, subscription: s, catalogue, today: TODAY });
    if (!r.ok) throw new Error('no source');
    return buildQuote({ mode: 'renew', target: r.target, current: r.current, currentStaff: r.currentStaff, staffLimit: 10, today: TODAY, renewStart: r.renewStart });
  };

  it('12 month plan with 2 free: renews 12 months for 10 paid months', () => {
    expect(renewQuote(12, 2)).toMatchObject({ chargedMonths: 10, freeMonths: 2, validTill: '2028-02-10', credit: 0 });
  });

  it('6 month plan with 1 free: renews 12 months for 10 paid months (the same proportion)', () => {
    expect(renewQuote(6, 1)).toMatchObject({ chargedMonths: 10, freeMonths: 2 });
  });

  it('1 month plan without free months: renews 12 months for 12 paid months', () => {
    expect(renewQuote(1, 0)).toMatchObject({ chargedMonths: 12, freeMonths: 0, validTill: '2028-02-10' });
  });

  it('a plan from an older server (no free months at all): 12 paid months', () => {
    expect(renewQuote(12, 0)).toMatchObject({ chargedMonths: 12, freeMonths: 0 });
  });
});

describe('staff-only upgrade (capacity) is not affected by free months', () => {
  const run = (planMonths: number, planFree: number | undefined) => {
    const s = sub({ planMonths, planFreeMonths: planFree });
    const r = resolveQuoteSource({ mode: 'upgrade', planId: null, subscription: s, catalogue, today: TODAY });
    if (!r.ok) throw new Error('no source');
    return buildQuote({ mode: 'upgrade', target: r.target, current: r.current, currentStaff: r.currentStaff, staffLimit: 20, today: TODAY });
  };

  it('same extra staff, same calendar months left, same price with and without free months on the running plan', () => {
    const withFree = run(12, 2);
    const without = run(12, 0);
    const omitted = run(12, undefined);
    expect(withFree).toEqual({ ...without, plan: { ...without.plan, freeMonths: 2 } });
    expect(withFree).toMatchObject({ extraStaff: 8, chargedStaff: 8, chargedMonths: 4, freeMonths: 0, credit: 0, noCoupon: true, validTill: '2027-02-10' });
    expect(omitted).toEqual({ ...without, plan: { ...without.plan, freeMonths: 0 } });
    // 8 extra staff × ₹49 × 4 whole months left = 1,568 (the free months of the plan give no discount on extra staff)
    expect(calcStaffCharge(withFree.chargedStaff, 49, withFree.chargedMonths)).toBe(1568);
    expect(calcStaffCharge(without.chargedStaff, 49, without.chargedMonths)).toBe(1568);
  });
});

describe('plans without an offer give the same quotes as before free months existed', () => {
  const plain = { id: 22, name: 'Prime', amount: 40, months: 12 };
  const zero = { ...plain, freeMonths: 0 };
  const current = { planName: 'Core', amount: 25, months: 6, validTill: '2027-02-10', endDate: '2027-02-10' };
  const currentZero = { ...current, freeMonths: 0 };

  it.each(['new', 'renew', 'upgrade'] as const)('mode %s: omitted and zero free months are identical, free months are 0', (mode) => {
    const input = { mode, currentStaff: 12, staffLimit: 20, today: TODAY, renewStart: '2027-02-10' };
    const a = buildQuote({ ...input, target: plain, current });
    const b = buildQuote({ ...input, target: zero, current: currentZero });
    expect(a.freeMonths).toBe(0);
    expect({ ...b, plan: plain }).toEqual(a);
  });

  it('the worked example (b) of the pricing rules: Core 6 months → Prime 12 months @ ₹40, 20 staff pays 8,100 before GST', () => {
    const q = buildQuote({ mode: 'new', target: plain, current, currentStaff: 12, staffLimit: 20, today: TODAY });
    expect(q).toMatchObject({ credit: 1500, chargedMonths: 12, freeMonths: 0 });
    expect(calcTotals({ staff: q.chargedStaff, price: 40, months: q.chargedMonths, credit: q.credit })).toMatchObject({ staffCharge: 9600, afterCredit: 8100 });
  });
});
