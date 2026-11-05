import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { toast } from '@/components/ui';

import type { Manager } from '@/types/api/managers';

import ManagerEditScreen from '../screens/ManagerEditScreen';
import ManagerListScreen from '../screens/ManagerListScreen';
import { renderScreen, signInAdmin } from './testHarness';

const mockPush = jest.fn();
const mockBackOr = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock('@/lib/navigation', () => ({
  ...jest.requireActual('@/lib/navigation'),
  useAppRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), backOr: mockBackOr, dismissAll: jest.fn(), canGoBack: () => true, goHome: jest.fn() }),
}));

const mockListManagers = jest.fn();
const mockGetPerms = jest.fn();
const mockSavePerms = jest.fn();
const mockRemove = jest.fn();
const mockStaffUnder = jest.fn();
const mockPromotable = jest.fn();
const mockAssign = jest.fn();
jest.mock('@/api/managers', () => ({
  listManagers: (...a: unknown[]) => mockListManagers(...a),
  getManagerPermissions: (...a: unknown[]) => mockGetPerms(...a),
  saveManagerPermissions: (...a: unknown[]) => mockSavePerms(...a),
  removeManager: (...a: unknown[]) => mockRemove(...a),
  getStaffUnderManager: (...a: unknown[]) => mockStaffUnder(...a),
  getPromotableStaff: (...a: unknown[]) => mockPromotable(...a),
  assignManager: (...a: unknown[]) => mockAssign(...a),
}));
jest.mock('@/api/staff', () => ({
  getBranchOptions: jest.fn(async () => [
    { id: '1', name: 'HQ' },
    { id: '2', name: 'Pune' },
  ]),
  getDepartmentOptions: jest.fn(async () => [
    { id: 'd1', name: 'Sales' },
    { id: 'd2', name: 'Ops' },
  ]),
}));

const manager = (userId: string, name: string, assignments: Manager['assignments']): Manager => ({ userId, name, empId: `E-${userId}`, assignments, raw: {} });
const MANAGERS: Manager[] = [
  manager('m1', 'Mia Rao', [{ branchId: '1', branchName: 'HQ', deptId: 'd1', deptName: 'Sales' }]),
  manager('m2', 'Ned Shah', []),
];

beforeEach(() => {
  jest.clearAllMocks();
  toast.clear();
  mockParams = {};
  signInAdmin();
  mockListManagers.mockResolvedValue(MANAGERS);
  mockGetPerms.mockResolvedValue({ 'Staff Management': true });
  mockSavePerms.mockResolvedValue({ message: 'ok' });
  mockRemove.mockResolvedValue({ message: 'ok' });
  mockStaffUnder.mockResolvedValue([{ userId: 's1', name: 'Zed Khan', empId: 'E9', branch: 'HQ', department: 'Sales' }]);
  mockPromotable.mockResolvedValue([{ userId: 's9', name: 'Pat Lee', empId: 'E77' }]);
  mockAssign.mockResolvedValue({ message: 'Manager assigned successfully' });
});

describe('ManagerListScreen', () => {
  it('lists managers with the stats strip and opens the branches popup', async () => {
    await renderScreen(<ManagerListScreen />);
    expect(await screen.findByText('Mia Rao')).toBeTruthy();
    expect(screen.getByText('Ned Shah')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Assigned')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('manager-branches-m1'));
    expect(await screen.findByText("Mia Rao's Branches")).toBeTruthy();
    expect(screen.getByText('1 assignment')).toBeTruthy();
    expect(screen.getByText('Sales')).toBeTruthy();
  });

  it('shows the empty state with the Assign Manager call to action', async () => {
    mockListManagers.mockResolvedValue([]);
    await renderScreen(<ManagerListScreen />);
    expect(await screen.findByText('No managers yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Assign Manager'));
    expect(mockPush).toHaveBeenCalledWith('/admin/managers/edit');
  });

  it('edits the permission map with the exact permission names and saves the full map', async () => {
    await renderScreen(<ManagerListScreen />);
    await fireEvent.press(await screen.findByTestId('manager-perms-m1'));
    expect(await screen.findByText('1/10 permissions active')).toBeTruthy();
    await fireEvent.press(screen.getByText('Holiday Management'));
    expect(screen.getByText('2/10 permissions active')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('permissions-save'));
    await waitFor(() => expect(mockSavePerms).toHaveBeenCalledTimes(1));
    const [userId, map] = mockSavePerms.mock.calls[0] as [string, Record<string, boolean>];
    expect(userId).toBe('m1');
    expect(map['Staff Management']).toBe(true);
    expect(map['Holiday Management']).toBe(true);
    expect(map['Shift Management']).toBe(false);
    expect(Object.keys(map)).toHaveLength(10);
  });

  it('does not allow saving permissions when they could not be loaded', async () => {
    mockGetPerms.mockRejectedValue(new Error('Backend down'));
    await renderScreen(<ManagerListScreen />);
    await fireEvent.press(await screen.findByTestId('manager-perms-m1'));
    expect(await screen.findByText('Backend down')).toBeTruthy();
    const save = screen.getByTestId('permissions-save');
    expect(save.props.accessibilityState?.disabled ?? save.props['aria-disabled']).toBeTruthy();
    expect(mockSavePerms).not.toHaveBeenCalled();
  });

  it('removes a manager after confirmation', async () => {
    await renderScreen(<ManagerListScreen />);
    await fireEvent.press(await screen.findByTestId('manager-remove-m1'));
    expect(await screen.findByText('Remove Mia Rao as manager?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Remove'));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('m1'));
  });

  it('shows the staff under a manager', async () => {
    await renderScreen(<ManagerListScreen />);
    await fireEvent.press(await screen.findByTestId('manager-staff-m1'));
    expect(await screen.findByText('Zed Khan')).toBeTruthy();
    expect(screen.getByText("Mia Rao's Staff")).toBeTruthy();
  });
});

describe('ManagerEditScreen', () => {
  it('add mode: requires a staff member before anything is sent', async () => {
    await renderScreen(<ManagerEditScreen />);
    await waitFor(() => expect(screen.getByTestId('select-staff')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('manager-submit'));
    await waitFor(() => expect(screen.getByText('Please select a staff member')).toBeTruthy());
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('edit mode: locks the staff field, pre-fills the scope and submits an explicit department per branch', async () => {
    mockParams = { userId: 'm1' };
    await renderScreen(<ManagerEditScreen />);
    expect(await screen.findByText('Edit Manager')).toBeTruthy();
    expect(await screen.findByText('1 combinations')).toBeTruthy();
    const locked = screen.getByTestId('manager-staff-locked');
    expect(locked.props.value).toBe('Mia Rao');
    expect(locked.props.editable).toBe(false);
    await fireEvent.press(screen.getByTestId('manager-submit'));
    // Her own existing scope never conflicts with itself.
    await waitFor(() => expect(mockAssign).toHaveBeenCalledTimes(1));
    expect(mockAssign).toHaveBeenCalledWith({ userId: 'm1', assignments: [{ branchId: '1', deptId: 'd1' }] });
    await waitFor(() => expect(mockBackOr).toHaveBeenCalled());
  });
});
