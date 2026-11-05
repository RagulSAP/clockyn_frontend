import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { mapAnnouncement } from '@/api/announcements';
import { ToastProvider } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider } from '@/theme';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import AnnouncementsTargetedScreen from '../screens/AnnouncementsTargetedScreen';

const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockList = jest.fn();

jest.mock('@/api/announcements', () => ({
  ...jest.requireActual('@/api/announcements'),
  createAnnouncement: (...a: unknown[]) => mockCreate(...a),
  deleteAnnouncement: (...a: unknown[]) => mockDelete(...a),
  listAnnouncements: (...a: unknown[]) => mockList(...a),
}));
jest.mock('@/api/home', () => ({
  getAllStaff: jest.fn(async () => [
    { userId: 'u1', name: 'Asha Verma', department: 'Sales', branch: 'Pune', empId: '', mobile: '', email: '', status: 'absent', statusLabel: '', isActive: true, raw: {} },
    { userId: 'u2', name: 'Rahul Nair', department: 'Ops', branch: 'Chennai', empId: '', mobile: '', email: '', status: 'absent', statusLabel: '', isActive: true, raw: {} },
  ]),
}));
jest.mock('@/api/branches', () => ({ listBranches: jest.fn(async () => [{ id: '7', name: 'Chennai', address: '', orgId: 'org1', latitude: 0, longitude: 0, radius: 100, raw: {} }]) }));
jest.mock('@/api/departments', () => ({ listDepartments: jest.fn(async () => [{ id: 'D1', name: 'Sales', orgId: 'org1', raw: {} }]) }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const HISTORY = [
  mapAnnouncement({ id: 'a1', title: 'Payroll update', message: 'Salaries on the 5th', target: 'all', sent_by: 'Admin', created_at: '2026-10-17T05:00:00Z' }),
  mapAnnouncement({ id: 'a2', title: 'Training', message: 'Room 2', target: 'selected', recipient_count: 4, created_at: '2026-10-17T05:00:00Z' }),
  mapAnnouncement({ id: 'a3', title: 'Diwali', message: 'Sweets for all', target: 'branch', branch_name: 'Chennai', created_at: '2026-10-17T05:00:00Z' }),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue(HISTORY);
  mockCreate.mockResolvedValue({ id: 'new', recipientCount: 0 });
  mockDelete.mockResolvedValue(undefined);
  useAuthStore.setState({ session: { userId: 'admin1', orgId: 'org1', orgName: 'Acme', roleId: 1, managerPermissions: [] }, hydrated: true });
});

describe('AnnouncementsScreen (admin: all / selected staff)', () => {
  it('sends to all staff and shows the success dialog; the send button is disabled until the form is valid', async () => {
    await renderScreen(<AnnouncementsScreen />);
    const send = screen.getByTestId('announcement-send');
    expect(send.props.accessibilityState?.disabled ?? send.props['aria-disabled']).toBeTruthy();
    expect(screen.getByText('Send to All Staff')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('announcement-title'), '  Holiday ');
    await fireEvent.changeText(screen.getByTestId('announcement-message'), 'Office closed on Friday');
    expect(screen.getByText('10/100')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('announcement-send'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ orgId: 'org1', sentById: 'admin1', target: 'all', title: '  Holiday ', message: 'Office closed on Friday' });
    expect(await screen.findByText('Announcement Sent!')).toBeTruthy();
    expect(await screen.findByText('All staff have been notified')).toBeTruthy();
    // the form was reset
    expect(screen.getByTestId('announcement-title').props.value).toBe('');
  });

  it('selected staff: picker, chips, payload and the CORRECT success subtitle (v1 bug)', async () => {
    await renderScreen(<AnnouncementsScreen />);
    await fireEvent.changeText(screen.getByTestId('announcement-title'), 'Training');
    await fireEvent.changeText(screen.getByTestId('announcement-message'), 'Room 2 at 10');
    await fireEvent.press(screen.getByText('Select Staff'));

    await fireEvent.press(await screen.findByTestId('staff-row-u1'));
    await fireEvent.press(screen.getByTestId('staff-row-u2'));
    expect(screen.getByText('Done (2)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('staff-picker-done'));

    expect(await screen.findByText('2 members selected')).toBeTruthy();
    expect(screen.getByText('Send to 2 Staff')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('announcement-send'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ target: 'selected', selectedUserIds: ['u1', 'u2'] });
    expect(await screen.findByText('2 staff members notified')).toBeTruthy();
    // the audience resets to All Staff afterwards
    expect(screen.getByText('Send to All Staff')).toBeTruthy();
  });

  it('keeps the form and does not show the success dialog when sending fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Server says no'));
    await renderScreen(<AnnouncementsScreen />);
    await fireEvent.changeText(screen.getByTestId('announcement-title'), 'Hello');
    await fireEvent.changeText(screen.getByTestId('announcement-message'), 'World');
    await fireEvent.press(screen.getByTestId('announcement-send'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(await screen.findByText('Server says no')).toBeTruthy();
    expect(screen.queryByText('Announcement Sent!')).toBeNull();
    expect(screen.getByTestId('announcement-title').props.value).toBe('Hello');
  });

  it('history tab lists every announcement with audience tags, searches and deletes after confirmation', async () => {
    await renderScreen(<AnnouncementsScreen />);
    await fireEvent.press(await screen.findByText('History'));
    expect(await screen.findByText('Payroll update')).toBeTruthy();
    expect(screen.getByText('All Staff')).toBeTruthy();
    expect(screen.getByText('4 Staff')).toBeTruthy();
    expect(screen.getByText('Chennai')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('announcement-search'), 'training');
    expect(screen.queryByText('Payroll update')).toBeNull();
    expect(screen.getByText('Training')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('announcement-search'), 'zzz');
    expect(await screen.findByText('No results')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('announcement-search'), '');

    await fireEvent.press(screen.getByTestId('announcement-a1-delete'));
    expect(await screen.findByText('Delete Announcement?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('a1'));
    expect(await screen.findByText('Announcement deleted')).toBeTruthy();
  });
});

describe('AnnouncementsTargetedScreen (admin: branch / department)', () => {
  it('sends to one branch with the branch id and shows "<branch> staff notified"', async () => {
    await renderScreen(<AnnouncementsTargetedScreen />);
    expect(screen.getByText('Targeted Announcement')).toBeTruthy();
    expect(screen.getByText('Send to Branch')).toBeTruthy(); // fallback label until a branch is chosen
    await fireEvent.changeText(screen.getByTestId('announcement-title'), 'Diwali');
    await fireEvent.changeText(screen.getByTestId('announcement-message'), 'Sweets for all');
    await fireEvent.press(await screen.findByTestId('target-option-7'));
    expect(within(screen.getByTestId('announcement-sending-to')).getByText('Chennai')).toBeTruthy();
    expect(screen.getByText('Send to Chennai')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('announcement-send'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ target: 'branch', branchId: '7' });
    expect(await screen.findByText('Chennai staff notified')).toBeTruthy();
  });

  it('switching to Department clears the branch and sends the department id', async () => {
    await renderScreen(<AnnouncementsTargetedScreen />);
    await fireEvent.changeText(screen.getByTestId('announcement-title'), 'Offsite');
    await fireEvent.changeText(screen.getByTestId('announcement-message'), 'Trip on Monday');
    await fireEvent.press(await screen.findByTestId('target-option-7'));
    await fireEvent.press(screen.getByText('Department'));
    expect(screen.queryByTestId('announcement-sending-to')).toBeNull();
    await fireEvent.press(await screen.findByTestId('target-option-D1'));
    await fireEvent.press(screen.getByTestId('announcement-send'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ target: 'dept', deptId: 'D1' });
    expect(await screen.findByText('Sales staff notified')).toBeTruthy();
  });

  it('history only lists branch / department announcements', async () => {
    await renderScreen(<AnnouncementsTargetedScreen />);
    await fireEvent.press(await screen.findByText('History'));
    expect(await screen.findByText('Diwali')).toBeTruthy();
    expect(screen.queryByText('Payroll update')).toBeNull();
    expect(screen.queryByText('Training')).toBeNull();
  });
});
