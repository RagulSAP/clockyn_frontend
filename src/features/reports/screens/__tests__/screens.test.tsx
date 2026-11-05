import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { toast } from '@/components/ui';
import { currentMonthIST, monthKey } from '@/lib/datetime';
import { getAllStaff } from '@/api/home';
import { getStaffUnderManager } from '@/api/managers';
import { getEmployeeReportProfile, getOvertimeReport, loadMonthlyAttendanceBatched } from '@/api/reports';
import { listAdminRequests } from '@/api/requests';
import { getStaffSalaryBreakdown, getWorkingDays, listMonthlySalary, listUserAdvances, markSalaryPaid } from '@/api/salaryReports';
import { listShifts } from '@/api/shifts';
import { getStaff } from '@/api/staff';
import { downloadAndOpen, openFile } from '@/lib/platform/files';
import { exportTable } from '@/lib/platform/exporter';
import { routes } from '@/config/routes';
import { day, month, staff } from '../../testing/fixtures';
import { renderScreen, signInAs } from '../../testing/renderScreen';
import EmployeeDetailsReportScreen from '../EmployeeDetailsReportScreen';
import EmployeeShiftsReportScreen from '../EmployeeShiftsReportScreen';
import LateReportScreen from '../LateReportScreen';
import ManagerReportsScreen from '../ManagerReportsScreen';
import MonthlyAttendanceReportScreen from '../MonthlyAttendanceReportScreen';
import MonthlySalaryScreen from '../MonthlySalaryScreen';
import OvertimeReportScreen from '../OvertimeReportScreen';
import ReportsHubScreen from '../ReportsHubScreen';
import SalarySheetScreen from '../SalarySheetScreen';
import StaffDetailedReportScreen from '../StaffDetailedReportScreen';

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() };
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(cb, [cb]);
  },
}));
jest.mock('@/api/home', () => ({ getAllStaff: jest.fn() }));
jest.mock('@/api/managers', () => ({ getStaffUnderManager: jest.fn() }));
jest.mock('@/api/requests', () => ({ listAdminRequests: jest.fn() }));
jest.mock('@/api/reports', () => ({
  ...jest.requireActual('@/api/reports'),
  getOvertimeReport: jest.fn(),
  loadMonthlyAttendanceBatched: jest.fn(),
  getEmployeeReportProfile: jest.fn(),
}));
jest.mock('@/api/salaryReports', () => ({
  getStaffSalaryBreakdown: jest.fn(),
  getWorkingDays: jest.fn(),
  listMonthlySalary: jest.fn(),
  listUserAdvances: jest.fn(),
  markSalaryPaid: jest.fn(),
}));
jest.mock('@/api/shifts', () => ({ listShifts: jest.fn() }));
jest.mock('@/api/staff', () => ({ getStaff: jest.fn() }));
jest.mock('@/lib/platform/exporter', () => ({
  ...jest.requireActual('@/lib/platform/exportFormats'),
  exportTable: jest.fn(),
  exportHtml: jest.fn(),
}));
jest.mock('@/lib/platform/files', () => ({
  downloadAndOpen: jest.fn(),
  openFile: jest.fn(),
  shareFile: jest.fn(),
  savedFileExists: jest.fn(async () => true),
  deleteSavedFile: jest.fn(),
}));

const m = <T extends jest.Mock>(fn: unknown): T => fn as T;

const files = jest.requireMock('@/lib/platform/files') as Record<string, jest.Mock>;

beforeEach(() => {
  // Reset only the mocks of this file (resetting everything would also wipe the AsyncStorage mock the theme relies on).
  [getAllStaff, getStaffUnderManager, getEmployeeReportProfile, getOvertimeReport, loadMonthlyAttendanceBatched, listAdminRequests, getStaffSalaryBreakdown,
    getWorkingDays, listMonthlySalary, listUserAdvances, markSalaryPaid, listShifts, getStaff, downloadAndOpen, openFile, exportTable, mockPush].forEach((fn) =>
    (fn as unknown as jest.Mock).mockReset(),
  );
  files.savedFileExists.mockResolvedValue(true);
  signInAs();
});

