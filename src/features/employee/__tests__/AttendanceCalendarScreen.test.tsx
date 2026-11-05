/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { attendanceApi, homeApi, payrollApi, requestsApi, salaryReportsApi, shiftsApi, staffApi } from '@/api';

import AttendanceCalendarScreen from '../screens/AttendanceCalendarScreen';
import { renderScreen, signInAs, staffSession, mockOf as m } from './harness';

// 2026-10-16 (a Friday) is "today": October 2026 is the current month and the 18th is a Sunday.
jest.mock('@/lib/datetime', () => ({
  ...jest.requireActual('@/lib/datetime'),
  todayIST: () => '2026-10-16',
  currentMonthIST: () => ({ year: 2026, month: 10 }),
}));
jest.mock('expo-router', () => require('./harness').routerMock());
jest.mock('@/components/layout', () => require('./harness').layoutMock());
jest.mock('@/api', () => ({
  attendanceApi: { getSessions: jest.fn() },
  homeApi: { getMonthlyAttendance: jest.fn() },
  payrollApi: { getAssignedPayslipId: jest.fn(), getPayslipPreview: jest.fn() },
  requestsApi: { getRequestCalendar: jest.fn(), listEmployeeRequests: jest.fn() },
  salaryReportsApi: { listUserAdvances: jest.fn() },
  shiftsApi: { listShifts: jest.fn() },
  staffApi: { getStaff: jest.fn() },
}));

const rec = (date: string, over: Record<string, unknown> = {}) => ({ date, status: 'present', raw: {}, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  signInAs(staffSession);
  m(homeApi.getMonthlyAttendance).mockResolvedValue({
    days: [
      rec('2026-10-14', { punchIn: '09:00', punchOut: '18:00', totalHours: 9, punchInPhoto: 'https://img/in.jpg' }),
      rec('2026-10-15', { status: 'late', punchIn: '10:00', punchOut: '13:30', totalHours: 3.5 }),
    ],
  });
  m(requestsApi.getRequestCalendar).mockResolvedValue([{ date: '2026-10-13', status: 'approved', type: 'leave' }]);
  m(requestsApi.listEmployeeRequests).mockResolvedValue([]);
  m(staffApi.getStaff).mockResolvedValue({ name: 'Asha Rao', shiftId: 4 });
  m(shiftsApi.listShifts).mockResolvedValue([{ id: 4, name: 'General', startTime: '09:00', endTime: '18:00', isActive: true, raw: {} }]);
  m(attendanceApi.getSessions).mockResolvedValue([
    { punchIn: '09:00', punchOut: '13:00', punchInPhoto: 'https://img/in.jpg' },
    { punchIn: '14:00', punchOut: '18:00' },
  ]);
  m(payrollApi.getAssignedPayslipId).mockResolvedValue(null);
  m(salaryReportsApi.listUserAdvances).mockResolvedValue([]);
});


