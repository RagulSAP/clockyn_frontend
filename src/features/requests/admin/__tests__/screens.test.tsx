import React from 'react';
import { configure, fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as requestsModule from '@/api/requests';

import { decided, makeRequest } from '../testing/fixtures';
import { renderScreen, signInAs } from '../testing/renderScreen';
import { useSeenStore } from '../store/seenStore';
import DeviceChangeRequestsScreen from '../screens/DeviceChangeRequestsScreen';
import LeaveRequestsScreen from '../screens/LeaveRequestsScreen';
import PermissionRequestsScreen from '../screens/PermissionRequestsScreen';
import RequestsHubScreen from '../screens/RequestsHubScreen';
import ShiftChangeRequestsScreen from '../screens/ShiftChangeRequestsScreen';

configure({ asyncUtilTimeout: 5000 });

const mockPush = jest.fn();
const mockConfirm = jest.fn(async () => true);

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(cb, []);
  },
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/api/requests');
jest.mock('@/api/auth', () => ({ getOrgLogoUrl: jest.fn().mockResolvedValue(null) }));
jest.mock('@/components/ui', () => ({ ...jest.requireActual('@/components/ui'), useConfirm: () => mockConfirm }));

const api = requestsModule as jest.Mocked<typeof requestsModule>;

const inbox = () => {
  const d = ['2025-01-03', '2025-01-04'];
  return [
    makeRequest('leave', { id: 'l1', dates: d, dateStatuses: { [d[0]]: decided('pending'), [d[1]]: decided('pending') } }),
    makeRequest('leave', { id: 'l2', staffName: 'Ravi Kumar', status: 'approved', dates: [d[0]], dateStatuses: { [d[0]]: decided('approved') } }),
    makeRequest('permission', { id: 'p1', dates: ['2025-01-05', '2025-01-07'], staffName: 'Meera Iyer', dateStatuses: { '2025-01-05': decided('approved'), '2025-01-07': decided('pending') } }),
    makeRequest('shift_change', { id: 's1', staffName: 'Kabir Shah' }),
    makeRequest('device_change', { id: 'd1', staffName: 'Isha Rao', raw: { device_model: 'Pixel 8', device_os: 'Android 15' } }),
  ];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConfirm.mockResolvedValue(true);
  useSeenStore.getState().reset();
  signInAs(1);
  api.listAdminRequests.mockResolvedValue(inbox());
  api.updateRequestStatus.mockResolvedValue({ message: 'ok' });
});

describe('RequestsHubScreen', () => {
  it('shows the four categories with unread badges and opens a list', async () => {
    await renderScreen(<RequestsHubScreen />);
    expect(await screen.findByText('Leave Request')).toBeTruthy();
    expect(screen.getByText('Permission Request')).toBeTruthy();
    expect(screen.getByText('Shift Change Request')).toBeTruthy();
    expect(screen.getByText('Device Change Request')).toBeTruthy();
    expect(screen.getByText('Manage Staff Requests')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('requests-hub-leave-badge')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('requests-hub-leave'));
    expect(mockPush).toHaveBeenCalledWith('/admin/requests/leave');
  });
});

