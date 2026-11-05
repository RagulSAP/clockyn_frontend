import { api } from '@/lib/api/client';
import { todayIST } from '@/lib/datetime';
import {
  createAdvance,
  deleteAdvance,
  getStaffSalaryBreakdown,
  getWorkingDays,
  listMonthlySalary,
  listOrgAdvances,
  listUserAdvances,
  mapAdvance,
  mapMonthlySalaryEntry,
  mapSalaryBreakdown,
  markSalaryPaid,
  totalAdvances,
  unpaidUserIds,
} from '../salaryReports';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete', jest.Mock>;

beforeEach(() => {
  Object.values(mocked).forEach((m) => m.mockReset());
});

describe('salary breakdown', () => {
  it('maps every amount to a number', () => {
    const row = mapSalaryBreakdown({
      user_id: 'u1',
      name: 'Asha',
      emp_id: 'E1',
      role_name: 'Staff',
      branch_name: 'HQ',
      salary_type: 'MONTHLY_FIXED',
      basic_salary: '20000',
      incentive: 1500,
      incentive_count: 1000,
      incentive_turnover: 500,
      overtime: 200.5,
      bonus: 0,
      fine: 0,
      travel_allowance: 300,
      odometer: 100,
      travel_ticket: 300,
      advance: 2000,
      other_bills: 50,
      daily_wages: 0,
      hourly_calc: 0,
      net_salary: 20550.5,
      profile_photo_url: 'https://x/p.png',
    });
    expect(row).toMatchObject({ basicSalary: 20000, incentiveCount: 1000, overtime: 200.5, advance: 2000, netSalary: 20550.5, photoUrl: 'https://x/p.png' });
    expect(mapSalaryBreakdown({}).netSalary).toBe(0);
  });

  it('requests org_id, month and year and surfaces a plan block', async () => {
    mocked.get.mockResolvedValue([{ user_id: 'u1', net_salary: 1 }]);
    expect(await getStaffSalaryBreakdown('org', 10, 2026)).toHaveLength(1);
    expect(mocked.get).toHaveBeenCalledWith('/api/salary/staff-breakdown', { org_id: 'org', month: 10, year: 2026 });
    mocked.get.mockResolvedValue({ success: false, message: 'Your plan has expired.' });
    await expect(getStaffSalaryBreakdown('org', 10, 2026)).rejects.toThrow('Your plan has expired.');
  });
});

describe('monthly paid list', () => {
  it('maps paid state and picks unpaid ids', async () => {
    mocked.get.mockResolvedValue([
      { user_id: 'u1', name: 'A', paid: true, paid_date: '2026-10-05T10:00:00', net_salary: 100 },
      { user_id: 'u2', name: 'B', paid: false },
    ]);
    const list = await listMonthlySalary('org', 10, 2026);
    expect(mocked.get).toHaveBeenCalledWith('/salary/monthly-list', { org_id: 'org', month: 10, year: 2026 });
    expect(list[0]).toMatchObject({ paid: true, paidDate: '2026-10-05', netSalary: 100 });
    expect(unpaidUserIds(list)).toEqual(['u2']);
    expect(mapMonthlySalaryEntry({ paid: 'true' }).paid).toBe(true);
  });

  it('markSalaryPaid posts the v1 body and validates', async () => {
    mocked.post.mockResolvedValue({ success: true });
    await markSalaryPaid({ orgId: 'o', userIds: ['u1', 'u2'], month: 10, year: 2026 });
    expect(mocked.post).toHaveBeenCalledWith('/salary/mark-paid', { org_id: 'o', user_ids: ['u1', 'u2'], month: 10, year: 2026 });
    await expect(markSalaryPaid({ orgId: 'o', userIds: [], month: 10, year: 2026 })).rejects.toThrow('Select at least one employee');
    mocked.post.mockResolvedValue({ success: false, message: 'Not allowed' });
    await expect(markSalaryPaid({ orgId: 'o', userIds: ['u1'], month: 10, year: 2026 })).rejects.toThrow('Not allowed');
  });
});

describe('advances', () => {
  it('maps and totals', () => {
    const list = [mapAdvance({ id: 1, advance_amt: '1500.50', date: '2026-10-02', user_id: 'u1' }), mapAdvance({ advance_id: 2, advance_amt: 500, date: '2026-10-09T00:00:00' })];
    expect(list[0]).toMatchObject({ id: '1', amount: 1500.5, date: '2026-10-02' });
    expect(list[1].date).toBe('2026-10-09');
    expect(totalAdvances(list)).toBe(2000.5);
  });

  it('list endpoints', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [{ id: 1, advance_amt: 10, date: '2026-10-01' }] });
    expect(await listUserAdvances('u1', 'org')).toHaveLength(1);
    expect(mocked.get).toHaveBeenLastCalledWith('/api/advance/user/u1/org');
    await listOrgAdvances('org');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/advance/org/org');
  });

  it('createAdvance defaults the date to IST today and validates the amount', async () => {
    mocked.post.mockResolvedValue({ success: true, data: { id: 5, advance_amt: 700, date: '2026-10-18', user_id: 'u1' } });
    const adv = await createAdvance({ orgId: 'o', userId: 'u1', createdBy: 'admin', amount: 700 });
    expect(mocked.post).toHaveBeenCalledWith('/api/advance', {
      org_id: 'o',
      user_id: 'u1',
      created_by: 'admin',
      advance_amt: 700,
      date: todayIST(),
    });
    expect(adv).toMatchObject({ id: '5', amount: 700 });
    await createAdvance({ orgId: 'o', userId: 'u1', createdBy: 'admin', amount: 10, date: '2026-09-30' });
    expect(mocked.post).toHaveBeenLastCalledWith('/api/advance', expect.objectContaining({ date: '2026-09-30' }));
    await expect(createAdvance({ orgId: 'o', userId: 'u', createdBy: 'a', amount: 0 })).rejects.toThrow('valid advance amount');
    await expect(createAdvance({ orgId: 'o', userId: 'u', createdBy: 'a', amount: -1 })).rejects.toThrow('valid advance amount');
  });

  it('deleteAdvance', async () => {
    mocked.delete.mockResolvedValue({ success: true });
    await deleteAdvance('5', 'org');
    expect(mocked.delete).toHaveBeenCalledWith('/api/advance/5/org');
  });
});

describe('working days', () => {
  it('passes the optional branch / department filter', async () => {
    mocked.get.mockResolvedValue({ success: true, total_days: 31, off_days: 4, holidays: 1, working_days: 26 });
    expect(await getWorkingDays('org', 2026, 10, { branchName: 'HQ', deptName: null })).toEqual({ totalDays: 31, offDays: 4, holidays: 1, workingDays: 26 });
    expect(mocked.get).toHaveBeenCalledWith('/api/holidays/working-days/org?year=2026&month=10&branch_name=HQ');
  });

  it('refuses a response without working_days instead of reporting 0', async () => {
    mocked.get.mockResolvedValue({ success: true });
    await expect(getWorkingDays('org', 2026, 10)).rejects.toThrow('not available');
  });
});
