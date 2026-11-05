import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { routes } from '@/config/routes';
import { member, renderWithQuery, signInAs, signOutForTest } from '../testing/harness';
import StaffListScreen from '../screens/StaffListScreen';

jest.setTimeout(30000);

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));

jest.mock('@/api', () => ({
  homeApi: {
    getAllStaff: jest.fn(),
    getStaffByStatus: jest.fn(),
    getDepartments: jest.fn(),
    getBranches: jest.fn(),
  },
  staffApi: { setStaffActive: jest.fn() },
  authApi: { getOrgLogoUrl: jest.fn().mockResolvedValue(null) },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { homeApi, staffApi } = require('@/api') as {
  homeApi: Record<'getAllStaff' | 'getStaffByStatus' | 'getDepartments' | 'getBranches', jest.Mock>;
  staffApi: { setStaffActive: jest.Mock };
};

const FULL = [
  member({ userId: 'a', name: 'Asha Verma', roleId: 3, branch: 'Mumbai', department: 'Sales', status: 'punched_in' }),
  member({ userId: 'b', name: 'Bala Iyer', roleId: 2, branch: 'Pune', department: 'Ops', status: 'absent' }),
  member({ userId: 'c', name: 'Chitra Rao', roleId: 3, branch: 'Pune', department: 'Sales', status: 'inactive', isActive: false }),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  signInAs(1);
  homeApi.getAllStaff.mockResolvedValue(FULL);
  homeApi.getStaffByStatus.mockResolvedValue([]);
  homeApi.getDepartments.mockResolvedValue([{ id: 'd1', name: 'Sales', orgId: 'org-1', raw: {} }, { id: 'd9', name: 'Finance', orgId: 'org-1', raw: {} }]);
  homeApi.getBranches.mockResolvedValue([]);
  staffApi.setStaffActive.mockResolvedValue({ message: 'Staff deactivated successfully' });
});

describe('StaffListScreen', () => {
  it('renders the roster A-Z with chip counts, filters by search and role, and opens a staff detail', async () => {
    await renderWithQuery(<StaffListScreen />);
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
    expect(screen.getByText('Acme Co')).toBeTruthy();
    expect(screen.getByText('All Staff')).toBeTruthy();
    expect(screen.getByLabelText('All, 3')).toBeTruthy();
    expect(screen.getByLabelText('Staff, 2')).toBeTruthy();
    expect(screen.getByLabelText('Manager, 1')).toBeTruthy();
    expect(screen.getByLabelText('Inactive, 1')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Manager, 1'));
    expect(screen.queryByText('Asha Verma')).toBeNull();
    expect(screen.getByText('Bala Iyer')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('All, 3'));
    await fireEvent.changeText(screen.getByPlaceholderText('Search by name, branch, dept...'), '  mumb ');
    expect(screen.getByText('Asha Verma')).toBeTruthy();
    expect(screen.queryByText('Bala Iyer')).toBeNull();

    await fireEvent.press(screen.getByTestId('staff-row-a'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.staff.detail, params: { staffId: 'a' } });
  });

  it('shows the "No Results" empty state for a search without matches', async () => {
    await renderWithQuery(<StaffListScreen />);
    await screen.findByText('Asha Verma');
    await fireEvent.changeText(screen.getByPlaceholderText('Search by name, branch, dept...'), 'zzz');
    expect(screen.getByText('No Results')).toBeTruthy();
    expect(screen.getByText('No staff matching "zzz"')).toBeTruthy();
  });

  it('toggles active through the API and updates the row', async () => {
    await renderWithQuery(<StaffListScreen />);
    await screen.findByText('Asha Verma');
    staffApi.setStaffActive.mockImplementation(async () => {
      homeApi.getAllStaff.mockResolvedValue(FULL.map((m) => (m.userId === 'a' ? { ...m, isActive: false } : m)));
      return { message: 'Staff deactivated successfully' };
    });
    await fireEvent.press(screen.getByTestId('staff-switch-a'));
    await waitFor(() => expect(staffApi.setStaffActive).toHaveBeenCalledWith('a', false));
    await waitFor(() => expect(screen.getByLabelText('Inactive, 2')).toBeTruthy());
  });

  it('tile view: live bucket is enriched with role / active info from the full roster and shows the banner', async () => {
    mockParams = { filter: 'absent', date: '2026-10-18', branchId: '7' };
    homeApi.getStaffByStatus.mockResolvedValue([
      member({ userId: 'b', name: 'Bala Iyer', branch: 'Pune', department: 'Ops', status: 'absent' }),
      member({ userId: 'c', name: 'Chitra Rao', branch: 'Pune', department: 'Sales', status: 'absent' }),
    ]);
    await renderWithQuery(<StaffListScreen />);
    expect(await screen.findByText('Bala Iyer')).toBeTruthy();
    expect(homeApi.getStaffByStatus).toHaveBeenCalledWith('absent', 'org-1', { date: '2026-10-18', branchId: '7' });
    expect(screen.getByText('Absent Staff')).toBeTruthy();
    expect(screen.getByText('Absent Today')).toBeTruthy();
    expect(screen.getByText('2 members absent')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Manager, 1')).toBeTruthy());
    expect(screen.getByLabelText('Staff, 1')).toBeTruthy();
    expect(screen.getByLabelText('Inactive, 1')).toBeTruthy();
  });

  it('a department tile with no matching staff shows the empty state, not the whole roster', async () => {
    mockParams = { filter: 'total', deptId: 'd9' };
    await renderWithQuery(<StaffListScreen />);
    expect(await screen.findByText('No Staff Found')).toBeTruthy();
    expect(screen.queryByText('Asha Verma')).toBeNull();
  });

  it('a department tile narrows a live bucket by department', async () => {
    mockParams = { filter: 'punch_in', deptId: 'd1' };
    homeApi.getStaffByStatus.mockResolvedValue([
      member({ userId: 'a', name: 'Asha Verma', department: 'Sales', status: 'punched_in' }),
      member({ userId: 'b', name: 'Bala Iyer', department: 'Ops', status: 'punched_in' }),
    ]);
    await renderWithQuery(<StaffListScreen />);
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
    expect(screen.queryByText('Bala Iyer')).toBeNull();
    expect(screen.getByText('Punched-In')).toBeTruthy();
  });

  it('does not spin forever without an organisation id', async () => {
    signOutForTest();
    await renderWithQuery(<StaffListScreen />);
    expect(screen.getByText('Organisation not available')).toBeTruthy();
    expect(homeApi.getAllStaff).not.toHaveBeenCalled();
  });

  it('shows an error state with retry when the roster cannot be loaded', async () => {
    homeApi.getAllStaff.mockRejectedValueOnce(new Error('boom'));
    await renderWithQuery(<StaffListScreen />);
    expect(await screen.findByText('Try again')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
  });
});