describe('LeaveRequestsScreen', () => {
  it('lists requests, shows the Pending pill and approves every date after confirmation', async () => {
    await renderScreen(<LeaveRequestsScreen />);
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
    expect(screen.getByText('1 Pending')).toBeTruthy();
    expect(screen.getByText('03, 04 Jan 2025')).toBeTruthy();
    expect(screen.getByText('Change to Reject')).toBeTruthy(); // the approved request

    await fireEvent.press(screen.getByTestId('request-l1-approve'));
    await waitFor(() => expect(api.updateRequestStatus).toHaveBeenCalledTimes(2));
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Approve Leave', message: 'Approve leave for Asha Verma on 03, 04 Jan 2025?' }));
    expect(api.updateRequestStatus).toHaveBeenCalledWith({ requestId: 'l1', status: 'approved', actionBy: 'u1', roleId: 1, date: '2025-01-03' });
    expect(api.updateRequestStatus).toHaveBeenCalledWith({ requestId: 'l1', status: 'approved', actionBy: 'u1', roleId: 1, date: '2025-01-04' });
  });

  it('does not call the API when the confirmation is cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    await renderScreen(<LeaveRequestsScreen />);
    await fireEvent.press(await screen.findByTestId('request-l1-reject'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(api.updateRequestStatus).not.toHaveBeenCalled();
  });

  it('sends the manager role id', async () => {
    signInAs(2);
    await renderScreen(<LeaveRequestsScreen />);
    await fireEvent.press(await screen.findByTestId('request-l1-approve'));
    await waitFor(() => expect(api.updateRequestStatus).toHaveBeenCalled());
    expect(api.updateRequestStatus).toHaveBeenCalledWith(expect.objectContaining({ roleId: 2 }));
  });

  it('marks the leave pending requests as seen when the list opens', async () => {
    await renderScreen(<LeaveRequestsScreen />);
    await screen.findByText('Asha Verma');
    await waitFor(() => expect(useSeenStore.getState().seen['org1:u1']?.leave).toEqual(['l1']));
  });

  it('an empty leave request is decided with ONE call without a date', async () => {
    api.listAdminRequests.mockResolvedValue([makeRequest('leave', { id: 'l9', dates: [] })]);
    await renderScreen(<LeaveRequestsScreen />);
    await fireEvent.press(await screen.findByTestId('request-l9-approve'));
    await waitFor(() => expect(api.updateRequestStatus).toHaveBeenCalledTimes(1));
    expect(api.updateRequestStatus).toHaveBeenCalledWith({ requestId: 'l9', status: 'approved', actionBy: 'u1', roleId: 1, date: undefined });
  });

  it('shows the empty state', async () => {
    api.listAdminRequests.mockResolvedValue([]);
    await renderScreen(<LeaveRequestsScreen />);
    expect(await screen.findByText('No leave requests found')).toBeTruthy();
  });
});

describe('PermissionRequestsScreen', () => {
  it('groups cards per date with their own status and acts on that date only', async () => {
    await renderScreen(<PermissionRequestsScreen />);
    // group header + the "Req. Date" row of the card
    expect(await screen.findAllByText('07 Jan 2025')).toHaveLength(2);
    expect(screen.getAllByText('05 Jan 2025')).toHaveLength(2);
    expect(screen.getAllByText('2:30 PM – 4:00 PM')).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('request-p1-2025-01-07-approve'));
    await waitFor(() => expect(api.updateRequestStatus).toHaveBeenCalledTimes(1));
    expect(api.updateRequestStatus).toHaveBeenCalledWith({ requestId: 'p1', status: 'approved', actionBy: 'u1', roleId: 1, date: '2025-01-07' });
  });
});

describe('ShiftChangeRequestsScreen / DeviceChangeRequestsScreen', () => {
  it('shift change: shows both shifts and decides the whole request', async () => {
    await renderScreen(<ShiftChangeRequestsScreen />);
    expect(await screen.findByText('Kabir Shah')).toBeTruthy();
    expect(screen.getByText('09:00 AM - 06:00 PM')).toBeTruthy();
    expect(screen.getByText('10:00 AM - 07:00 PM')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('request-s1-reject'));
    await waitFor(() => expect(api.updateRequestStatus).toHaveBeenCalledWith({ requestId: 's1', status: 'rejected', actionBy: 'u1', roleId: 1, date: undefined }));
  });

  it('device change: shows model and OS only when provided', async () => {
    await renderScreen(<DeviceChangeRequestsScreen />);
    expect(await screen.findByText('Pixel 8')).toBeTruthy();
    expect(screen.getByText('Android 15')).toBeTruthy();
  });

  it('a server rejection is surfaced and never reported as success', async () => {
    api.updateRequestStatus.mockRejectedValue(new Error('Not allowed'));
    await renderScreen(<DeviceChangeRequestsScreen />);
    await fireEvent.press(await screen.findByTestId('request-d1-approve'));
    await waitFor(() => expect(api.updateRequestStatus).toHaveBeenCalled());
    expect(screen.queryByText('Request Approved')).toBeNull();
  });
});
