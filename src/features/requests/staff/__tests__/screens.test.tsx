import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { requestsApi, shiftsApi } from '@/api';
import type { StaffRequest } from '@/types/api/requests';
import type { Shift } from '@/types/api/shifts';

import DeviceChangeRequestScreen from '../screens/DeviceChangeRequestScreen';
import LeaveRequestScreen from '../screens/LeaveRequestScreen';
import PermissionRequestScreen from '../screens/PermissionRequestScreen';
import RequestsHubScreen from '../screens/RequestsHubScreen';
import ShiftChangeRequestScreen from '../screens/ShiftChangeRequestScreen';
import { renderWithProviders, resetToasts, signInForTest, signOutForTest } from '../testing/harness';
import { routerMock } from '../testing/navigationMock';

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (cb: () => void) => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      React.useEffect(cb, []);
    },
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/lib/navigation', () => require('../testing/navigationMock'));
// 2026-10-14 06:00 UTC = 11:30 IST on a Wednesday. 18 Oct is a Sunday. (Date.now itself is left alone: the test
// library's timeouts depend on it.)
jest.mock('@/lib/datetime', () => {
  const actual = jest.requireActual('@/lib/datetime');
  const NOW = Date.UTC(2026, 9, 14, 6, 0, 0);
  return {
    ...actual,
    todayIST: () => actual.todayIST(NOW),
    minutesNowIST: () => actual.minutesNowIST(NOW),
    currentMonthIST: () => actual.currentMonthIST(NOW),
  };
});
jest.mock('@/api', () => ({
  requestsApi: {
    listEmployeeRequests: jest.fn(),
    getRequestCalendar: jest.fn(),
    submitLeave: jest.fn(),
    submitPermission: jest.fn(),
    submitShiftChange: jest.fn(),
    submitDeviceChange: jest.fn(),
  },
  shiftsApi: { listShifts: jest.fn() },
}));

const api = requestsApi as jest.Mocked<typeof requestsApi>;
const shifts = shiftsApi as jest.Mocked<typeof shiftsApi>;

const request = (over: Partial<StaffRequest> & { type: StaffRequest['type'] }): StaffRequest =>
  ({ id: Math.random().toString(36).slice(2), reason: 'r', status: 'pending', dates: [], dateStatuses: {}, raw: {}, ...over }) as StaffRequest;

beforeEach(() => {
  jest.clearAllMocks();
  resetToasts();
  signInForTest();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  api.listEmployeeRequests.mockResolvedValue([]);
  api.getRequestCalendar.mockResolvedValue([]);
  shifts.listShifts.mockResolvedValue([]);
});

describe('RequestsHubScreen', () => {
  it('shows the four cards, pending badges and the footer hint', async () => {
    api.listEmployeeRequests.mockResolvedValue([
      request({ type: 'leave' }),
      request({ type: 'leave' }),
      request({ type: 'leave', status: 'approved' }),
      request({ type: 'shift_change' }),
      request({ type: 'permission', status: 'rejected' }),
    ]);
    await renderWithProviders(<RequestsHubScreen />);
    expect(screen.getByText('Leave Request')).toBeTruthy();
    expect(screen.getByText('Permission')).toBeTruthy();
    expect(screen.getByText('Shift Change')).toBeTruthy();
    expect(screen.getByText('Device Change')).toBeTruthy();
    expect(screen.getByText('All requests are sent to your manager for approval')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('request-card-leave-badge')).toBeTruthy());
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByTestId('request-card-shift_change-badge')).toBeTruthy();
    expect(screen.queryByTestId('request-card-permission-badge')).toBeNull();
    expect(screen.queryByTestId('request-card-device_change-badge')).toBeNull();
  });

  it('device change opens immediately; leave pre-loads the IST month (last day included) then opens', async () => {
    await renderWithProviders(<RequestsHubScreen />);
    await fireEvent.press(screen.getByTestId('request-card-device_change'));
    expect(routerMock.push).toHaveBeenCalledWith('/staff/requests/device-change');

    await fireEvent.press(screen.getByTestId('request-card-leave'));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/staff/requests/leave'));
    expect(api.getRequestCalendar).toHaveBeenCalledWith('u1', 'o1', '2026-10-01', '2026-10-31');
  });

  it('caps the badge at 99+ and ignores pending rows of an unknown request type', async () => {
    api.listEmployeeRequests.mockResolvedValue([
      ...Array.from({ length: 100 }, () => request({ type: 'leave' })),
      request({ type: 'leave', raw: { request_type: 'overtime' } }),
    ]);
    await renderWithProviders(<RequestsHubScreen />);
    await waitFor(() => expect(screen.getByText('99+')).toBeTruthy());
    expect(screen.queryByTestId('request-card-permission-badge')).toBeNull();
  });

  it('shift change pre-loads the organisation shifts once, then opens', async () => {
    await renderWithProviders(<RequestsHubScreen />);
    await fireEvent.press(screen.getByTestId('request-card-shift_change'));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/staff/requests/shift-change'));
    expect(shifts.listShifts).toHaveBeenCalledTimes(1);
    expect(shifts.listShifts).toHaveBeenCalledWith('o1');
  });

  it('still opens the screen when the pre-load fails', async () => {
    api.getRequestCalendar.mockRejectedValue(new Error('offline'));
    await renderWithProviders(<RequestsHubScreen />);
    await fireEvent.press(screen.getByTestId('request-card-permission'));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/staff/requests/permission'));
  });
});

