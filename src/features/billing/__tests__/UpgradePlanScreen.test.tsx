import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { routes } from '@/config/routes';
import type { Plan, Subscription } from '@/types/api/plans';

import UpgradePlanScreen from '../screens/UpgradePlanScreen';
import { renderScreen, signInTestAdmin } from './testHelpers';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
    back: () => mockBack(),
    canGoBack: () => true,
    dismissAll: jest.fn(),
  }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => mockParams,
}));

const mockApi = { getSubscription: jest.fn(), listPlans: jest.fn(), quote: jest.fn() };
jest.mock('@/api', () => ({
  plansApi: {
    getSubscription: (...a: unknown[]) => mockApi.getSubscription(...a),
    listPlans: (...a: unknown[]) => mockApi.listPlans(...a),
  },
  billingApi: {
    quote: (...a: unknown[]) => mockApi.quote(...a),
  },
}));

const coreSub: Subscription = {
  planId: 2,
  planName: 'Core',
  planAmount: 25,
  planMonths: 6,
  startDate: '2026-08-01',
  endDate: '2099-02-10',
  staffLimit: 12,
  status: 'ACTIVE',
  isExpired: false,
  isFreeTrial: false,
  freeTrialEnd: null,
  billingDate: null,
  raw: {},
};
const catalogue: Plan[] = [
  { id: 2, name: 'Core', amount: 25, months: 6 },
  { id: 22, name: 'Prime', amount: 40, months: 12 },
];

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  signInTestAdmin();
  mockParams = { mode: 'new', planId: '22' };
  mockApi.getSubscription.mockResolvedValue(coreSub);
  mockApi.listPlans.mockResolvedValue(catalogue);
  mockApi.quote.mockResolvedValue(null); // no quote route: the local estimate is shown
  jest.replaceProperty(Platform, 'OS', 'android');
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

