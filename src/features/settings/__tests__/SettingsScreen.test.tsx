import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { routes } from '@/config/routes';

import SettingsScreen from '../screens/SettingsScreen';
import { renderScreen, signInTestAdmin } from './testHelpers';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
}));

const mockPlanStatus = jest.fn();
jest.mock('@/api/plans', () => ({ getOrgPlanStatus: (...a: unknown[]) => mockPlanStatus(...a) }));

const mockSignOut = jest.fn();
jest.mock('@/store/auth', () => ({ ...jest.requireActual('@/store/auth'), signOut: (...a: unknown[]) => mockSignOut(...a) }));

beforeEach(() => {
  jest.clearAllMocks();
  signInTestAdmin();
  mockSignOut.mockResolvedValue(undefined);
  mockPlanStatus.mockResolvedValue({ plan_id: 2, is_free_trial: false, is_expired: false });
});

describe('SettingsScreen', () => {
  it('renders every section in order under the company name, with Appearance', async () => {
    await renderScreen(<SettingsScreen />);
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Acme Traders')).toBeTruthy();
    const titles = ['Your Plan & Validity', 'Refer & Earn', 'Company Settings', 'Salary Structure', 'Attendance & Devices', 'View & Download Reports', 'Managers', 'Expenses & Allowances', 'Appearance', 'Beyond'];
    for (const t of titles) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.queryByText('Our Other Applications')).toBeNull();
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
  });

  it('plain rows navigate with typed routes (no payload params)', async () => {
    await renderScreen(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('section-header-plan'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.billing.overview);
    await fireEvent.press(screen.getByTestId('section-header-referral'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.referral);
    await fireEvent.press(screen.getByTestId('section-header-reports'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.reports.hub);
    await fireEvent.press(screen.getByTestId('section-header-roles'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.managers.list);
  });

  it('only one accordion is open at a time', async () => {
    await renderScreen(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('section-header-company'));
    expect(screen.getByText('View Company')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('section-header-attendance'));
    expect(screen.queryByText('View Company')).toBeNull();
    expect(screen.getByText('Shift Setting')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('item-shifts'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.shifts);
    await fireEvent.press(screen.getByTestId('section-header-attendance'));
    expect(screen.queryByText('Shift Setting')).toBeNull();
  });

  it('salary structure: nested incentive group, type picker and the "Coming soon" row', async () => {
    await renderScreen(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('section-header-salary'));
    for (const t of ['Monthly Fixed', 'Daily Wages', 'Hourly Calculation', 'Incentive / OT / Bonus', 'Fine / Deduction']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.queryByText('Overtime')).toBeNull();
    await fireEvent.press(screen.getByTestId('group-incentive-group'));
    await fireEvent.press(screen.getByTestId('item-overtime'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.payroll.overtime);

    await fireEvent.press(screen.getByTestId('item-incentive'));
    expect(await screen.findByText('Select Incentive Type')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('incentive-turnover'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.payroll.turnover);

    await fireEvent.press(screen.getByTestId('item-fine'));
    expect(await screen.findByText('Coming soon')).toBeTruthy();
  });

  it('salary structure is plan-gated: subtitle changes, tapping shows the subscribe toast and does not expand', async () => {
    mockPlanStatus.mockResolvedValue({ plan_id: null, is_free_trial: false, is_expired: true });
    await renderScreen(<SettingsScreen />);
    expect(await screen.findByText('Upgrade plan to access')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('section-header-salary'));
    expect(await screen.findByText('Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.')).toBeTruthy();
    expect(screen.queryByText('Monthly Fixed')).toBeNull();
  });

  it('a failed plan-status request does not block salary structure (fails open)', async () => {
    mockPlanStatus.mockRejectedValue(new Error('offline'));
    await renderScreen(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('section-header-salary'));
    expect(screen.getByText('Monthly Fixed')).toBeTruthy();
  });

  it('Beyond: suggest, support, more, permissions navigate; logout asks for confirmation then signs out', async () => {
    await renderScreen(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId('section-header-beyond'));
    for (const t of ['Suggest a Feature', 'Support', 'More Options', 'App Permissions', 'Logout']) expect(screen.getByText(t)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('item-suggest'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.suggestFeature);
    await fireEvent.press(screen.getByTestId('item-support'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.support);
    await fireEvent.press(screen.getByTestId('item-more'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.more);
    await fireEvent.press(screen.getByTestId('item-permissions'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.permissions);

    await fireEvent.press(screen.getByTestId('item-logout'));
    expect(await screen.findByText('Are you sure you want to logout?')).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockSignOut).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('item-logout'));
    const logoutButtons = await screen.findAllByText('Logout'); // row, dialog title and confirm button; the confirm button renders last
    await fireEvent.press(logoutButtons[logoutButtons.length - 1]);
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalledWith(routes.welcome);
  });

  it('Refer & Earn is shown to the organisation admin only (managers do not get the row)', async () => {
    signInTestAdmin({ roleId: 2 });
    await renderScreen(<SettingsScreen />);
    expect(screen.getByText('Your Plan & Validity')).toBeTruthy();
    expect(screen.queryByText('Refer & Earn')).toBeNull();
  });
});