describe('LeaveRequestScreen', () => {
  it('selects weekdays (today included), ignores Sundays, past days and requested dates, and removes chips', async () => {
    api.getRequestCalendar.mockResolvedValue([{ date: '2026-10-20', status: 'rejected', type: 'leave' }]);
    await renderWithProviders(<LeaveRequestScreen />);
    await waitFor(() => expect(api.getRequestCalendar).toHaveBeenCalledWith('u1', 'o1', '2026-10-01', '2026-10-31'));
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());

    await fireEvent.press(screen.getByLabelText(/^14 October 2026/)); // today
    await fireEvent.press(screen.getByLabelText(/^15 October 2026/));
    expect(screen.getByTestId('chip-2026-10-14')).toBeTruthy();
    expect(screen.getByTestId('chip-2026-10-15')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(/^18 October 2026/)); // Sunday
    await fireEvent.press(screen.getByLabelText(/^13 October 2026/)); // past
    await fireEvent.press(screen.getByLabelText(/^20 October 2026/)); // rejected: cannot be re-requested
    expect(screen.queryByTestId('chip-2026-10-18')).toBeNull();
    expect(screen.queryByTestId('chip-2026-10-13')).toBeNull();
    expect(screen.queryByTestId('chip-2026-10-20')).toBeNull();

    await fireEvent.press(screen.getByTestId('chip-2026-10-14'));
    expect(screen.queryByTestId('chip-2026-10-14')).toBeNull();
    expect(screen.getByTestId('chip-2026-10-15')).toBeTruthy();
  });

  it('validates dates then reason, then submits sorted dates with the trimmed reason', async () => {
    api.submitLeave.mockResolvedValue({ requestId: 'R1', message: 'ok' });
    await renderWithProviders(<LeaveRequestScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());

    await fireEvent.press(screen.getByTestId('leave-submit'));
    expect(await screen.findByLabelText('error: Select at least one date')).toBeTruthy();
    expect(api.submitLeave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText(/^16 October 2026/));
    await fireEvent.press(screen.getByLabelText(/^15 October 2026/));
    await fireEvent.press(screen.getByTestId('leave-submit'));
    expect(await screen.findByLabelText('error: Enter a reason for leave')).toBeTruthy();
    expect(api.submitLeave).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('leave-reason'), '  Family event  ');
    await fireEvent.press(screen.getByTestId('leave-submit'));
    await waitFor(() => expect(api.submitLeave).toHaveBeenCalledTimes(1));
    expect(api.submitLeave).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', dates: ['2026-10-15', '2026-10-16'], reason: 'Family event' });
    expect(await screen.findByText('Submitted!')).toBeTruthy();
    // the form is cleared after a successful submit
    expect(screen.queryByTestId('chip-2026-10-15')).toBeNull();
  });

  it('surfaces the server error text and keeps the form', async () => {
    api.submitLeave.mockRejectedValue(new Error('Leave already exists for 15 Oct'));
    await renderWithProviders(<LeaveRequestScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());
    await fireEvent.press(screen.getByLabelText(/^15 October 2026/));
    await fireEvent.changeText(screen.getByTestId('leave-reason'), 'Trip');
    await fireEvent.press(screen.getByTestId('leave-submit'));
    expect(await screen.findByText('Leave already exists for 15 Oct')).toBeTruthy();
    expect(screen.getByTestId('chip-2026-10-15')).toBeTruthy();
  });
});