describe('AttendanceCalendarScreen', () => {
  it('renders the month with the legend and colour-coded days (present, half day, leave, absent, Sunday)', async () => {
    await renderScreen(<AttendanceCalendarScreen />);
    expect(screen.getByText('Attendance Calendar')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());
    expect(m(homeApi.getMonthlyAttendance)).toHaveBeenCalledWith('u1', 'org1', 10, 2026);

    const legend = within(screen.getByTestId('calendar-legend'));
    for (const label of ['Present', 'Absent', 'Leave', 'Half Day', 'Sunday']) expect(legend.getByText(label)).toBeTruthy();

    // 15th: late and under half a shift -> Half Day (HALF), not Late
    expect(within(screen.getByTestId('day-2026-10-15')).getByText('HALF')).toBeTruthy();
    // 14th present, no caption
    expect(within(screen.getByTestId('day-2026-10-14')).queryByText('HALF')).toBeNull();
    // 13th has no attendance record but approved leave -> a coloured (non-absent) cell is rendered
    expect(screen.getByTestId('day-2026-10-13')).toBeTruthy();
    expect(screen.getByText('Advance Salary')).toBeTruthy();
    expect(screen.getByText('Payslip')).toBeTruthy();
  });

  it('opens the day sheet with the sessions, shift, status and total hours', async () => {
    await renderScreen(<AttendanceCalendarScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());
    await fireEvent.press(screen.getByLabelText(/^14 October 2026/));
    expect(await screen.findByText('Attendance Details')).toBeTruthy();
    expect(attendanceApi.getSessions).toHaveBeenCalledWith('u1', '2026-10-14');
    expect(await screen.findByText('SESSION 1')).toBeTruthy();
    expect(screen.getByText('SESSION 2')).toBeTruthy();
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    expect(await screen.findByText('Asha Rao')).toBeTruthy();
    expect(screen.getByTestId('day-shift').props.children).toBe('09:00 AM – 06:00 PM');
    expect(within(screen.getByTestId('day-status')).getByText('Present')).toBeTruthy();
    expect(screen.getByTestId('day-total-hours').props.children).toBe('9h');
  });

  it('reads Half Day in the sheet for a client-derived half day (v1 said Present/Late)', async () => {
    await renderScreen(<AttendanceCalendarScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());
    await fireEvent.press(screen.getByLabelText(/^15 October 2026/));
    expect(await screen.findByText('Attendance Details')).toBeTruthy();
    expect(within(screen.getByTestId('day-status')).getByText('Half Day')).toBeTruthy();
  });

  it('falls back to the single pair of the monthly record when the sessions request fails', async () => {
    m(attendanceApi.getSessions).mockRejectedValue(new Error('boom'));
    await renderScreen(<AttendanceCalendarScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());
    await fireEvent.press(screen.getByLabelText(/^14 October 2026/));
    expect(await screen.findByText('SESSION 1')).toBeTruthy();
    expect(screen.queryByText('SESSION 2')).toBeNull();
  });

  it('opens an Absent sheet for an elapsed day without a record but ignores today and future days', async () => {
    await renderScreen(<AttendanceCalendarScreen />);
    await waitFor(() => expect(screen.queryByTestId('calendar-loading')).toBeNull());
    await act(async () => {
      await fireEvent.press(screen.getByLabelText(/^16 October 2026/)); // today, no record
      await fireEvent.press(screen.getByLabelText(/^20 October 2026/)); // future
    });
    expect(screen.queryByText('Attendance Details')).toBeNull();
    await fireEvent.press(screen.getByLabelText(/^12 October 2026/)); // elapsed, no record
    expect(await screen.findByText('Attendance Details')).toBeTruthy();
    expect(within(screen.getByTestId('day-status')).getByText('Absent')).toBeTruthy();
  });

  it('shows a retry state instead of an all-Absent month when the month request fails', async () => {
    m(homeApi.getMonthlyAttendance).mockRejectedValueOnce(new Error('down')).mockResolvedValue({ days: [] });
    await renderScreen(<AttendanceCalendarScreen />);
    expect(await screen.findByText('Could not load your attendance for this month.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.queryByText('Could not load your attendance for this month.')).toBeNull());
  });

  it('shows "No payslip assigned yet." when none is assigned and the payslip with words when there is one', async () => {
    await renderScreen(<AttendanceCalendarScreen />);
    await fireEvent.press(screen.getByTestId('open-payslip'));
    expect(await screen.findByText('No payslip assigned yet.')).toBeTruthy();
  });

  it('renders the assigned payslip: earnings, deductions, net pay and amount in words', async () => {
    m(payrollApi.getAssignedPayslipId).mockResolvedValue('p1');
    m(payrollApi.getPayslipPreview).mockResolvedValue({
      orgName: 'Acme Corp',
      payslipName: 'Standard',
      month: 'October',
      year: 2026,
      staffName: 'Asha Rao',
      empId: 'E1',
      department: 'Ops',
      branch: 'HQ',
      earnings: [{ name: 'Basic', amount: 40000 }],
      totalEarnings: 40000,
      deductions: [{ name: 'PF', amount: 1800 }],
      totalDeductions: 1800,
      netPay: 38200.5,
    });
    await renderScreen(<AttendanceCalendarScreen />);
    await fireEvent.press(screen.getByTestId('open-payslip'));
    expect(await screen.findByTestId('payslip-title')).toBeTruthy();
    expect(screen.getByTestId('payslip-title').props.children).toBe('Standard — October 2026');
    expect(screen.getByText('Total Earnings')).toBeTruthy();
    expect(screen.getByText('Total Deductions')).toBeTruthy();
    expect(screen.getByTestId('payslip-words').props.children).toBe('Thirty Eight Thousand Two Hundred Rupees Only');
    expect(payrollApi.getPayslipPreview).toHaveBeenCalledWith('org1', 'u1', 'p1');
  });

  it('lists bonus / advance records or the empty text', async () => {
    await renderScreen(<AttendanceCalendarScreen />);
    await fireEvent.press(screen.getByTestId('open-bonus'));
    expect(await screen.findByText('No bonus or advance records yet.')).toBeTruthy();
  });

  it('shows advance rows with amount, date and who added them', async () => {
    m(salaryReportsApi.listUserAdvances).mockResolvedValue([{ id: 'a1', userId: 'u1', employeeName: '', empId: '', amount: 5000, date: '2026-10-01', createdBy: 'adm-1', raw: { created_by_name: 'Admin' } }]);
    await renderScreen(<AttendanceCalendarScreen />);
    await fireEvent.press(screen.getByTestId('open-bonus'));
    expect(await screen.findByText('Added by: Admin')).toBeTruthy();
    expect(screen.getByText('Bonus / Advance')).toBeTruthy();
  });
});