describe('ReportsHubScreen', () => {
  it('lists the four categories; enabled rows navigate, placeholders do nothing; View Reports shows the empty state', async () => {
    await renderScreen(<ReportsHubScreen />);
    for (const title of ['Attendance Reports', 'Salary Reports', 'Employee Reports', 'CRM']) expect(screen.getByText(title)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('report-row-Late Report'));
    expect(mockPush).toHaveBeenCalledWith(routes.admin.reports.late);
    mockPush.mockClear();
    await fireEvent.press(screen.getByTestId('report-row-Incentives'));
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('View Reports'));
    expect(await screen.findByText('No reports yet')).toBeTruthy();
  });
});

describe('ManagerReportsScreen', () => {
  it('enables only the 4 manager rows for a manager holding the permission', async () => {
    signInAs({ roleId: 2, userId: 'mgr1', managerPermissions: ['Attendance Reports'] });
    await renderScreen(<ManagerReportsScreen />);
    await fireEvent.press(screen.getByTestId('report-row-Staff-wise Detailed Report'));
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('report-row-Monthly Salary'));
    expect(mockPush).toHaveBeenCalledWith(routes.admin.payroll.monthlySalary);
  });

  it('is gated by the permission', async () => {
    signInAs({ roleId: 2, userId: 'mgr1', managerPermissions: [] });
    await renderScreen(<ManagerReportsScreen />);
    expect(screen.getByText('Reports unavailable')).toBeTruthy();
  });
});

describe('MonthlyAttendanceReportScreen', () => {
  it('downloads the all-staff PDF for the selected month, records it and opens it', async () => {
    const { year, month: mo } = currentMonthIST();
    m(getAllStaff).mockResolvedValue([staff({ userId: 'u1' })]);
    m(downloadAndOpen).mockResolvedValue({ uri: 'file:///a.pdf', filename: `attendance_all_${monthKey(year, mo)}.pdf`, mimeType: 'application/pdf' });
    await renderScreen(<MonthlyAttendanceReportScreen />);
    expect(screen.getByText('All Staff')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('generate-pdf'));
    await waitFor(() => expect(openFile).toHaveBeenCalled());
    expect(downloadAndOpen).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining(`/api/reports/monthly-attendance-all/org1/${monthKey(year, mo)}`), mimeType: 'application/pdf', open: false }),
    );
  });

  it('uses the manager endpoint and lists the manager first as "(Me)"', async () => {
    signInAs({ roleId: 2, userId: 'mgr1', name: 'Mia' });
    m(getStaffUnderManager).mockResolvedValue([{ userId: 'u9', name: 'Team Member', empId: 'E9', branch: '', department: 'Ops' }]);
    await renderScreen(<MonthlyAttendanceReportScreen />);
    await fireEvent.press(screen.getByTestId('staff-picker'));
    expect(await screen.findByText('Mia (Me)')).toBeTruthy();
    expect(screen.getByText('Team Member')).toBeTruthy();
  });
});