describe('PermissionRequestScreen', () => {
  it('requires the start time before the end time and offers only valid slots', async () => {
    await renderWithProviders(<PermissionRequestScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());

    await fireEvent.press(screen.getByTestId('permission-end'));
    expect(await screen.findByLabelText('error: Select start time first')).toBeTruthy();
    expect(screen.queryByTestId('time-slot-sheet')).toBeNull();

    await fireEvent.press(screen.getByLabelText(/^15 October 2026/));
    await fireEvent.press(screen.getByTestId('permission-start'));
    expect(screen.getByTestId('slot-00:00')).toBeTruthy(); // a future date offers all 48 slots
    await fireEvent.press(screen.getByTestId('slot-09:00'));

    await fireEvent.press(screen.getByTestId('permission-end'));
    expect(screen.getByTestId('slot-15:00')).toBeTruthy();
    expect(screen.queryByTestId('slot-15:30')).toBeNull(); // more than 6 h after the start
    expect(screen.queryByTestId('slot-09:00')).toBeNull();
  });

  it('today only offers start slots later than now (11:30 IST)', async () => {
    await renderWithProviders(<PermissionRequestScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());
    await fireEvent.press(screen.getByLabelText(/^14 October 2026/));
    await fireEvent.press(screen.getByTestId('permission-start'));
    expect(screen.queryByTestId('slot-11:30')).toBeNull();
    expect(screen.getByTestId('slot-12:00')).toBeTruthy();
  });

  it('submits date, 24h times and the trimmed reason; changing the start clears the end', async () => {
    api.submitPermission.mockResolvedValue({ requestId: 'P1', message: 'ok' });
    await renderWithProviders(<PermissionRequestScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());

    await fireEvent.press(screen.getByTestId('permission-submit'));
    expect(await screen.findByLabelText('error: Select a date')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(/^15 October 2026/));
    await fireEvent.press(screen.getByTestId('permission-start'));
    await fireEvent.press(screen.getByTestId('slot-09:00'));
    await fireEvent.press(screen.getByTestId('permission-end'));
    await fireEvent.press(screen.getByTestId('slot-10:00'));
    await fireEvent.press(screen.getByTestId('permission-start'));
    await fireEvent.press(screen.getByTestId('slot-09:30'));
    await fireEvent.press(screen.getByTestId('permission-submit'));
    expect(await screen.findByLabelText('error: Select end time')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('permission-end'));
    await fireEvent.press(screen.getByTestId('slot-12:00'));
    await fireEvent.changeText(screen.getByTestId('permission-reason'), ' Bank work ');
    await fireEvent.press(screen.getByTestId('permission-submit'));
    await waitFor(() => expect(api.submitPermission).toHaveBeenCalledTimes(1));
    expect(api.submitPermission).toHaveBeenCalledWith({
      userId: 'u1',
      orgId: 'o1',
      date: '2026-10-15',
      startTime: '09:30',
      endTime: '12:00',
      reason: 'Bank work',
    });
    expect(await screen.findByText('Submitted!')).toBeTruthy();
  });
});

