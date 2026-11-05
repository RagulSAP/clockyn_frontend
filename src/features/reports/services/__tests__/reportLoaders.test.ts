import { QueryClient } from '@tanstack/react-query';
import { getAllStaff } from '@/api/home';
import { listAdminRequests } from '@/api/requests';
import { getOvertimeReport, loadMonthlyAttendanceBatched } from '@/api/reports';
import { getStaffSalaryBreakdown, getWorkingDays, listMonthlySalary } from '@/api/salaryReports';
import { day, month, request, staff } from '../../testing/fixtures';
import { loadLateReport, loadOvertimeReport, loadPaySheet, loadSalarySheet, loadStaffDetailedReport } from '../reportLoaders';

jest.mock('@/api/home', () => ({ getAllStaff: jest.fn() }));
jest.mock('@/api/requests', () => ({ listAdminRequests: jest.fn() }));
jest.mock('@/api/reports', () => ({ getOvertimeReport: jest.fn(), loadMonthlyAttendanceBatched: jest.fn() }));
jest.mock('@/api/salaryReports', () => ({
  getStaffSalaryBreakdown: jest.fn(),
  getWorkingDays: jest.fn(),
  listMonthlySalary: jest.fn(),
}));
jest.mock('@/api/shifts', () => ({ listShifts: jest.fn() }));
jest.mock('@/api/staff', () => ({ getStaff: jest.fn() }));

const m = <T extends jest.Mock>(fn: unknown): T => fn as T;
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => jest.resetAllMocks());

describe('loadStaffDetailedReport', () => {
  const people = [
    staff({ userId: 'b', name: 'Bea', branch: 'HQ', department: 'Sales' }),
    staff({ userId: 'a', name: 'Al', branch: 'HQ', department: 'Sales' }),
    staff({ userId: 'c', name: 'Cy', branch: 'East', department: 'Ops' }),
  ];

  it('builds sorted rows, uses decimal hours and requests wait-days ONCE per branch+department', async () => {
    m(getAllStaff).mockResolvedValue(people);
    m(listAdminRequests).mockResolvedValue([request({ userId: 'a', type: 'leave', dateStatuses: { '2026-10-03': { status: 'approved' } } })]);
    m(loadMonthlyAttendanceBatched).mockImplementation(async (ids: string[], _o, _m, _y, opts) => {
      opts?.onProgress?.(ids.length, ids.length);
      return {
        byUser: new Map(ids.map((id) => [id, month([day({ status: 'present', totalHours: 7.75 })])])),
        failed: [],
      };
    });
    m(getWorkingDays).mockResolvedValue({ totalDays: 31, offDays: 4, holidays: 1, workingDays: 26 });

    const captions: string[] = [];
    const client = newClient();
    const result = await loadStaffDetailedReport({ orgId: 'org', year: 2026, month: 10, queryClient: client, onProgress: (c) => captions.push(c) });

    expect(result.rows.map((r) => r.name)).toEqual(['Al', 'Bea', 'Cy']);
    expect(result.rows[0]).toMatchObject({ workingDays: 26, present: 1, leave: 1, absent: 24, hoursWorked: '7h 45m' });
    expect(getWorkingDays).toHaveBeenCalledTimes(2); // HQ/Sales + East/Ops (v1 asked once per staff)
    expect(getWorkingDays).toHaveBeenCalledWith('org', 2026, 10, { branchName: 'HQ', deptName: 'Sales' });
    expect(captions[0]).toBe('Fetching staff & requests...');
    expect(captions).toContain('Loading attendance... (3/3)');
    expect(result.warnings).toEqual([]);

    // a second run (e.g. another month visit within the cache window) reuses the cached working days
    await loadStaffDetailedReport({ orgId: 'org', year: 2026, month: 10, queryClient: client });
    expect(getWorkingDays).toHaveBeenCalledTimes(2);
  });

  it('falls back to calendar days minus Sundays and warns; failed requests / attendance become warnings, not silence', async () => {
    m(getAllStaff).mockResolvedValue([people[0]]);
    m(listAdminRequests).mockRejectedValue(new Error('boom'));
    m(loadMonthlyAttendanceBatched).mockResolvedValue({ byUser: new Map(), failed: [{ userId: 'b', message: 'x' }] });
    m(getWorkingDays).mockRejectedValue(new Error('403'));
    const { rows, warnings } = await loadStaffDetailedReport({ orgId: 'org', year: 2026, month: 10, queryClient: newClient() });
    expect(rows[0]).toMatchObject({ workingDays: 27, present: 0, absent: 27, hoursWorked: '0h' });
    expect(warnings).toHaveLength(3);
  });

  it('never sends an empty or "-" branch / department as a working-days filter (v1 guard)', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'x', branch: '-', department: '' }), staff({ userId: 'y', branch: 'HQ', department: '-' })]);
    m(listAdminRequests).mockResolvedValue([]);
    m(loadMonthlyAttendanceBatched).mockResolvedValue({ byUser: new Map(), failed: [] });
    m(getWorkingDays).mockResolvedValue({ totalDays: 31, offDays: 4, holidays: 0, workingDays: 27 });
    await loadStaffDetailedReport({ orgId: 'org', year: 2026, month: 10, queryClient: newClient() });
    expect(getWorkingDays).toHaveBeenCalledWith('org', 2026, 10, { branchName: null, deptName: null });
    expect(getWorkingDays).toHaveBeenCalledWith('org', 2026, 10, { branchName: 'HQ', deptName: null });
  });

  it('rejects when the staff list cannot be loaded (the screen shows an error, never stale rows)', async () => {
    m(getAllStaff).mockRejectedValue(new Error('down'));
    m(listAdminRequests).mockResolvedValue([]);
    await expect(loadStaffDetailedReport({ orgId: 'org', year: 2026, month: 10, queryClient: newClient() })).rejects.toThrow('down');
  });
});

