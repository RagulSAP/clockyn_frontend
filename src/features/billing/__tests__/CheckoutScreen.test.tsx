import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { routes } from '@/config/routes';
import { ApiError } from '@/lib/api/errors';
import { addMonthsStr, todayIST } from '@/lib/datetime';
import { useAuthStore } from '@/store/auth';
import type { Plan, Subscription } from '@/types/api/plans';

import CheckoutScreen from '../screens/CheckoutScreen';
import { renderScreen, signInTestAdmin } from './testHelpers';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
    back: jest.fn(),
    canGoBack: () => true,
    dismissAll: jest.fn(),
  }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => mockParams,
}));

const mockApi = {
  getSubscription: jest.fn(),
  listPlans: jest.fn(),
  checkFirstPayment: jest.fn(),
  getFirstCoupon: jest.fn(),
  validateCoupon: jest.fn(),
  quote: jest.fn(),
  createOrder: jest.fn(),
  verifyPayment: jest.fn(),
};
jest.mock('@/api', () => ({
  plansApi: {
    getSubscription: (...a: unknown[]) => mockApi.getSubscription(...a),
    listPlans: (...a: unknown[]) => mockApi.listPlans(...a),
  },
  billingApi: {
    checkFirstPayment: (...a: unknown[]) => mockApi.checkFirstPayment(...a),
    getFirstCoupon: (...a: unknown[]) => mockApi.getFirstCoupon(...a),
    validateCoupon: (...a: unknown[]) => mockApi.validateCoupon(...a),
    quote: (...a: unknown[]) => mockApi.quote(...a),
    createOrder: (...a: unknown[]) => mockApi.createOrder(...a),
    verifyPayment: (...a: unknown[]) => mockApi.verifyPayment(...a),
  },
}));

const mockOpenCheckout = jest.fn();
jest.mock('@/lib/platform/payment', () => ({
  openCheckout: (...a: unknown[]) => mockOpenCheckout(...a),
  CheckoutHost: () => null,
}));

const noPlanSub: Subscription = {
  planId: null,
  planName: null,
  planAmount: null,
  planMonths: null,
  startDate: null,
  endDate: null,
  staffLimit: 10,
  status: 'INACTIVE',
  isExpired: false,
  isFreeTrial: false,
  freeTrialEnd: null,
  billingDate: null,
  raw: {},
};
const catalogue: Plan[] = [{ id: 22, name: 'prime', amount: 40, months: 12 }];
const order = { orderId: 'order_1', keyId: 'key_test', amount: 8496, currency: 'INR', orderName: '', isFirstPayment: false, prefill: { name: '', email: '', contact: '' }, notes: {} };

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  signInTestAdmin();
  mockParams = { mode: 'new', planId: '22', staff: '15' };
  mockApi.getSubscription.mockResolvedValue(noPlanSub);
  mockApi.listPlans.mockResolvedValue(catalogue);
  mockApi.checkFirstPayment.mockResolvedValue(false);
  mockApi.getFirstCoupon.mockResolvedValue(null);
  mockApi.quote.mockResolvedValue(null); // no quote route: the local pricing is shown
  mockApi.createOrder.mockResolvedValue(order);
  mockApi.verifyPayment.mockResolvedValue({ message: 'ok', validTill: '2027-10-18', planId: 22 });
  mockOpenCheckout.mockResolvedValue({ status: 'success', paymentId: 'pay_1', orderId: 'order_1', signature: 'sig' });
  jest.replaceProperty(Platform, 'OS', 'android');
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