describe('StaffDetailedReportScreen', () => {
  it('renders the table rows and exports 22 columns', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a', name: 'Al' }), staff({ userId: 'b', name: 'Bea' })]);
    m(listAdminRequests).mockResolvedValue([]);
    m(loadMonthlyAttendanceBatched).mockResolvedValue({ byUser: new Map([['a', month([day({ totalHours: 8 })])]]), failed: [] });
    m(getWorkingDays).mockResolvedValue({ totalDays: 31, offDays: 4, holidays: 0, workingDays: 27 });
    m(exportTable).mockResolvedValue({ uri: 'file:///x.csv', filename: 'x.csv', mimeType: 'text/csv' });
    await renderScreen(<StaffDetailedReportScreen />);
    expect(await screen.findByText('Al')).toBeTruthy();
    expect(screen.getByText('2 staff')).toBeTruthy();
    expect(screen.getByText('Working Days')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('report-export'));
    await fireEvent.press(await screen.findByTestId('export-csv'));
    await waitFor(() => expect(exportTable).toHaveBeenCalled());
    const call = m(exportTable).mock.calls[0][0];
    expect(call.format).toBe('csv');
    expect(call.columns).toHaveLength(22);
    expect(call.filename).toMatch(/^staff_report_[A-Z][a-z]{2}_\d{4}$/);
  });

  it('shows an error with retry when the staff list fails (no stale rows)', async () => {
    m(getAllStaff).mockRejectedValue(new Error('Server down'));
    m(listAdminRequests).mockResolvedValue([]);
    await renderScreen(<StaffDetailedReportScreen />);
    expect(await screen.findByText('Server down')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});

describe('LateReportScreen', () => {
  it('lists late entries and shows "—" for Late By when the server sends no shift times', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a', name: 'Late Larry' })]);
    m(loadMonthlyAttendanceBatched).mockResolvedValue({ byUser: new Map([['a', month([day({ status: 'late', punchIn: '09:20' })])]]), failed: [] });
    await renderScreen(<LateReportScreen />);
    expect(await screen.findByText('Late Larry')).toBeTruthy();
    expect(screen.getByText('1 late entries')).toBeTruthy();
    expect(screen.getByText('09:20 AM')).toBeTruthy();
    expect(screen.getByText(/Shift times are not provided/)).toBeTruthy();
  });

  it('shows the friendly empty state when nobody was late', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a' })]);
    m(loadMonthlyAttendanceBatched).mockResolvedValue({ byUser: new Map([['a', month([day()])]]), failed: [] });
    await renderScreen(<LateReportScreen />);
    expect(await screen.findByText('No late entries')).toBeTruthy();
  });
});

describe('OvertimeReportScreen', () => {
  it('merges overtime with the staff list and shows a banner when the overtime endpoint fails', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a', name: 'Ola' }), staff({ userId: 'b', name: 'Bo' })]);
    m(getOvertimeReport).mockResolvedValue([{ userId: 'a', otDays: 2, otMinutes: 150, otAmount: 900 }]);
    await renderScreen(<OvertimeReportScreen />);
    expect(await screen.findByText('Ola')).toBeTruthy();
    expect(screen.getByText('1 with OT')).toBeTruthy();
    expect(screen.getByText('2h 30m')).toBeTruthy();
    expect(screen.getByText('₹900')).toBeTruthy();
  });

  it('keeps the rows and explains an overtime failure', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a', name: 'Ola' })]);
    m(getOvertimeReport).mockRejectedValue(new Error('Not Found'));
    await renderScreen(<OvertimeReportScreen />);
    expect(await screen.findByText('Ola')).toBeTruthy();
    expect(screen.getByText(/Overtime figures are unavailable/)).toBeTruthy();
  });
});

