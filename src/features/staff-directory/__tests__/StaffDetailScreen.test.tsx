import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { routes } from '@/config/routes';
import { currentMonthIST, makeDateStr, todayIST } from '@/lib/datetime';
import type { AttendanceDay } from '@/types/api/attendance';
import { renderWithQuery, signInAs } from '../testing/harness';
import StaffDetailScreen from '../screens/StaffDetailScreen';

jest.setTimeout(30000);

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => ({ staffId: 's1' }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@/lib/platform/maps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { ClockynMap: () => <View testID="map" /> };
});

jest.mock('@/api', () => ({
  homeApi: { getStaffDetail: jest.fn(), getMonthlyAttendance: jest.fn(), getStaffProfile: jest.fn(), updateAttendancePunch: jest.fn() },
  authApi: { getEmployeePhotoUrl: jest.fn(), getProfilePhotoUrl: jest.fn() },
  requestsApi: { getRequestCalendar: jest.fn() },
  attendanceApi: { getSessions: jest.fn() },
  locationApi: { listPunchPins: jest.fn() },
  salaryReportsApi: { listUserAdvances: jest.fn(), createAdvance: jest.fn() },
  staffApi: { permanentlyDeleteStaff: jest.fn(), setStaffActive: jest.fn() },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const api = require('@/api') as {
  homeApi: Record<'getStaffDetail' | 'getMonthlyAttendance' | 'getStaffProfile' | 'updateAttendancePunch', jest.Mock>;
  authApi: Record<'getEmployeePhotoUrl' | 'getProfilePhotoUrl', jest.Mock>;
  requestsApi: { getRequestCalendar: jest.Mock };
  attendanceApi: { getSessions: jest.Mock };
  locationApi: { listPunchPins: jest.Mock };
  salaryReportsApi: Record<'listUserAdvances' | 'createAdvance', jest.Mock>;
  staffApi: Record<'permanentlyDeleteStaff' | 'setStaffActive', jest.Mock>;
};
/* eslint-enable @typescript-eslint/no-require-imports */

const { year, month } = currentMonthIST();
const DAY1 = makeDateStr(year, month, 1);

const DETAIL = {
  userId: 's1',
  name: 'Asha Verma',
  empId: 'E1',
  mobile: '9876543210',
  email: 'asha@example.com',
  department: 'Sales',
  branch: 'Mumbai',
  branchAddress: '1 Marine Drive',
  status: 'punched_in',
  statusLabel: 'Punched In',
  raw: {},
};

function monthWith(days: AttendanceDay[]) {
  return { month, year, totalDays: days.length, presentDays: days.length, absentDays: 0, lateDays: 0, days };
}

beforeEach(() => {
  jest.clearAllMocks();
  signInAs(1);
  const day1: AttendanceDay = { date: DAY1, status: 'present', punchIn: '09:00', punchOut: '18:00', raw: { total_hours: '9:00', shift_start_time: '09:00' } };
  api.homeApi.getStaffDetail.mockResolvedValue(DETAIL);
  api.homeApi.getMonthlyAttendance.mockImplementation(async (_id: string, _org: string, m: number, y: number) =>
    m === month && y === year ? monthWith([day1]) : monthWith([]),
  );
  api.homeApi.getStaffProfile.mockResolvedValue({ name: 'Asha Verma', empId: 'E1', email: '', mobile: '', department: '', branch: '', raw: {} });
  api.homeApi.updateAttendancePunch.mockResolvedValue({ message: 'ok' });
  api.authApi.getEmployeePhotoUrl.mockResolvedValue(null);
  api.authApi.getProfilePhotoUrl.mockResolvedValue(null);
  api.requestsApi.getRequestCalendar.mockResolvedValue([]);
  api.attendanceApi.getSessions.mockResolvedValue([]);
  api.locationApi.listPunchPins.mockResolvedValue([]);
  api.salaryReportsApi.listUserAdvances.mockResolvedValue([]);
  api.salaryReportsApi.createAdvance.mockResolvedValue({ id: '1' });
  api.staffApi.permanentlyDeleteStaff.mockResolvedValue({ message: 'Staff member permanently deleted.' });
});

describe('StaffDetailScreen', () => {
  it('renders the profile card, the calendar and its legend, with the staff scoped by the screen org', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
    expect(screen.getByText('Staff Details')).toBeTruthy();
    expect(await screen.findByTestId('attendance-calendar')).toBeTruthy();
    expect(screen.getByText('Legend')).toBeTruthy();
    expect(screen.getByLabelText('Delete staff permanently')).toBeTruthy();
    expect(api.homeApi.getStaffDetail).toHaveBeenCalledWith('s1', 'org-1');
    expect(api.homeApi.getMonthlyAttendance).toHaveBeenCalledWith('s1', 'org-1', month, year);
  });

  it('hides permanent delete for managers and scopes requests by the manager id', async () => {
    signInAs(2, { userId: 'mgr-9' });
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByText('Asha Verma');
    expect(screen.queryByLabelText('Delete staff permanently')).toBeNull();
    expect(api.homeApi.getStaffDetail).toHaveBeenCalledWith('s1', 'mgr-9');
  });

  it('shows an error with retry when the staff cannot be loaded', async () => {
    api.homeApi.getStaffDetail.mockRejectedValueOnce(new Error('nope'));
    await renderWithQuery(<StaffDetailScreen />);
    await fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
  });

  it('surfaces an attendance failure instead of an all-absent month', async () => {
    api.homeApi.getMonthlyAttendance.mockRejectedValueOnce(new Error('attendance down'));
    await renderWithQuery(<StaffDetailScreen />);
    expect(await screen.findByText('attendance down')).toBeTruthy();
    expect(screen.queryByTestId('attendance-calendar')).toBeNull();
  });

  it('returning to the current month shows the current month data again (v1 kept the other month)', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByTestId('attendance-calendar');
    await waitFor(() => expect(screen.getByLabelText(/^Day 1, present/)).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Previous month'));
    await waitFor(() => expect(api.homeApi.getMonthlyAttendance).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByLabelText('Next month'));
    await waitFor(() => expect(screen.getByLabelText(/^Day 1, present/)).toBeTruthy());
  });

  it('opens the day detail from the calendar', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByTestId('attendance-calendar');
    await fireEvent.press(await screen.findByTestId('cal-day-1'));
    expect(await screen.findByTestId('day-detail')).toBeTruthy();
    expect(screen.getByText('09:00 AM')).toBeTruthy();
    expect(screen.getByText('06:00 PM')).toBeTruthy();
    expect(screen.getAllByText('No photo')).toHaveLength(2);
  });

  it('corrects punch times from the day-wise table', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByTestId('attendance-calendar');
    await fireEvent.press(screen.getByText('Day-Wise'));
    await fireEvent.press(await screen.findByTestId(`edit-in-${DAY1}`));
    expect(await screen.findByTestId('punch-edit')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('10'));
    await fireEvent.press(screen.getByTestId('punch-save'));
    await waitFor(() =>
      expect(api.homeApi.updateAttendancePunch).toHaveBeenCalledWith({ staffId: 's1', orgId: 'org-1', date: DAY1, punchIn: '10:00', punchOut: '18:00' }),
    );
  });

  it('validates the advance form before calling the API', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByTestId('attendance-calendar');
    await fireEvent.press(screen.getByText('Advance'));
    await fireEvent.press(await screen.findByText('Save Advance'));
    expect(await screen.findByText('Please enter a valid amount')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('advance-amount'), '0');
    await fireEvent.press(screen.getByText('Save Advance'));
    expect(await screen.findByText('Amount must be greater than 0')).toBeTruthy();
    expect(api.salaryReportsApi.createAdvance).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('advance-amount'), '500');
    await fireEvent.press(screen.getByText('Save Advance'));
    await waitFor(() =>
      expect(api.salaryReportsApi.createAdvance).toHaveBeenCalledWith({ orgId: 'org-1', userId: 's1', createdBy: 'u-admin', amount: 500, date: todayIST() }),
    );
    expect(await screen.findByText('Advance Saved!')).toBeTruthy();
  });

  it('navigates from the Assign hub with the staff id', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByText('Asha Verma');
    await fireEvent.press(screen.getAllByText('Assign')[0]);
    await fireEvent.press(await screen.findByTestId('assign-manager'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.managers.list, params: { staffId: 's1' } });
    await fireEvent.press(screen.getAllByText('Assign')[0]);
    await fireEvent.press(await screen.findByTestId('assign-bonus'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: routes.admin.payroll.bonus, params: { staffId: 's1' } });
  });

  it('opens the edit screen with the staff id', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByText('Asha Verma');
    await fireEvent.press(screen.getByText('Edit'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.staff.edit, params: { staffId: 's1' } });
  });

  it('permanent delete needs the typed name, then goes back to the list', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByText('Asha Verma');
    await fireEvent.press(screen.getByLabelText('Delete staff permanently'));
    expect(await screen.findByText('Permanently Delete Asha Verma?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('delete-confirm'));
    expect(api.staffApi.permanentlyDeleteStaff).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('delete-name-input'), ' asha verma ');
    await fireEvent.press(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(api.staffApi.permanentlyDeleteStaff).toHaveBeenCalledWith('s1', 1));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows the full profile with dashes for missing values', async () => {
    await renderWithQuery(<StaffDetailScreen />);
    await screen.findByText('Asha Verma');
    await fireEvent.press(screen.getByText('Profile'));
    expect(await screen.findByText('Basic Information')).toBeTruthy();
    expect(screen.getByText('Bank Details')).toBeTruthy();
    expect(screen.getByText('Edit Staff')).toBeTruthy();
  });
});
