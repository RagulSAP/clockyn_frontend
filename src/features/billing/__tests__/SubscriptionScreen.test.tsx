import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { routes } from '@/config/routes';
import type { Plan, Subscription } from '@/types/api/plans';

import SubscriptionScreen from '../screens/SubscriptionScreen';
import { renderScreen, signInTestAdmin } from './testHelpers';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
}));

const mockApi = {
  getSubscription: jest.fn(),
  listPlans: jest.fn(),
  getAllStaff: jest.fn(),
};
jest.mock('@/api', () => ({
  plansApi: {
    getSubscription: (...a: unknown[]) => mockApi.getSubscription(...a),
    listPlans: (...a: unknown[]) => mockApi.listPlans(...a),
  },
  homeApi: { getAllStaff: (...a: unknown[]) => mockApi.getAllStaff(...a) },
}));

const paidSub: Subscription = {
  planId: 3,
  planName: 'Prime',
  planAmount: 40,
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
  { id: 1, name: 'Core', amount: 25, months: 1 },
  { id: 2, name: 'Core', amount: 22, months: 12 },
  { id: 3, name: 'Prime', amount: 40, months: 6 },
  { id: 4, name: 'Prime', amount: 35, months: 12 },
];

const originalOS = Platform.OS;
const setOS = (os: string) => jest.replaceProperty(Platform, 'OS', os as typeof Platform.OS);