describe('EmployeeDetailsReportScreen', () => {
  const people = [staff({ userId: 'a', name: 'Anil', empId: 'E1' }), staff({ userId: 'z', name: 'Zara', empId: 'E2', isActive: false })];

  it('filters the directory, opens a profile and hides empty fields', async () => {
    m(getAllStaff).mockResolvedValue(people);
    m(getEmployeeReportProfile).mockResolvedValue({ userId: 'a', name: 'Anil', empId: 'E1', mobile: '9876543210', email: '-', department: 'Sales', branch: 'HQ', raw: {} });
    await renderScreen(<EmployeeDetailsReportScreen />);
    expect(await screen.findByText('Anil')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('Search by name, ID, dept, branch...'), 'zar');
    expect(screen.queryByText('Anil')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('Search by name, ID, dept, branch...'), '');
    await fireEvent.press(screen.getByTestId('employee-a'));
    expect(await screen.findByText('CONTACT INFORMATION')).toBeTruthy();
    expect(screen.getByText('9876543210')).toBeTruthy();
    expect(screen.queryByText('BANK DETAILS')).toBeNull();
    expect(screen.getByTestId('download-report')).toBeTruthy();
  });

  it('shows a friendly message when an inactive employee profile cannot be loaded', async () => {
    const spy = jest.spyOn(toast, 'error').mockImplementation(() => 0 as never);
    m(getAllStaff).mockResolvedValue(people);
    m(getEmployeeReportProfile).mockRejectedValue(new Error('Failed to get staff profile: 404'));
    await renderScreen(<EmployeeDetailsReportScreen />);
    await fireEvent.press(await screen.findByTestId('employee-z'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Zara is inactive. Profile details are only available for active staff.'));
    expect(screen.queryByText('CONTACT INFORMATION')).toBeNull();
    spy.mockRestore();
  });
});

describe('EmployeeShiftsReportScreen', () => {
  it('shows summary tiles, expands a shift card and lists unassigned staff', async () => {
    m(listShifts).mockResolvedValue([{ id: 1, name: 'Day', startTime: '09:00', endTime: '18:00', isActive: true, raw: {} }]);
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a', name: 'Ann' }), staff({ userId: 'b', name: 'Ben' })]);
    m(getStaff).mockImplementation(async (id: string) => ({ shiftId: id === 'a' ? 1 : undefined }));
    await renderScreen(<EmployeeShiftsReportScreen />);
    expect(await screen.findByText('Total Shifts')).toBeTruthy();
    expect(screen.getByText('09:00 AM – 06:00 PM  ·  9h')).toBeTruthy();
    expect(screen.getAllByText('Unassigned')).toHaveLength(2); // summary tile + card
    expect(screen.queryByText('Ann')).toBeNull(); // cards start collapsed
    await fireEvent.press(screen.getByLabelText('Day, 1 staff'));
    expect(await screen.findByText('Ann')).toBeTruthy();
  });

  it('shows "No shifts created yet" when none exist', async () => {
    m(listShifts).mockResolvedValue([]);
    m(getAllStaff).mockResolvedValue([]);
    await renderScreen(<EmployeeShiftsReportScreen />);
    expect(await screen.findByText('No shifts created yet')).toBeTruthy();
  });
});

describe('MonthlySalaryScreen', () => {
  const entries = [
    { userId: 'a', name: 'Ann', empId: 'E1', deptName: 'Ops', branchName: '', salaryType: '', basicSalary: 100, netSalary: 1000, paid: false, paidDate: null },
    { userId: 'b', name: 'Ben', empId: 'E2', deptName: '', branchName: '', salaryType: '', basicSalary: 100, netSalary: 500, paid: true, paidDate: null },
  ];

  it('derives paid state and real totals from the server list (no "₹—" placeholders)', async () => {
    m(listMonthlySalary).mockResolvedValue(entries);
    await renderScreen(<MonthlySalaryScreen />);
    expect(await screen.findByText('Ann')).toBeTruthy();
    expect(screen.getByText('₹1,500')).toBeTruthy(); // total
    expect(screen.getAllByText('₹1,000').length).toBeGreaterThan(0); // unpaid
    expect(screen.queryByText('₹—')).toBeNull();
    expect(screen.getByText('Pay All (1)')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('marks one employee paid with the selected month/year and shows the success dialog', async () => {
    m(listMonthlySalary).mockResolvedValue(entries);
    m(markSalaryPaid).mockResolvedValue(undefined);
    await renderScreen(<MonthlySalaryScreen />);
    await fireEvent.press(await screen.findByTestId('pay-a'));
    const { year, month: mo } = currentMonthIST();
    await waitFor(() => expect(markSalaryPaid).toHaveBeenCalledWith({ orgId: 'org1', userIds: ['a'], month: mo, year }));
    expect(await screen.findByText('Payment Processed!')).toBeTruthy();
    expect(await screen.findByText('Pay All (0)')).toBeTruthy();
  });

  it('toasts the server error and keeps the employee unpaid when payment fails', async () => {
    const spy = jest.spyOn(toast, 'error').mockImplementation(() => 0 as never);
    m(listMonthlySalary).mockResolvedValue(entries);
    m(markSalaryPaid).mockRejectedValue(new Error('Salary already paid'));
    await renderScreen(<MonthlySalaryScreen />);
    await fireEvent.press(await screen.findByTestId('pay-a'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Salary already paid'));
    expect(screen.getByText('Pay All (1)')).toBeTruthy();
    spy.mockRestore();
  });

  it('falls back to the staff list and says paid marks are local; never spins forever without a session', async () => {
    m(listMonthlySalary).mockRejectedValue(new Error('Not Found'));
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a', name: 'Ann' })]);
    m(getStaffSalaryBreakdown).mockResolvedValue([{ userId: 'a', netSalary: 250 } as never]);
    await renderScreen(<MonthlySalaryScreen />);
    expect(await screen.findByText('Ann')).toBeTruthy();
    expect(screen.getByText(/kept on this screen only/)).toBeTruthy();
    expect(screen.getAllByText('₹250').length).toBeGreaterThan(0);
  });

  it('shows a message instead of an endless spinner when there is no session', async () => {
    const { useAuthStore } = jest.requireActual('@/store/auth');
    useAuthStore.setState({ session: null });
    await renderScreen(<MonthlySalaryScreen />);
    expect(screen.getByText('Session unavailable')).toBeTruthy();
  });
});

describe('SalarySheetScreen', () => {
  const row = (over: Record<string, unknown>) => ({
    userId: 'a', name: 'Sal Ary', empId: 'E1', roleName: 'Employee', branchName: 'HQ', salaryType: 'MONTHLY_FIXED',
    basicSalary: 25000, incentive: 0, incentiveCount: 0, incentiveTurnover: 0, overtime: 0, bonus: 0, fine: 0,
    travelAllowance: 0, odometer: 0, travelTicket: 0, advance: 0, otherBills: 0, dailyWages: 0, hourlyCalc: 0, netSalary: 24000, photoUrl: null,
    ...over,
  });

  it('renders the sheet with formatted amounts, changes the type locally and exports 18 columns', async () => {
    m(getStaffSalaryBreakdown).mockResolvedValue([row({})]);
    m(exportTable).mockResolvedValue({ uri: undefined, filename: 'salary.pdf', mimeType: 'application/pdf' });
    await renderScreen(<SalarySheetScreen />);
    expect(await screen.findByText('Sal Ary')).toBeTruthy();
    expect(screen.getByText('₹25,000')).toBeTruthy();
    expect(screen.getByText('₹24,000')).toBeTruthy();
    expect(screen.getByText('1 staff')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Salary type Monthly, change'));
    await fireEvent.press(await screen.findByTestId('salary-type-HOURLY'));
    expect(await screen.findByText('Hourly')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('report-export'));
    await fireEvent.press(await screen.findByTestId('export-xlsx'));
    await waitFor(() => expect(exportTable).toHaveBeenCalled());
    const call = m(exportTable).mock.calls[0][0];
    expect(call.format).toBe('xlsx');
    expect(call.columns).toHaveLength(18);
    expect(call.rows[0].type).toBe('Hourly');
  });

  it('falls back to zero rows and says why when the breakdown fails', async () => {
    m(getStaffSalaryBreakdown).mockRejectedValue(new Error('Your plan has expired'));
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a', name: 'Zero Zed' })]);
    await renderScreen(<SalarySheetScreen />);
    expect(await screen.findByText('Zero Zed')).toBeTruthy();
    expect(screen.getByText(/Your plan has expired/)).toBeTruthy();
  });

  it('opens the advance drill-down for a row', async () => {
    m(getStaffSalaryBreakdown).mockResolvedValue([row({})]);
    m(listUserAdvances).mockResolvedValue([
      { id: '1', userId: 'a', employeeName: '', empId: '', amount: 1500, date: '2026-10-02', createdBy: 'x', raw: { created_by_name: 'Boss', advance_id: 'ADV9' } },
    ]);
    await renderScreen(<SalarySheetScreen />);
    await fireEvent.press(await screen.findByText('Sal Ary'));
    expect(await screen.findByText('₹1,500.00')).toBeTruthy();
    expect(screen.getByText('Added by: Boss')).toBeTruthy();
    expect(screen.getByText('ID: ADV9')).toBeTruthy();
  });
});