describe('UpgradePlanScreen', () => {
  it('buy / change plan: banners, live staff limit as the minimum, credit and "You pay"', async () => {
    await renderScreen(<UpgradePlanScreen />);
    expect(await screen.findByText('Upgrading to: Prime')).toBeTruthy();
    expect(screen.getByText('Current: Core')).toBeTruthy();
    expect(screen.getByText('NEW')).toBeTruthy();
    expect(screen.getByText('1 Year')).toBeTruthy();
    expect(screen.getByTestId('staff-value')).toHaveTextContent('12');
    expect(screen.getByTestId('staff-hint')).toHaveTextContent('Current: 12 · Min 12 · Unlimited');
    // 12 × ₹40 × 12 = 5,760 − credit 10 × ₹25 × 6 = 1,500 → ₹4,260
    expect(screen.getByTestId('cost-box')).toHaveTextContent(/12 × ₹40 × 12m = ₹5,760/);
    expect(screen.getByTestId('cost-box')).toHaveTextContent(/You pay₹4,260/);
    // the stepper cannot go below the current limit when changing plan
    expect(screen.getByTestId('staff-minus')).toBeDisabled();
  });

  it('plus raises the price and Continue to Pay hands mode, plan and staff to the checkout', async () => {
    await renderScreen(<UpgradePlanScreen />);
    await screen.findByText('Upgrading to: Prime');
    await fireEvent.press(screen.getByTestId('staff-plus'));
    expect(screen.getByTestId('staff-value')).toHaveTextContent('13');
    expect(screen.getByTestId('cost-box')).toHaveTextContent(/13 × ₹40 × 12m = ₹6,240/);
    await fireEvent.press(screen.getByTestId('continue-pay'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.billing.checkout, params: { mode: 'new', planId: '22', staff: '13' } });
  });

  it('typing a staff count below the minimum snaps to the minimum', async () => {
    await renderScreen(<UpgradePlanScreen />);
    await screen.findByText('Upgrading to: Prime');
    await fireEvent.press(screen.getByTestId('staff-value'));
    await fireEvent.changeText(await screen.findByTestId('staff-input'), '5');
    await fireEvent.press(screen.getByTestId('staff-apply'));
    expect(screen.getByTestId('staff-value')).toHaveTextContent('12');
  });

  it('capacity upgrade: the button is disabled until staff exceeds the current limit, then charges only the extra staff', async () => {
    mockParams = { mode: 'upgrade' };
    await renderScreen(<UpgradePlanScreen />);
    expect(await screen.findByText('Current Plan: Core')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    expect(screen.queryByText('Duration')).toBeNull();
    expect(screen.getByText('Add Staff to Continue')).toBeTruthy();
    expect(screen.getByTestId('continue-pay')).toBeDisabled();
    // mode B: stepper starts at the live limit (12) but the hint / minimum are the v1 defaults (no "Current:" part)
    expect(screen.getByTestId('staff-value')).toHaveTextContent('12');
    expect(screen.getByTestId('staff-hint')).toHaveTextContent(/^Min 10 · Unlimited$/);
    await fireEvent.press(screen.getByTestId('staff-plus'));
    expect(screen.getByText('Continue to Pay')).toBeTruthy();
    expect(screen.getByTestId('continue-pay')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('continue-pay'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.billing.checkout, params: { mode: 'upgrade', planId: '2', staff: '13' } });
  });

  it('renew starts at 10 staff for 12 months with no credit', async () => {
    mockParams = { mode: 'renew' };
    await renderScreen(<UpgradePlanScreen />);
    expect(await screen.findByText('Renewing: Core')).toBeTruthy();
    expect(screen.getByText('RENEW')).toBeTruthy();
    expect(screen.getByTestId('staff-value')).toHaveTextContent('10');
    expect(screen.getByTestId('staff-hint')).toHaveTextContent(/^Min 10 · Unlimited$/);
    expect(screen.getByTestId('cost-box')).toHaveTextContent(/10 × ₹25 × 12m = ₹3,000/);
  });

  it('upgrade / renew are locked during a free trial: "Buy a Plan" goes to the subscription, "Close" goes back', async () => {
    mockParams = { mode: 'renew' };
    mockApi.getSubscription.mockResolvedValue({ ...coreSub, planId: null, planName: 'Free Trial', planAmount: null, planMonths: null, startDate: null, endDate: '2099-01-01', isFreeTrial: true, freeTrialEnd: '2099-01-01', staffLimit: 10 });
    await renderScreen(<UpgradePlanScreen />);
    expect(await screen.findByText('Not Available During Free Trial')).toBeTruthy();
    expect(screen.getByText(/This page is locked until your free trial ends on 01 Jan 2099/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('trial-buy'));
    expect(mockReplace).toHaveBeenCalledWith(routes.admin.billing.overview);
    await fireEvent.press(screen.getByTestId('trial-close'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('buying during a trial is allowed (no block)', async () => {
    mockApi.getSubscription.mockResolvedValue({ ...coreSub, planId: null, planName: 'Free Trial', planAmount: null, planMonths: null, startDate: null, endDate: '2099-01-01', isFreeTrial: true, freeTrialEnd: '2099-01-01', staffLimit: 10 });
    await renderScreen(<UpgradePlanScreen />);
    expect(await screen.findByText('Upgrading to: Prime')).toBeTruthy();
    expect(screen.queryByText('Not Available During Free Trial')).toBeNull();
    expect(screen.getByTestId('cost-box')).toHaveTextContent(/Credit \(current plan\)₹0/);
  });

  it('iOS only shows the read-only plan status', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderScreen(<UpgradePlanScreen />);
    expect(await screen.findByTestId('purchase-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('continue-pay')).toBeNull();
  });

  it('unknown plan id shows an empty state', async () => {
    mockParams = { mode: 'new', planId: '999' };
    await renderScreen(<UpgradePlanScreen />);
    expect(await screen.findByText('Plan not found')).toBeTruthy();
    expect(mockApi.quote).not.toHaveBeenCalled();
  });

  describe('server quote (POST /orders/quote): the estimate is what the server will charge', () => {
    // Deliberately different from the local numbers (5,760 / credit 1,500 / 4,260) so the source is visible.
    const serverNew = {
      mode: 'new', planId: 22, planName: 'Prime', pricePerStaffMonth: 40, chargedStaff: 12, chargedMonths: 12, termMonths: 12,
      staffCharge: 5500, credit: 1200, afterCredit: 4300, couponCode: null, couponApplied: false, couponMessage: null, discountPercent: null,
      discountAmount: 0, subtotal: 4300, gstPercent: 18, gst: 774, grandTotal: 5074, amountPaise: 507400, currency: 'INR',
      validFrom: '2026-11-02', validTill: '2027-11-02', resultingStaffLimit: 12, payable: true,
    };

    it('shows the server charge, credit and "You pay" instead of the local estimate (no coupon is sent)', async () => {
      mockApi.quote.mockResolvedValue(serverNew);
      await renderScreen(<UpgradePlanScreen />);
      await screen.findByText('Upgrading to: Prime');
      await waitFor(() => expect(screen.getByTestId('cost-box')).toHaveTextContent(/You pay₹4,300/));
      expect(screen.getByTestId('cost-box')).toHaveTextContent(/₹5,500/);
      expect(screen.getByTestId('cost-box')).toHaveTextContent(/− ₹1,200/);
      expect(screen.getByTestId('cost-box')).not.toHaveTextContent(/₹4,260/);
      expect(mockApi.quote).toHaveBeenCalledWith(expect.objectContaining({ planId: 22, staffLimit: 12, mode: 'new', couponCode: null }), expect.anything());
      expect(screen.getByText(/Valid till 02 Nov 2027/)).toBeTruthy();
    });

    it('keeps the local estimate when the quote is unavailable (null)', async () => {
      mockApi.quote.mockResolvedValue(null);
      await renderScreen(<UpgradePlanScreen />);
      await screen.findByText('Upgrading to: Prime');
      await waitFor(() => expect(mockApi.quote).toHaveBeenCalled());
      expect(screen.getByTestId('cost-box')).toHaveTextContent(/12 × ₹40 × 12m = ₹5,760/);
      expect(screen.getByTestId('cost-box')).toHaveTextContent(/You pay₹4,260/);
    });

    it('a staff change asks for a new (debounced) quote and the server number follows; Continue to Pay still hands over the local selection', async () => {
      mockApi.quote.mockImplementation(async (input: { staffLimit: number }) =>
        input.staffLimit === 13 ? { ...serverNew, chargedStaff: 13, staffCharge: 6000, afterCredit: 4800 } : serverNew,
      );
      await renderScreen(<UpgradePlanScreen />);
      await screen.findByText('Upgrading to: Prime');
      await waitFor(() => expect(screen.getByTestId('cost-box')).toHaveTextContent(/You pay₹4,300/));
      await fireEvent.press(screen.getByTestId('staff-plus'));
      // the stepper is immediate; until the quote for 13 arrives the local estimate stands in
      expect(screen.getByTestId('staff-value')).toHaveTextContent('13');
      await waitFor(() => expect(screen.getByTestId('cost-box')).toHaveTextContent(/You pay₹4,800/));
      expect(mockApi.quote).toHaveBeenLastCalledWith(expect.objectContaining({ staffLimit: 13 }), expect.anything());
      await fireEvent.press(screen.getByTestId('continue-pay'));
      expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.billing.checkout, params: { mode: 'new', planId: '22', staff: '13' } });
    });

    it('capacity upgrade: quotes only the extra staff, and nothing while there is none to add', async () => {
      mockParams = { mode: 'upgrade' };
      mockApi.quote.mockResolvedValue({ ...serverNew, mode: 'upgrade', planId: 2, chargedStaff: 1, chargedMonths: 5, staffCharge: 130, afterCredit: 130 });
      await renderScreen(<UpgradePlanScreen />);
      await screen.findByText('Current Plan: Core');
      expect(mockApi.quote).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByTestId('staff-plus'));
      await waitFor(() => expect(screen.getByTestId('cost-box')).toHaveTextContent(/= ₹130/));
      expect(mockApi.quote).toHaveBeenCalledWith(expect.objectContaining({ planId: 2, staffLimit: 1, mode: 'upgrade', couponCode: null }), expect.anything());
      await fireEvent.press(screen.getByTestId('continue-pay'));
      expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.billing.checkout, params: { mode: 'upgrade', planId: '2', staff: '13' } });
    });
  });
});