beforeEach(() => {
  jest.clearAllMocks();
  signInTestAdmin();
  mockApi.getSubscription.mockResolvedValue(paidSub);
  mockApi.listPlans.mockResolvedValue(catalogue);
  mockApi.getAllStaff.mockResolvedValue([{}, {}, {}, {}, {}]);
  setOS('android');
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

describe('SubscriptionScreen', () => {
  it('shows the active plan, validity, staff capacity and the billing actions', async () => {
    await renderScreen(<SubscriptionScreen />);
    expect(await screen.findByText('Prime')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    expect(screen.getByText('Your subscription is active and running')).toBeTruthy();
    expect(screen.getByText('Billing Actions')).toBeTruthy();
    for (const label of ['Plan Details', 'Upgrade Plan', 'Renew Plan', 'Download Invoices']) expect(screen.getByText(label)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('meta-Used Staff')).toHaveTextContent('5'));
    expect(screen.getByTestId('meta-Staff Limit')).toHaveTextContent('12');
    expect(screen.getByTestId('meta-Remaining')).toHaveTextContent('7');
  });

  it('Upgrade and Renew open the configurator in the matching mode; invoices open the invoice list', async () => {
    await renderScreen(<SubscriptionScreen />);
    await screen.findByText('Prime');
    await fireEvent.press(screen.getByTestId('action-upgrade'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: routes.admin.billing.upgrade, params: { mode: 'upgrade' } });
    await fireEvent.press(screen.getByTestId('action-renew'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: routes.admin.billing.upgrade, params: { mode: 'renew' } });
    await fireEvent.press(screen.getByTestId('action-invoices'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.billing.invoices);
  });

  it('Plan Details lists plans; a disabled downgrade tier explains why, an enabled tier offers Continue to Pay', async () => {
    await renderScreen(<SubscriptionScreen />);
    await screen.findByText('Prime');
    await fireEvent.press(screen.getByTestId('action-plan-details'));
    expect(await screen.findByText('Available Plans')).toBeTruthy();
    expect(screen.getByText('Core Plan')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tier-1')); // Core 1 month while Prime 6 months is active → downgrade
    expect(await screen.findByText('Downgrade Not Allowed')).toBeTruthy();
    await fireEvent.press(screen.getByText('Got it'));

    await fireEvent.press(screen.getByTestId('tier-4')); // Prime 12 months → allowed
    await fireEvent.press(await screen.findByTestId('continue-to-pay'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: routes.admin.billing.upgrade, params: { mode: 'new', planId: '4' } });
  });

  it('Plan Details shows every duration of a plan in a horizontal row with the free months and the saving', async () => {
    mockApi.getSubscription.mockResolvedValue({ ...paidSub, planId: null, planName: null, planAmount: null, planMonths: null, endDate: null, startDate: null });
    mockApi.listPlans.mockResolvedValue([
      { id: 1, name: 'Core', amount: 49, months: 1, freeMonths: 0, offerText: null },
      { id: 11, name: 'Core', amount: 49, months: 6, freeMonths: 1, offerText: null },
      { id: 12, name: 'Core', amount: 49, months: 12, freeMonths: 2, offerText: 'Pay 10, get 2 free' },
      { id: 2, name: 'Prime', amount: 99, months: 1, freeMonths: 0, offerText: null },
    ]);
    await renderScreen(<SubscriptionScreen />);
    await screen.findByText('NO PLAN');
    await fireEvent.press(screen.getByTestId('action-plan-details'));
    expect(await screen.findByText('Available Plans')).toBeTruthy();

    // one sideways-scrolling row per plan, every duration of that plan in it, ascending
    const row = screen.getByTestId('tier-scroll-core');
    expect(row.props.horizontal).toBe(true);
    expect(row.props.showsHorizontalScrollIndicator).toBe(false);
    expect(within(row).getAllByTestId(/^tier-\d+$/).map((n) => n.props.testID)).toEqual(['tier-1', 'tier-11', 'tier-12']);
    expect(within(screen.getByTestId('tier-scroll-prime')).getAllByTestId(/^tier-\d+$/)).toHaveLength(1);

    // 6 and 12 months show what they save; the 1 month tier shows nothing
    const six = within(screen.getByTestId('tier-11'));
    expect(six.getByText('6 Months')).toBeTruthy();
    expect(six.getByText('₹49')).toBeTruthy();
    expect(six.getByText('1 month free')).toBeTruthy();
    expect(six.getByText('Save ₹49/staff')).toBeTruthy();
    const year = within(screen.getByTestId('tier-12'));
    expect(year.getByText('1 Year')).toBeTruthy();
    expect(year.getByText('Pay 10, get 2 free')).toBeTruthy();
    expect(year.getByText('Save ₹98/staff')).toBeTruthy();
    expect(screen.queryByTestId('tier-offer-1')).toBeNull();
    expect(screen.getByTestId('tier-12').props.accessibilityLabel).toBe('1 Year ₹49 per staff per month, Pay 10, get 2 free, save ₹98 per staff');

    // choosing a longer tier still offers Continue to Pay for that exact tier
    await fireEvent.press(screen.getByTestId('tier-12'));
    await fireEvent.press(await screen.findByTestId('continue-to-pay'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: routes.admin.billing.upgrade, params: { mode: 'new', planId: '12' } });
  });

  it('a no-plan organisation is asked to select a plan first', async () => {
    mockApi.getSubscription.mockResolvedValue({ ...paidSub, planId: null, planName: null, planAmount: null, planMonths: null, endDate: null, startDate: null });
    await renderScreen(<SubscriptionScreen />);
    expect(await screen.findByText('NO PLAN')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('action-upgrade'));
    expect(await screen.findByText('Select a Plan First')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('iOS is view-only: status and billing history only', async () => {
    setOS('ios');
    await renderScreen(<SubscriptionScreen />);
    expect(await screen.findByText('Billing History')).toBeTruthy();
    expect(screen.queryByText('Upgrade Plan')).toBeNull();
    expect(screen.queryByText('Renew Plan')).toBeNull();
    expect(screen.queryByText('Plan Details')).toBeNull();
    expect(screen.queryByTestId('web-portal-link')).toBeNull();
  });

  it('iOS status card uses the v1 read-only wording (staff accounts, "Used", no billing dates)', async () => {
    setOS('ios');
    await renderScreen(<SubscriptionScreen />);
    expect(await screen.findByText('Valid till 10 Feb 2099 · 12 staff accounts')).toBeTruthy();
    expect(screen.getByTestId('meta-Used')).toBeTruthy();
    expect(screen.queryByText('Billing Date')).toBeNull();
    expect(screen.queryByText('Valid Until')).toBeNull();
  });

  it('iOS with no plan reads "No active plan"', async () => {
    setOS('ios');
    mockApi.getSubscription.mockResolvedValue({ ...paidSub, planId: null, planName: null, planAmount: null, planMonths: null, endDate: null, startDate: null });
    await renderScreen(<SubscriptionScreen />);
    expect(await screen.findByText('No active plan')).toBeTruthy();
  });

  it('shows a retryable error when the subscription cannot be loaded', async () => {
    mockApi.getSubscription.mockRejectedValueOnce(new Error('down')).mockResolvedValue(paidSub);
    await renderScreen(<SubscriptionScreen />);
    expect(await screen.findByText('We could not load your subscription.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Prime')).toBeTruthy();
  });
});
