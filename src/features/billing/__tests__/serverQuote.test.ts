import type { OrderQuote } from '@/types/api/billing';

import { quoteBadgeLabel, quoteDiscountLabel, quoteNotice, quoteToTotals, withServerQuote } from '../utils/serverQuote';
import { buildQuote } from '../utils/quote';

const base: OrderQuote = {
  mode: 'new', planId: 22, planName: 'prime', pricePerStaffMonth: 40, chargedStaff: 15, chargedMonths: 12, termMonths: 12,
  staffCharge: 7200, credit: 0, afterCredit: 7200, couponCode: null, couponApplied: false, couponMessage: null, discountPercent: null,
  discountAmount: 0, subtotal: 7200, gstPercent: 18, gst: 1296, grandTotal: 8496, amountPaise: 849600, currency: 'INR',
  validFrom: '2026-11-02', validTill: '2027-11-02', resultingStaffLimit: 15, payable: true,
};
const flat: OrderQuote = { ...base, couponCode: 'FLAT500', couponApplied: true, discountAmount: 500, subtotal: 6700, gst: 1206, grandTotal: 7906 };
const percent: OrderQuote = { ...base, couponCode: 'SAVE10', couponApplied: true, discountPercent: 10, discountAmount: 720, subtotal: 6480, gst: 1166, grandTotal: 7646 };
const capped: OrderQuote = { ...percent, discountAmount: 100 };
const refused: OrderQuote = { ...base, couponCode: 'BIG', couponMessage: 'This coupon needs a minimum order of Rs 10,000' };

describe('server quote helpers', () => {
  it('quoteToTotals mirrors the server numbers; a refused coupon discounts nothing', () => {
    expect(quoteToTotals(flat)).toEqual({ staffCharge: 7200, afterCredit: 7200, discountPercent: 0, discountAmount: 500, subtotal: 6700, gst: 1206, grandTotal: 7906 });
    expect(quoteToTotals(refused).discountAmount).toBe(0);
    expect(quoteToTotals(percent).discountPercent).toBe(10);
  });

  it('labels: classic wording for plain percent coupons, server facts for flat / capped ones', () => {
    expect(quoteDiscountLabel(base)).toBeUndefined();
    expect(quoteDiscountLabel(percent)).toBe('Coupon Discount (10% on ₹7,200)');
    expect(quoteBadgeLabel(percent, { id: null, name: 'SAVE10', discountPercent: 10 })).toBeUndefined();
    expect(quoteDiscountLabel(flat)).toBe('Coupon Discount (FLAT500)');
    expect(quoteBadgeLabel(flat, { id: null, name: 'FLAT500', discountPercent: 0 })).toBe('FLAT500 (₹500 off)');
    expect(quoteDiscountLabel(capped)).toBe('Coupon Discount (10%, capped)');
    expect(quoteBadgeLabel(capped, { id: null, name: 'SAVE10', discountPercent: 10 })).toBe('SAVE10 (₹100 off)');
    expect(quoteBadgeLabel(refused, null)).toBeUndefined();
  });

  it('quoteNotice carries the server message only for a coupon that does not apply', () => {
    expect(quoteNotice(base)).toBeNull();
    expect(quoteNotice(flat)).toBeNull();
    expect(quoteNotice(refused)).toBe('This coupon needs a minimum order of Rs 10,000');
    expect(quoteNotice({ ...refused, couponMessage: null })).toBe('This coupon cannot be applied.');
  });

  it('withServerQuote lays the server facts (credit, months, price, validity) over the local quote', () => {
    const local = buildQuote({
      mode: 'new', target: { id: 22, name: 'prime', amount: 40, months: 12 }, current: null, currentStaff: 10, staffLimit: 15, today: '2026-11-02',
    });
    const merged = withServerQuote(local, { ...base, credit: 1500, pricePerStaffMonth: 45, chargedMonths: 6, validTill: '2027-05-02' });
    expect(merged).toMatchObject({ credit: 1500, chargedMonths: 6, validTill: '2027-05-02', chargedStaff: 15 });
    expect(merged.plan.amount).toBe(45);
    expect(merged.plan.id).toBe(22);
    expect(withServerQuote(local, { ...base, validTill: null }).validTill).toBe(local.validTill);
  });
});