describe('CheckoutScreen', () => {
  it('breaks the price down: 15 × ₹40 × 12 = ₹7,200 + 18 % GST = ₹8,496', async () => {
    await renderScreen(<CheckoutScreen />);
    expect(await screen.findByText('Prime Plan')).toBeTruthy();
    expect(screen.getByTestId('row-staff-charge')).toHaveTextContent('₹7,200');
    expect(screen.getByTestId('row-subtotal')).toHaveTextContent('₹7,200');
    expect(screen.getByTestId('row-gst')).toHaveTextContent('₹1,296');
    expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,496');
    expect(screen.getByText('Pay ₹8,496')).toBeTruthy();
    expect(screen.getByText('15 staff × ₹40/staff × 12 months')).toBeTruthy();
    expect(screen.getByText('GST (18%)')).toBeTruthy();
  });

  it('a valid coupon discounts the subtotal; Remove clears it; Apply is disabled when blank', async () => {
    mockApi.validateCoupon.mockResolvedValue({ id: 1, name: 'SAVE10', discountPercent: 10 });
    await renderScreen(<CheckoutScreen />);
    await screen.findByText('Prime Plan');
    expect(screen.getByTestId('coupon-apply')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('coupon-input'), 'save10');
    await fireEvent.press(screen.getByTestId('coupon-apply'));
    expect(await screen.findByText('SAVE10 (10% off)')).toBeTruthy();
    expect(mockApi.validateCoupon).toHaveBeenCalledWith('save10');
    expect(screen.getByTestId('row-discount')).toHaveTextContent('- ₹720');
    expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹7,646');
    await fireEvent.press(screen.getByTestId('coupon-remove'));
    expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,496');
  });

  it('an invalid coupon shows the error and applies nothing', async () => {
    mockApi.validateCoupon.mockRejectedValue(new Error('Invalid or expired coupon'));
    await renderScreen(<CheckoutScreen />);
    await screen.findByText('Prime Plan');
    await fireEvent.changeText(screen.getByTestId('coupon-input'), 'nope');
    await fireEvent.press(screen.getByTestId('coupon-apply'));
    expect(await screen.findByText('Invalid or expired coupon')).toBeTruthy();
    expect(screen.queryByTestId('row-discount')).toBeNull();
  });

  it('a first payment auto-applies the welcome coupon and announces it', async () => {
    mockApi.checkFirstPayment.mockResolvedValue(true);
    mockApi.getFirstCoupon.mockResolvedValue({ id: 5, name: 'WELCOME10', discountPercent: 10 });
    await renderScreen(<CheckoutScreen />);
    expect(await screen.findByText('Welcome Discount!')).toBeTruthy();
    expect(screen.getByText('10% OFF')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('welcome-close'));
    expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹7,646');
    expect(screen.getByText('WELCOME10 (10% off)')).toBeTruthy();
  });

  it('capacity upgrades offer no coupon and make no coupon requests', async () => {
    mockParams = { mode: 'upgrade', staff: '20' };
    mockApi.getSubscription.mockResolvedValue({ ...noPlanSub, planId: 3, planName: 'Prime', planAmount: 40, planMonths: 12, endDate: '2099-02-10', staffLimit: 12, status: 'ACTIVE' });
    await renderScreen(<CheckoutScreen />);
    expect(await screen.findByTestId('price-breakdown')).toBeTruthy();
    expect(screen.queryByTestId('coupon-section')).toBeNull();
    expect(screen.getByText(/8 extra staff × ₹40\/staff/)).toBeTruthy();
    expect(mockApi.checkFirstPayment).not.toHaveBeenCalled();
    expect(mockApi.getFirstCoupon).not.toHaveBeenCalled();
  });

  it('Pay: creates the order for the grand total, opens the sheet, verifies and shows the success dialog', async () => {
    await renderScreen(<CheckoutScreen />);
    await screen.findByText('Prime Plan');
    await fireEvent.press(screen.getByTestId('pay-button'));
    expect(await screen.findByText('Payment Successful!')).toBeTruthy();
    expect(mockApi.createOrder).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-1', planId: 22, amount: 8496, staffLimit: 15, couponCode: null, mode: 'new' });
    expect(mockOpenCheckout).toHaveBeenCalledWith(expect.objectContaining({ key: 'key_test', orderId: 'order_1', amount: 8496, currency: 'INR' }));
    expect(mockApi.verifyPayment).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', razorpayPaymentId: 'pay_1', razorpaySignature: 'sig', wantsGstInvoice: false }));
    expect(useAuthStore.getState().session?.planId).toBe(22);
    expect(screen.getByText('Prime Plan Active')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('go-dashboard'));
    expect(mockReplace).toHaveBeenCalledWith(routes.admin.home);
  });

  it('closing the payment sheet does not verify', async () => {
    mockOpenCheckout.mockResolvedValue({ status: 'dismissed' });
    await renderScreen(<CheckoutScreen />);
    await screen.findByText('Prime Plan');
    await fireEvent.press(screen.getByTestId('pay-button'));
    expect(await screen.findByText('Payment Cancelled')).toBeTruthy();
    expect(screen.getByText('You closed the payment window.')).toBeTruthy();
    expect(mockApi.verifyPayment).not.toHaveBeenCalled();
  });

  it('a failed order creation shows the server message and never opens the sheet', async () => {
    mockApi.createOrder.mockRejectedValue(new Error('Plan unavailable'));
    await renderScreen(<CheckoutScreen />);
    await screen.findByText('Prime Plan');
    await fireEvent.press(screen.getByTestId('pay-button'));
    expect(await screen.findByText('Plan unavailable')).toBeTruthy();
    expect(mockOpenCheckout).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('pay-button')).toBeEnabled());
  });

  it('a verification failure offers "Retry verification" without paying again', async () => {
    mockApi.verifyPayment.mockRejectedValueOnce(new Error('Signature mismatch')).mockResolvedValue({ message: 'ok', validTill: null, planId: 22 });
    await renderScreen(<CheckoutScreen />);
    await screen.findByText('Prime Plan');
    await fireEvent.press(screen.getByTestId('pay-button'));
    expect(await screen.findByText('Verification Failed')).toBeTruthy();
    await fireEvent.press(screen.getByText('OK'));
    await fireEvent.press(await screen.findByTestId('retry-verify'));
    expect(await screen.findByText('Payment Successful!')).toBeTruthy();
    expect(mockApi.createOrder).toHaveBeenCalledTimes(1);
    expect(mockOpenCheckout).toHaveBeenCalledTimes(1);
    expect(mockApi.verifyPayment).toHaveBeenCalledTimes(2);
  });

  describe('money paths of the spec worked examples (payment_summary §7 / upgrade_plan §7.10)', () => {
    const activeCore: Subscription = { ...noPlanSub, planId: 2, planName: 'Core', planAmount: 25, planMonths: 6, startDate: '2026-08-01', endDate: '2099-02-10', staffLimit: 12, status: 'ACTIVE' };

    it('plan change with credit AND a 10 % coupon: 9,600 − 1,500 → 8,100 → −810 → 7,290 + GST 1,312 = ₹8,602, posted as the order amount', async () => {
      mockParams = { mode: 'new', planId: '22', staff: '20' };
      mockApi.getSubscription.mockResolvedValue(activeCore);
      mockApi.validateCoupon.mockResolvedValue({ id: 1, name: 'SAVE10', discountPercent: 10 });
      mockApi.createOrder.mockResolvedValue({ ...order, amount: 8602 });
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      expect(screen.getByTestId('row-staff-charge')).toHaveTextContent('₹9,600');
      expect(screen.getByTestId('row-credit')).toHaveTextContent('− ₹1,500');
      await fireEvent.changeText(screen.getByTestId('coupon-input'), 'SAVE10');
      await fireEvent.press(screen.getByTestId('coupon-apply'));
      await screen.findByText('SAVE10 (10% off)');
      expect(screen.getByText('Coupon Discount (10% on ₹8,100)')).toBeTruthy();
      expect(screen.getByTestId('row-discount')).toHaveTextContent('- ₹810');
      expect(screen.getByTestId('row-subtotal')).toHaveTextContent('₹7,290');
      expect(screen.getByTestId('row-gst')).toHaveTextContent('₹1,312');
      expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,602');
      await fireEvent.press(screen.getByTestId('pay-button'));
      await screen.findByText('Payment Successful!');
      expect(mockApi.createOrder).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-1', planId: 22, amount: 8602, staffLimit: 20, couponCode: 'SAVE10', mode: 'new' });
    });

    it('plan change over an expired plan gets no credit', async () => {
      mockParams = { mode: 'new', planId: '22', staff: '20' };
      mockApi.getSubscription.mockResolvedValue({ ...activeCore, endDate: '2020-01-01' });
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      expect(screen.queryByTestId('row-credit')).toBeNull();
      expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹11,328'); // 9,600 + 1,728 GST
    });

    it('a credit larger than the charge floors every amount at ₹0 and the pay button stays disabled', async () => {
      mockParams = { mode: 'new', planId: '30', staff: '12' };
      mockApi.listPlans.mockResolvedValue([...catalogue, { id: 30, name: 'prime', amount: 40, months: 1 }]);
      mockApi.getSubscription.mockResolvedValue({ ...activeCore, planAmount: 100, planMonths: 12 }); // credit 10 × 100 × 12 = 12,000 > 12 × 40 × 1
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      expect(screen.getByTestId('row-credit')).toHaveTextContent('− ₹12,000');
      for (const id of ['row-subtotal', 'row-gst', 'row-grand-total']) expect(screen.getByTestId(id)).toHaveTextContent('₹0');
      expect(screen.getByText('Pay ₹0')).toBeTruthy();
      expect(screen.getByTestId('pay-button')).toBeDisabled();
    });

    it('renewal: 10 staff × current ₹25 × 12 months = ₹3,000 + GST ₹540; the order carries the CURRENT plan id and the coupon box is offered', async () => {
      mockParams = { mode: 'renew' };
      mockApi.getSubscription.mockResolvedValue(activeCore);
      mockApi.createOrder.mockResolvedValue({ ...order, amount: 3540 });
      await renderScreen(<CheckoutScreen />);
      expect(await screen.findByText('Core Plan')).toBeTruthy();
      expect(screen.getByText('RENEWING')).toBeTruthy();
      expect(screen.getByText('10 staff × ₹25/staff × 12 months')).toBeTruthy();
      expect(screen.getByText('Valid till 10 Feb 2100')).toBeTruthy();
      expect(screen.queryByTestId('row-credit')).toBeNull();
      expect(screen.getByTestId('coupon-section')).toBeTruthy();
      expect(screen.getByTestId('row-gst')).toHaveTextContent('₹540');
      expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹3,540');
      await fireEvent.press(screen.getByTestId('pay-button'));
      await screen.findByText('Payment Successful!');
      expect(mockApi.createOrder).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-1', planId: 2, amount: 3540, staffLimit: 10, couponCode: null, mode: 'renew' });
    });

    it('staff-only upgrade 12 → 20 with 4 whole months left @ ₹40: only the 8 extra staff are charged (₹1,280 + GST ₹230 = ₹1,510), no credit, no coupon', async () => {
      const endIn4Months = addMonthsStr(todayIST(), 4);
      mockParams = { mode: 'upgrade', staff: '20' };
      mockApi.getSubscription.mockResolvedValue({ ...activeCore, planId: 3, planName: 'Prime', planAmount: 40, planMonths: 12, endDate: endIn4Months });
      mockApi.createOrder.mockResolvedValue({ ...order, amount: 1510 });
      await renderScreen(<CheckoutScreen />);
      expect(await screen.findByText('8 extra staff × ₹40/staff × 4 months')).toBeTruthy();
      expect(screen.getByText('ADD STAFF')).toBeTruthy();
      expect(screen.getByText('8 Staff')).toBeTruthy();
      expect(screen.queryByTestId('row-credit')).toBeNull();
      expect(screen.queryByTestId('coupon-section')).toBeNull();
      expect(screen.getByTestId('row-staff-charge')).toHaveTextContent('₹1,280');
      expect(screen.getByTestId('row-gst')).toHaveTextContent('₹230');
      expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹1,510');
      await fireEvent.press(screen.getByTestId('pay-button'));
      await screen.findByText('Payment Successful!');
      expect(mockApi.createOrder).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-1', planId: 3, amount: 1510, staffLimit: 8, couponCode: null, mode: 'upgrade' });
    });
  });

  describe('server quote (POST /orders/quote): the screen shows what the server will charge', () => {
    const base = {
      mode: 'new', planId: 22, planName: 'prime', pricePerStaffMonth: 40, chargedStaff: 15, chargedMonths: 12, termMonths: 12,
      staffCharge: 7200, credit: 0, afterCredit: 7200, couponCode: null, couponApplied: false, couponMessage: null, discountPercent: null,
      discountAmount: 0, subtotal: 7200, gstPercent: 18, gst: 1296, grandTotal: 8496, amountPaise: 849600, currency: 'INR',
      validFrom: '2026-11-02', validTill: '2027-11-02', resultingStaffLimit: 15, payable: true,
    };
    const flat = { ...base, couponCode: 'FLAT500', couponApplied: true, discountAmount: 500, subtotal: 6700, gst: 1206, grandTotal: 7906, amountPaise: 790600 };

    it('a flat coupon shows the server discount and total, and the order is created with that total', async () => {
      mockApi.quote.mockImplementation(async (input: { couponCode?: string | null }) => (input.couponCode?.toUpperCase() === 'FLAT500' ? flat : base));
      mockApi.createOrder.mockResolvedValue({ ...order, amount: 7906 });
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      await waitFor(() => expect(mockApi.quote).toHaveBeenCalledWith(expect.objectContaining({ planId: 22, staffLimit: 15, mode: 'new', couponCode: null }), expect.anything()));
      await fireEvent.changeText(screen.getByTestId('coupon-input'), 'flat500');
      await fireEvent.press(screen.getByTestId('coupon-apply'));
      expect(await screen.findByText('FLAT500 (₹500 off)')).toBeTruthy();
      expect(mockApi.validateCoupon).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹7,906'));
      expect(screen.getByTestId('row-discount')).toHaveTextContent('- ₹500');
      expect(screen.getByText('Coupon Discount (FLAT500)')).toBeTruthy();
      expect(screen.getByTestId('row-subtotal')).toHaveTextContent('₹6,700');
      expect(screen.getByTestId('row-gst')).toHaveTextContent('₹1,206');
      expect(screen.getByText('Pay ₹7,906')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('pay-button'));
      await screen.findByText('Payment Successful!');
      expect(mockApi.createOrder).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-1', planId: 22, amount: 7906, staffLimit: 15, couponCode: 'FLAT500', mode: 'new' });
    });

    it('the server verdict decides the coupon box: an unusable code shows the server message and applies nothing', async () => {
      mockApi.quote.mockImplementation(async (input: { couponCode?: string | null }) =>
        input.couponCode ? { ...base, couponCode: input.couponCode, couponMessage: 'This coupon needs a minimum order of Rs 10,000' } : base,
      );
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      await fireEvent.changeText(screen.getByTestId('coupon-input'), 'BIG10K');
      await fireEvent.press(screen.getByTestId('coupon-apply'));
      expect(await screen.findByText('This coupon needs a minimum order of Rs 10,000')).toBeTruthy();
      expect(screen.queryByTestId('coupon-badge')).toBeNull();
      expect(screen.queryByTestId('row-discount')).toBeNull();
      expect(mockApi.validateCoupon).not.toHaveBeenCalled();
    });

    it('server numbers replace the local ones (no coupon): breakdown, validity and the posted amount', async () => {
      const q = { ...base, staffCharge: 7500, afterCredit: 7500, subtotal: 7500, gst: 1350, grandTotal: 8850, validTill: '2027-12-31' };
      mockApi.quote.mockResolvedValue(q);
      mockApi.createOrder.mockResolvedValue({ ...order, amount: 8850 });
      await renderScreen(<CheckoutScreen />);
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,850'));
      expect(screen.getByTestId('row-staff-charge')).toHaveTextContent('₹7,500');
      expect(screen.getByText('Valid till 31 Dec 2027')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('pay-button'));
      await screen.findByText('Payment Successful!');
      expect(mockApi.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 8850 }));
    });

    it('an applied coupon the server later refuses is flagged and blocks the order with the server message', async () => {
      mockApi.checkFirstPayment.mockResolvedValue(true);
      mockApi.getFirstCoupon.mockResolvedValue({ id: 5, name: 'WELCOME10', discountPercent: 10 });
      mockApi.quote.mockResolvedValue({ ...base, couponCode: 'WELCOME10', couponMessage: 'This coupon is not valid for the selected plan' });
      await renderScreen(<CheckoutScreen />);
      await fireEvent.press(await screen.findByTestId('welcome-close'));
      expect(await screen.findByTestId('coupon-notice')).toHaveTextContent('This coupon is not valid for the selected plan');
      await fireEvent.press(screen.getByTestId('pay-button'));
      expect((await screen.findAllByText('This coupon is not valid for the selected plan')).length).toBe(2); // notice + toast
      expect(mockApi.createOrder).not.toHaveBeenCalled();
    });

    it('without a quote route the percent validation and local totals are used (fallback)', async () => {
      mockApi.quote.mockResolvedValue(null);
      mockApi.validateCoupon.mockResolvedValue({ id: 1, name: 'SAVE10', discountPercent: 10 });
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      await fireEvent.changeText(screen.getByTestId('coupon-input'), 'save10');
      await fireEvent.press(screen.getByTestId('coupon-apply'));
      expect(await screen.findByText('SAVE10 (10% off)')).toBeTruthy();
      expect(mockApi.validateCoupon).toHaveBeenCalledWith('save10');
      expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹7,646');
    });
  });

  describe('referral reward (apply_referral) next to the coupon box', () => {
    const offer = { availableCount: 2, eligible: true, percent: 10, message: null };
    const base = {
      mode: 'new', planId: 22, planName: 'prime', pricePerStaffMonth: 40, chargedStaff: 15, chargedMonths: 12, termMonths: 12,
      staffCharge: 7200, credit: 0, afterCredit: 7200, couponCode: null, couponApplied: false, couponMessage: null, discountPercent: null,
      discountAmount: 0, subtotal: 7200, gstPercent: 18, gst: 1296, grandTotal: 8496, amountPaise: 849600, currency: 'INR',
      validFrom: '2026-11-02', validTill: '2027-11-02', resultingStaffLimit: 15, payable: true,
      referralApplied: false, referralPercent: 10, referralMessage: null, referral: offer,
    };
    const withReward = { ...base, discountPercent: 10, discountAmount: 720, subtotal: 6480, gst: 1166, grandTotal: 7646, referralApplied: true };
    const couponQuote = { ...base, couponCode: 'SAVE10', couponApplied: true, discountPercent: 10, discountAmount: 720, subtotal: 6480, gst: 1166, grandTotal: 7646 };
    const coreMessage = 'Referral rewards are valid on Prime and Elite plans only';
    type QuoteInput = { applyReferral?: boolean; couponCode?: string | null };
    const lastQuoteInput = (): QuoteInput => mockApi.quote.mock.calls[mockApi.quote.mock.calls.length - 1][0] as QuoteInput;
    const everyQuote = (check: (i: QuoteInput) => boolean): boolean => mockApi.quote.mock.calls.every((c) => check(c[0] as QuoteInput));

    /** A server that prices the reward (10 %), or refuses it when `eligible` is false. */
    function serverWith(over: { eligible?: boolean; count?: number } = {}) {
      const eligible = over.eligible ?? true;
      const ref = { ...offer, eligible, availableCount: over.count ?? 2, message: eligible ? null : coreMessage };
      mockApi.quote.mockImplementation(async (input: QuoteInput) => {
        if (input.couponCode) return { ...couponQuote, couponCode: input.couponCode, referral: ref };
        if (input.applyReferral) return eligible ? { ...withReward, referral: ref } : { ...base, referral: ref, referralMessage: coreMessage };
        return { ...base, referral: ref };
      });
    }

    it('shows the reward card beside the coupon box with the count; Apply discounts 10 % from the server quote, Remove restores it', async () => {
      serverWith();
      await renderScreen(<CheckoutScreen />);
      expect(await screen.findByTestId('referral-reward-card')).toBeTruthy();
      expect(screen.getByTestId('coupon-section')).toBeTruthy();
      expect(screen.getByTestId('referral-title')).toHaveTextContent('Referral reward — 10% off');
      expect(screen.getByTestId('referral-available')).toHaveTextContent('2 available');
      expect(screen.getByTestId('referral-apply')).toBeEnabled();
      expect(screen.queryByTestId('row-referral-discount')).toBeNull();
      await fireEvent.press(screen.getByTestId('referral-apply'));
      expect(await screen.findByTestId('referral-remove')).toBeTruthy();
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹7,646'));
      expect(screen.getByText('Referral reward (10%)')).toBeTruthy();
      expect(screen.getByTestId('row-referral-discount')).toHaveTextContent('− ₹720');
      expect(screen.getByTestId('row-subtotal')).toHaveTextContent('₹6,480');
      expect(screen.getByTestId('referral-applied')).toHaveTextContent(/Applied ✓/);
      expect(screen.getByText('Pay ₹7,646')).toBeTruthy();
      expect(lastQuoteInput()).toMatchObject({ applyReferral: true, couponCode: null });
      await fireEvent.press(screen.getByTestId('referral-remove'));
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,496'));
      expect(screen.queryByTestId('row-referral-discount')).toBeNull();
      expect(screen.getByTestId('referral-apply')).toBeTruthy();
      await waitFor(() => expect(lastQuoteInput().applyReferral).toBe(false));
    });

    it('Pay creates the order with apply_referral and NO coupon, for the server total', async () => {
      serverWith();
      mockApi.createOrder.mockResolvedValue({ ...order, amount: 7646 });
      await renderScreen(<CheckoutScreen />);
      await fireEvent.press(await screen.findByTestId('referral-apply'));
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹7,646'));
      await fireEvent.press(screen.getByTestId('pay-button'));
      await screen.findByText('Payment Successful!');
      expect(mockApi.createOrder).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-1', planId: 22, amount: 7646, staffLimit: 15, couponCode: null, mode: 'new', applyReferral: true });
    });

    it('without a reward the order carries no apply_referral flag', async () => {
      serverWith();
      await renderScreen(<CheckoutScreen />);
      await screen.findByTestId('referral-apply');
      await fireEvent.press(screen.getByTestId('pay-button'));
      await screen.findByText('Payment Successful!');
      expect(mockApi.createOrder.mock.calls[0][0]).not.toHaveProperty('applyReferral');
    });

    it('renewals offer the reward too', async () => {
      serverWith();
      mockParams = { mode: 'renew' };
      mockApi.getSubscription.mockResolvedValue({ ...noPlanSub, planId: 2, planName: 'Prime', planAmount: 40, planMonths: 12, startDate: '2026-08-01', endDate: '2099-02-10', staffLimit: 12, status: 'ACTIVE' });
      await renderScreen(<CheckoutScreen />);
      expect(await screen.findByTestId('referral-reward-card')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('referral-apply'));
      await waitFor(() => expect(mockApi.quote).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'renew', applyReferral: true }), expect.anything()));
    });

    it('Core (not eligible): the card is disabled and shows the server reason; nothing can be applied', async () => {
      serverWith({ eligible: false });
      await renderScreen(<CheckoutScreen />);
      expect(await screen.findByTestId('referral-reward-card')).toBeTruthy();
      expect(screen.getByTestId('referral-apply')).toBeDisabled();
      expect(screen.getByTestId('referral-message')).toHaveTextContent(coreMessage);
      await fireEvent.press(screen.getByTestId('referral-apply'));
      expect(everyQuote((i) => !i.applyReferral)).toBe(true);
      expect(screen.queryByTestId('referral-remove')).toBeNull();
    });

    it('a reward the server refuses once requested (plan switched to Core) is dropped with the server message', async () => {
      mockApi.quote.mockImplementation(async (input: QuoteInput) =>
        input.applyReferral ? { ...base, referralMessage: coreMessage, referral: { ...offer, eligible: false, message: coreMessage } } : { ...base },
      );
      await renderScreen(<CheckoutScreen />);
      await fireEvent.press(await screen.findByTestId('referral-apply'));
      expect(await screen.findByTestId('referral-note')).toHaveTextContent(coreMessage);
      expect(screen.queryByTestId('referral-remove')).toBeNull();
      expect(screen.queryByTestId('row-referral-discount')).toBeNull();
      await waitFor(() => expect(lastQuoteInput().applyReferral).toBe(false));
      expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,496');
    });

    it("applying a reward removes the coupon (with the \"can't be combined\" note); applying a coupon removes the reward", async () => {
      serverWith();
      mockApi.validateCoupon.mockResolvedValue({ id: 1, name: 'SAVE10', discountPercent: 10 });
      await renderScreen(<CheckoutScreen />);
      await screen.findByTestId('referral-apply');
      // coupon first, then the reward: the coupon goes
      await fireEvent.changeText(screen.getByTestId('coupon-input'), 'save10');
      await fireEvent.press(screen.getByTestId('coupon-apply'));
      expect(await screen.findByTestId('coupon-badge')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('referral-apply'));
      expect(await screen.findByTestId('referral-remove')).toBeTruthy();
      expect(screen.queryByTestId('coupon-badge')).toBeNull();
      expect(screen.getByTestId('referral-note')).toHaveTextContent("A coupon and a referral reward can't be combined");
      await waitFor(() => expect(lastQuoteInput()).toMatchObject({ applyReferral: true, couponCode: null }));
      // now a coupon: the reward goes
      await fireEvent.changeText(screen.getByTestId('coupon-input'), 'save10');
      await fireEvent.press(screen.getByTestId('coupon-apply'));
      expect(await screen.findByTestId('coupon-badge')).toBeTruthy();
      await waitFor(() => expect(screen.queryByTestId('referral-remove')).toBeNull());
      expect(screen.getByTestId('referral-apply')).toBeTruthy();
      expect(screen.getByTestId('referral-note')).toHaveTextContent("A coupon and a referral reward can't be combined");
      await waitFor(() => expect(lastQuoteInput()).toMatchObject({ applyReferral: false, couponCode: 'save10' }));
      expect(screen.queryByTestId('row-referral-discount')).toBeNull();
      // the coupon was previewed WITHOUT the reward
      expect(mockApi.quote.mock.calls.some((c) => (c[0] as QuoteInput).couponCode === 'save10' && (c[0] as QuoteInput).applyReferral === false)).toBe(true);
      // removing the coupon clears the stale note
      await fireEvent.press(screen.getByTestId('coupon-remove'));
      await waitFor(() => expect(screen.queryByTestId('referral-note')).toBeNull());
    });

    it('is hidden when no reward is available', async () => {
      serverWith({ count: 0 });
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      await waitFor(() => expect(mockApi.quote).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,496'));
      await screen.findByTestId('coupon-section');
      expect(screen.queryByTestId('referral-reward-card')).toBeNull();
    });

    it('is hidden when the server sends no referral block (older server)', async () => {
      mockApi.quote.mockImplementation(async () => ({ ...base, referral: null }));
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      await waitFor(() => expect(mockApi.quote).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,496'));
      expect(screen.queryByTestId('referral-reward-card')).toBeNull();
    });

    it('capacity upgrades show no reward card and never ask for one', async () => {
      serverWith();
      mockParams = { mode: 'upgrade', staff: '20' };
      mockApi.getSubscription.mockResolvedValue({ ...noPlanSub, planId: 3, planName: 'Prime', planAmount: 40, planMonths: 12, endDate: '2099-02-10', staffLimit: 12, status: 'ACTIVE' });
      await renderScreen(<CheckoutScreen />);
      await screen.findByTestId('price-breakdown');
      await waitFor(() => expect(mockApi.quote).toHaveBeenCalled());
      expect(screen.queryByTestId('referral-reward-card')).toBeNull();
      expect(everyQuote((i) => !i.applyReferral)).toBe(true);
    });

    it('without a quote route (local pricing) there is no reward card', async () => {
      mockApi.quote.mockResolvedValue(null);
      await renderScreen(<CheckoutScreen />);
      await screen.findByText('Prime Plan');
      expect(screen.queryByTestId('referral-reward-card')).toBeNull();
      expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,496');
    });

    it('create answers 400 (plain-text detail, no readable code): the message is shown, the reward is dropped and the quote refreshed', async () => {
      serverWith();
      mockApi.createOrder.mockRejectedValue(
        new ApiError({ status: 400, detail: 'No referral reward available', raw: { detail: 'No referral reward available' } }),
      );
      await renderScreen(<CheckoutScreen />);
      await fireEvent.press(await screen.findByTestId('referral-apply'));
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹7,646'));
      await fireEvent.press(screen.getByTestId('pay-button'));
      expect((await screen.findAllByText('No referral reward available')).length).toBeGreaterThanOrEqual(1);
      expect(mockOpenCheckout).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByTestId('referral-remove')).toBeNull());
      await waitFor(() => expect(lastQuoteInput().applyReferral).toBe(false));
      await waitFor(() => expect(screen.getByTestId('row-grand-total')).toHaveTextContent('₹8,496'));
      await waitFor(() => expect(screen.getByTestId('pay-button')).toBeEnabled());
    });

    it('Pay right after Apply asks the server first: a reward it will not price blocks the order with its message', async () => {
      mockApi.quote.mockImplementation(async (input: QuoteInput) =>
        input.applyReferral ? { ...base, referralMessage: 'No referral reward available', referral: { ...offer, availableCount: 0, eligible: false, message: 'No referral reward available' } } : { ...base },
      );
      await renderScreen(<CheckoutScreen />);
      await fireEvent.press(await screen.findByTestId('referral-apply'));
      await fireEvent.press(screen.getByTestId('pay-button'));
      expect((await screen.findAllByText('No referral reward available')).length).toBeGreaterThanOrEqual(1);
      expect(mockApi.createOrder).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByTestId('referral-remove')).toBeNull());
    });
  });

  it('iOS shows no payment UI', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderScreen(<CheckoutScreen />);
    expect(await screen.findByTestId('purchase-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('pay-button')).toBeNull();
    expect(mockApi.checkFirstPayment).not.toHaveBeenCalled();
  });
});