describe('loadLateReport', () => {
  it('derives late rows and flags missing shift times', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a' })]);
    m(loadMonthlyAttendanceBatched).mockResolvedValue({
      byUser: new Map([['a', month([day({ status: 'late', punchIn: '09:20' }), day({ date: '2026-10-06', status: 'present' })])]]),
      failed: [],
    });
    const r = await loadLateReport({ orgId: 'org', year: 2026, month: 10 });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].lateBy).toBe('—');
    expect(r.shiftTimesMissing).toBe(true);
  });
});

describe('loadOvertimeReport', () => {
  it('merges the server figures with the staff list', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a' }), staff({ userId: 'b', name: 'Bo' })]);
    m(getOvertimeReport).mockResolvedValue([{ userId: 'b', otDays: 2, otMinutes: 90, otAmount: 300 }]);
    const r = await loadOvertimeReport({ orgId: 'org', year: 2026, month: 10 });
    expect(r.rows[0]).toMatchObject({ userId: 'b', otHours: '1h 30m' });
    expect(r.warnings).toEqual([]);
  });

  it('shows rows with a visible warning when the overtime endpoint fails (v1 showed silent zeros)', async () => {
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a' })]);
    m(getOvertimeReport).mockRejectedValue(new Error('Not Found'));
    const r = await loadOvertimeReport({ orgId: 'org', year: 2026, month: 10 });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].hasOt).toBe(false);
    expect(r.warnings[0]).toContain('Not Found');
  });
});

describe('loadPaySheet', () => {
  it('uses the server monthly list (paid state from the server)', async () => {
    m(listMonthlySalary).mockResolvedValue([
      { userId: 'a', name: 'A', empId: 'E1', deptName: '', branchName: '', salaryType: '', basicSalary: 1, netSalary: 10, paid: true, paidDate: null },
    ]);
    const sheet = await loadPaySheet('org', 10, 2026);
    expect(sheet).toMatchObject({ paidFromServer: true, amountsAvailable: true });
    expect(sheet.rows[0].serverPaid).toBe(true);
    expect(getAllStaff).not.toHaveBeenCalled();
  });

  it('falls back to staff + breakdown amounts (local paid state) when the list endpoint is missing', async () => {
    m(listMonthlySalary).mockRejectedValue(new Error('Not Found'));
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a' })]);
    m(getStaffSalaryBreakdown).mockResolvedValue([{ userId: 'a', netSalary: 777 } as never]);
    const sheet = await loadPaySheet('org', 10, 2026);
    expect(sheet).toMatchObject({ paidFromServer: false, amountsAvailable: true });
    expect(sheet.rows[0]).toMatchObject({ net: 777, serverPaid: false });
  });

  it('marks amounts unavailable when the breakdown fails too', async () => {
    m(listMonthlySalary).mockRejectedValue(new Error('x'));
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a' })]);
    m(getStaffSalaryBreakdown).mockRejectedValue(new Error('403'));
    expect(await loadPaySheet('org', 10, 2026)).toMatchObject({ paidFromServer: false, amountsAvailable: false });
  });
});

describe('loadSalarySheet', () => {
  it('returns the breakdown rows', async () => {
    m(getStaffSalaryBreakdown).mockResolvedValue([{ userId: 'a' } as never]);
    expect(await loadSalarySheet('org', 10, 2026)).toMatchObject({ fallbackReason: null });
  });

  it('falls back to zero rows from the staff list with the reason (e.g. expired plan)', async () => {
    m(getStaffSalaryBreakdown).mockRejectedValue(new Error('Your plan has expired'));
    m(getAllStaff).mockResolvedValue([staff({ userId: 'a', roleId: 2 })]);
    const r = await loadSalarySheet('org', 10, 2026);
    expect(r.fallbackReason).toBe('Your plan has expired');
    expect(r.rows[0]).toMatchObject({ userId: 'a', roleName: 'Manager', netSalary: 0, salaryType: 'MONTHLY_FIXED' });
  });
});
