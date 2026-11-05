import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { attendanceApi, authApi, homeApi } from '@/api';
import { signIn, useAuthStore, type Session } from '@/store/auth';
import { ThemeProvider } from '@/theme';
import type { DailyAttendanceRow, StaffMember } from '@/types/api/staff';

import OverviewScreen from '../OverviewScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => ({ date: '2026-10-10', branchId: 'b1' }),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/api', () => ({
  homeApi: {
    getDashboardStats: jest.fn(),
    getBranches: jest.fn(),
    getStaffByStatus: jest.fn(),
    getDailyAttendance: jest.fn(),
    getMonthlyAttendance: jest.fn(),
  },
  attendanceApi: { getSessions: jest.fn() },
  authApi: { getEmployeePhotoUrl: jest.fn() },
}));

const admin: Session = { userId: 'admin-1', orgId: 'org-1', orgName: 'Acme Corp', roleId: 1, managerPermissions: [] };

const member = (userId: string, name: string, over: Partial<StaffMember> = {}): StaffMember => ({
  userId,
  name,
  empId: `E-${userId}`,
  mobile: '',
  email: '',
  department: 'Sales',
  branch: 'Head Office',
  status: 'working',
  statusLabel: 'Working',
  isActive: true,
  raw: {},
  ...over,
});
const daily = (userId: string, name: string, over: Partial<DailyAttendanceRow> = {}): DailyAttendanceRow => ({ ...member(userId, name), ...over });

let client: QueryClient;
function renderOverview() {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <OverviewScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useAuthStore.setState({ session: null });
  signIn(admin);
  (homeApi.getBranches as jest.Mock).mockResolvedValue([{ id: 'b1', name: 'Head Office', address: '', orgId: 'org-1', latitude: 0, longitude: 0, radius: 100, raw: {} }]);
  (homeApi.getDashboardStats as jest.Mock).mockResolvedValue({ totalStaff: 3, punchedIn: 1, working: 1, punchedOut: 1, absent: 1, latePunchedIn: 0 });
  (homeApi.getDailyAttendance as jest.Mock).mockResolvedValue([
    daily('u2', 'bob', { punchIn: '09:05', punchOut: '18:00', totalHours: 8.5, status: 'punched_out', statusLabel: 'Punched Out' }),
    daily('u1', 'Alice', { punchIn: '10:00' }),
    daily('u3', 'Carl', { status: 'absent', statusLabel: 'Absent' }),
  ]);
  (homeApi.getStaffByStatus as jest.Mock).mockResolvedValue([member('u3', 'Carl', { status: 'absent', statusLabel: 'Absent' })]);
  (homeApi.getMonthlyAttendance as jest.Mock).mockResolvedValue({
    month: 10,
    year: 2026,
    totalDays: 31,
    presentDays: 1,
    absentDays: 0,
    lateDays: 0,
    days: [{ date: '2026-10-10', status: 'present', punchIn: '09:05', punchOut: '18:00', totalHours: 8.5, raw: {} }],
  });
  (attendanceApi.getSessions as jest.Mock).mockResolvedValue([
    { punchIn: '09:05', punchOut: '13:00' },
    { punchIn: '14:00', punchOut: '18:00' },
  ]);
  (authApi.getEmployeePhotoUrl as jest.Mock).mockResolvedValue(null);
});
afterEach(() => client.clear());

describe('OverviewScreen', () => {
  it('shows the date from the route, the six counts and the staff A-Z with their punch times', async () => {
    await renderOverview();
    expect(screen.getByTestId('date-banner-text').props.children).toBe('10 Oct 2026');
    expect(await screen.findByText('Alice')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('tile-total-value').props.children).toBe(3));
    expect(screen.getByTestId('tile-absent-value').props.children).toBe(1);
    expect(screen.getByTestId('staff-count').props.accessibilityLabel).toBe('3 Staff');
    const names = screen.getAllByText(/^(Alice|bob|Carl)$/).map((n) => n.props.children);
    expect(names).toEqual(['Alice', 'bob', 'Carl']);
    expect(screen.getByText('10:00 AM')).toBeTruthy();
    // The branch filter of the dashboard is honoured (v1 ignored it).
    expect(homeApi.getDashboardStats).toHaveBeenCalledWith('org-1', { date: '2026-10-10', branchId: 'b1' });
    expect(homeApi.getDailyAttendance).toHaveBeenCalledWith('org-1', '2026-10-10', { branchId: 'b1' });
  });

  it('loads the matching bucket for the selected date and branch when a status circle is tapped', async () => {
    await renderOverview();
    await screen.findByText('Alice');
    await fireEvent.press(screen.getByTestId('tile-absent'));
    await waitFor(() => expect(homeApi.getStaffByStatus).toHaveBeenCalledWith('absent', 'org-1', { date: '2026-10-10', branchId: 'b1' }));
    expect(await screen.findByText('Carl')).toBeTruthy();
    expect(screen.queryByText('Alice')).toBeNull();
  });

  it('shows the empty state for an empty bucket', async () => {
    (homeApi.getStaffByStatus as jest.Mock).mockResolvedValue([]);
    await renderOverview();
    await screen.findByText('Alice');
    await fireEvent.press(screen.getByTestId('tile-late'));
    expect(await screen.findByText('No Staff Found')).toBeTruthy();
    expect(screen.getByText('No staff in "Late" for this date')).toBeTruthy();
  });

  it('opens a staff day with sessions and total hours, and back returns to the list', async () => {
    await renderOverview();
    await fireEvent.press(await screen.findByTestId('staff-row-u2'));
    expect(await screen.findByText('Total Hours')).toBeTruthy();
    expect(screen.getByTestId('total-hours').props.children).toBe('08:30');
    expect(screen.getByText('SESSION 1')).toBeTruthy();
    expect(screen.getByText('SESSION 2')).toBeTruthy();
    expect(screen.getAllByText('No photo').length).toBeGreaterThan(0);
    expect(attendanceApi.getSessions).toHaveBeenCalledWith('u2', '2026-10-10');

    // Header back closes the detail first (the screen is not left yet).
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(await screen.findByTestId('status-tiles')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