describe('ShiftChangeRequestScreen', () => {
  const shift = (id: number, name: string): Shift => ({ id, name, startTime: '09:00', endTime: '18:00', isActive: true, raw: {} });

  it('disables the shift selector when the organisation has no shifts', async () => {
    await renderWithProviders(<ShiftChangeRequestScreen />);
    expect(screen.getByText('Request a Shift Change')).toBeTruthy();
    expect(await screen.findByText('No shifts available')).toBeTruthy();
  });

  it('validates in order: reason, shift, date', async () => {
    shifts.listShifts.mockResolvedValue([shift(1, 'Morning')]);
    await renderWithProviders(<ShiftChangeRequestScreen />);
    await fireEvent.press(screen.getByTestId('shift-submit'));
    expect(await screen.findAllByText('Please enter a reason')).not.toHaveLength(0);
    await fireEvent.changeText(screen.getByTestId('shift-reason'), 'Childcare');
    await fireEvent.press(screen.getByTestId('shift-submit'));
    expect((await screen.findAllByText('Please select a preferred shift')).length).toBeGreaterThan(0);
    expect(api_submitShift()).not.toHaveBeenCalled();
  });

  it('My Requests lists only shift change requests with their status, timing and dates', async () => {
    api.listEmployeeRequests.mockResolvedValue([
      request({ id: 'a', type: 'shift_change', status: 'approved', requestedShiftTiming: '09:00 AM - 06:00 PM', shiftChangeDate: '2026-10-20', reason: 'Childcare', createdAt: '2026-10-10T05:00:00Z' } as Partial<StaffRequest> & { type: 'shift_change' }),
      request({ id: 'b', type: 'leave' }),
    ]);
    await renderWithProviders(<ShiftChangeRequestScreen />);
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('My Requests'));
    });
    expect(await screen.findByTestId('shift-history-a')).toBeTruthy();
    expect(screen.queryByTestId('shift-history-b')).toBeNull();
    expect(screen.getByText('09:00 AM - 06:00 PM')).toBeTruthy();
    expect(screen.getByText('20 Oct 2026')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
  });

  it('shows the empty state when there are no shift change requests', async () => {
    await renderWithProviders(<ShiftChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText('My Requests'));
    expect(await screen.findByText('No shift change requests yet')).toBeTruthy();
  });
});

function api_submitShift() {
  return api.submitShiftChange;
}

describe('DeviceChangeRequestScreen', () => {
  it('pre-login mode: warning, login copy, ids from the params, back to the staff login on success', async () => {
    jest.useFakeTimers();
    signOutForTest();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ userId: 'u9', orgId: 'o9' });
    api.submitDeviceChange.mockResolvedValue({ requestId: 'D1', message: 'ok' });
    await renderWithProviders(<DeviceChangeRequestScreen />);
    expect(screen.getByTestId('device-warning')).toBeTruthy();
    expect(screen.getByText(/A different device was detected for your account/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('device-submit'));
    expect(await screen.findAllByText('Please enter a reason')).not.toHaveLength(0);
    expect(api.submitDeviceChange).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('device-reason'), '  Lost phone ');
    await fireEvent.press(screen.getByTestId('device-submit'));
    await waitFor(() => expect(api.submitDeviceChange).toHaveBeenCalledWith({ userId: 'u9', orgId: 'o9', reason: 'Lost phone' }));
    expect(await screen.findByText('Submitted!')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    expect(routerMock.replace).toHaveBeenCalledWith('/staff-login');
    jest.useRealTimers();
  });

  it('in-app mode: no warning, ids from the session', async () => {
    api.submitDeviceChange.mockResolvedValue({ requestId: 'D2', message: 'ok' });
    await renderWithProviders(<DeviceChangeRequestScreen />);
    expect(screen.queryByTestId('device-warning')).toBeNull();
    expect(screen.getByText(/Submit a request to register a new device for attendance/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('device-reason'), 'New phone');
    await fireEvent.press(screen.getByTestId('device-submit'));
    await waitFor(() => expect(api.submitDeviceChange).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', reason: 'New phone' }));
  });

  it('shows the server error and does not clear the reason', async () => {
    api.submitDeviceChange.mockRejectedValue(new Error('A request is already pending'));
    await renderWithProviders(<DeviceChangeRequestScreen />);
    await fireEvent.changeText(screen.getByTestId('device-reason'), 'New phone');
    await fireEvent.press(screen.getByTestId('device-submit'));
    expect(await screen.findByText('A request is already pending')).toBeTruthy();
    expect(screen.getByTestId('device-reason').props.value).toBe('New phone');
  });
});
