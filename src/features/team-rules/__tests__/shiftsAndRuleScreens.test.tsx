import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { toast } from '@/components/ui';

import type { Shift } from '@/types/api/shifts';

import AttendanceRuleScreen from '../screens/AttendanceRuleScreen';
import ShiftsScreen from '../screens/ShiftsScreen';
import { renderScreen, signInAdmin } from './testHarness';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));

const mockList = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockAssigned = jest.fn();
const mockUnassigned = jest.fn();
const mockAssign = jest.fn();
const mockUnassign = jest.fn();
jest.mock('@/api/shifts', () => ({
  listShifts: (...a: unknown[]) => mockList(...a),
  createShift: (...a: unknown[]) => mockCreate(...a),
  updateShift: (...a: unknown[]) => mockUpdate(...a),
  deleteShift: (...a: unknown[]) => mockDelete(...a),
  getAssignedStaff: (...a: unknown[]) => mockAssigned(...a),
  getUnassignedStaff: (...a: unknown[]) => mockUnassigned(...a),
  assignStaff: (...a: unknown[]) => mockAssign(...a),
  unassignStaff: (...a: unknown[]) => mockUnassign(...a),
}));

const mockGetRule = jest.fn();
const mockSaveRule = jest.fn();
jest.mock('@/api/system', () => ({
  DEFAULT_ATTENDANCE_RULE: { latePunchInCount: 3, considerAs: 'Half Day' },
  getAttendanceRule: (...a: unknown[]) => mockGetRule(...a),
  saveAttendanceRule: (...a: unknown[]) => mockSaveRule(...a),
}));

const shift = (id: number, name: string, startTime: string, endTime: string): Shift => ({ id, name, startTime, endTime, isActive: true, raw: {} });
const staff = (userId: string, name: string) => ({ userId, name, empId: `E-${userId}`, mobile: '', email: '', department: '', branch: '', status: 'absent', statusLabel: '', isActive: true, raw: {} });

beforeEach(() => {
  jest.clearAllMocks();
  toast.clear();
  signInAdmin();
  mockList.mockResolvedValue([shift(1, 'Morning', '09:00', '18:00')]);
  mockCreate.mockResolvedValue({ shiftId: 2, message: 'created' });
  mockUpdate.mockResolvedValue({ shiftId: 1, message: 'updated' });
  mockDelete.mockResolvedValue({ message: 'deleted' });
  mockAssigned.mockResolvedValue([staff('a1', 'Ann On')]);
  mockUnassigned.mockResolvedValue([staff('u1', 'Bob Off'), staff('u2', 'Cy Off')]);
  mockAssign.mockResolvedValue({ message: 'ok' });
  mockUnassign.mockResolvedValue({ message: 'ok' });
  mockGetRule.mockResolvedValue({ latePunchInCount: 5, considerAs: 'Leave' });
  mockSaveRule.mockResolvedValue(undefined);
});

describe('ShiftsScreen', () => {
  it('lists shifts as 12-hour ranges', async () => {
    await renderScreen(<ShiftsScreen />);
    expect(await screen.findByText('Morning')).toBeTruthy();
    expect(screen.getByText('09:00 AM - 06:00 PM')).toBeTruthy();
    expect(screen.getByText('9h')).toBeTruthy();
  });

  it('validates the form inline before calling the API (empty fields, duplicate name)', async () => {
    await renderScreen(<ShiftsScreen />);
    await screen.findByText('Morning');
    await fireEvent.press(screen.getByTestId('add-shift'));
    await fireEvent.press(await screen.findByTestId('shift-form-submit'));
    expect(await screen.findByText('Enter a shift name')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('shift-name'), 'morning');
    await fireEvent.press(screen.getByTestId('shift-form-submit'));
    expect(await screen.findByText('Select a start time')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('assigns the selected staff and removes an assigned one (after confirmation)', async () => {
    await renderScreen(<ShiftsScreen />);
    await fireEvent.press(await screen.findByTestId('shift-menu-1'));
    await fireEvent.press(await screen.findByTestId('shift-menu-assign'));
    expect(await screen.findByText('ASSIGNED (1)')).toBeTruthy();
    expect(screen.getByText('AVAILABLE (2)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('available-u1'));
    await fireEvent.press(await screen.findByText('Assign 1 Staff'));
    await waitFor(() => expect(mockAssign).toHaveBeenCalledWith({ orgId: 'org1', shiftId: 1, userIds: ['u1'] }));

    await fireEvent.press(screen.getByTestId('unassign-a1'));
    expect(await screen.findByText('Remove Ann On from this shift?')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('Remove').slice(-1)[0]);
    await waitFor(() => expect(mockUnassign).toHaveBeenCalledWith('org1', 'a1', 1));
  });

  it('shows an error (not "all staff assigned") when the assignment endpoints are missing', async () => {
    mockAssigned.mockRejectedValue(new Error('Not Found'));
    mockUnassigned.mockRejectedValue(new Error('Not Found'));
    await renderScreen(<ShiftsScreen />);
    await fireEvent.press(await screen.findByTestId('shift-menu-1'));
    await fireEvent.press(await screen.findByTestId('shift-menu-assign'));
    expect(await screen.findByText('Not Found')).toBeTruthy();
    expect(screen.queryByText('All staff assigned')).toBeNull();
  });

  it('deletes a shift after confirmation', async () => {
    await renderScreen(<ShiftsScreen />);
    await fireEvent.press(await screen.findByTestId('shift-menu-1'));
    await fireEvent.press(await screen.findByTestId('shift-menu-delete'));
    expect(await screen.findByText('Delete Shift')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1, 'org1'));
  });
});

describe('AttendanceRuleScreen', () => {
  it('loads the saved rule, previews it and saves the changed count', async () => {
    await renderScreen(<AttendanceRuleScreen />);
    await waitFor(() => expect(screen.getByTestId('rule-summary')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/late 5 times/)).toBeTruthy());
    await fireEvent.press(screen.getByTestId('save-rule'));
    await waitFor(() => expect(mockSaveRule).toHaveBeenCalledWith('org1', { latePunchInCount: 5, considerAs: 'Leave' }));
  });

  it('keeps the defaults but says so when the saved rule cannot be loaded', async () => {
    mockGetRule.mockRejectedValue(new Error('Not Found'));
    await renderScreen(<AttendanceRuleScreen />);
    expect(await screen.findByTestId('rule-load-error')).toBeTruthy();
    expect(screen.getByText(/late 3 times/)).toBeTruthy();
  });
});
