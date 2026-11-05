import { api } from '@/lib/api/client';
import {
  assignIncentive,
  assignPayslip,
  assignWages,
  buildPayslipBody,
  collectAssignedUserIds,
  computePayslipTotals,
  createBonusIncentive,
  createCountIncentive,
  createOvertimeIncentive,
  createTurnoverIncentive,
  deleteIncentive,
  deletePayslipTemplate,
  deleteWageTemplate,
  getAssignedPayslipId,
  getBonusAssignedUserIds,
  getPayslipPreview,
  listBonusIncentives,
  listCountIncentives,
  listIncentiveStaff,
  listPayslipStaff,
  listPayslipTemplates,
  listSalaryBranches,
  listTurnoverIncentives,
  listWageStaff,
  listWageTemplates,
  mapBonusIncentive,
  mapPayslipStaffRow,
  mapPayslipTemplate,
  mapWageTemplate,
  nextTemplateName,
  savePayslipTemplate,
  saveWageTemplate,
  unassignIncentive,
  unassignWages,
  updateBonusIncentive,
  updateCountIncentive,
  updateOvertimeIncentive,
  updateTurnoverIncentive,
} from '../payroll';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete', jest.Mock>;

beforeEach(() => {
  Object.values(mocked).forEach((m) => m.mockReset());
});

const template = {
  pay_slip_id: 'P1',
  payslip_name: 'Standard',
  basic_pay: 20000,
  hra: '5000',
  epf: 1800,
  professional_tax: 200,
  health_insurance: 500,
  custom_earnings: [{ name: 'Travel', amount: 1000 }],
  custom_deductions: [{ name: 'Loan', amount: 300 }, { name: '', amount: 5 }],
  total_earnings: 26000,
  total_deductions: 2800,
  net_salary: 23200,
  assigned_count: 3,
  created_at: '2026-10-01T00:00:00',
};

describe('payslip templates', () => {
  it('maps a template with typed numbers and drops blank lines', () => {
    const t = mapPayslipTemplate(template);
    expect(t).toMatchObject({ id: 'P1', name: 'Standard', hra: 5000, professionalTax: 200, netSalary: 23200, assignedCount: 3 });
    expect(t.customDeductions).toEqual([{ name: 'Loan', amount: 300 }]);
  });

  it('computes totals with the server formula when they are missing', () => {
    const t = mapPayslipTemplate({ ...template, total_earnings: undefined, total_deductions: undefined, net_salary: undefined });
    expect(t.totalEarnings).toBe(26000);
    expect(t.totalDeductions).toBe(2800);
    expect(t.netSalary).toBe(23200);
    expect(computePayslipTotals({ basicPay: 100, hra: 10, epf: 5, professionalTax: 1, healthInsurance: 2 })).toEqual({
      totalEarnings: 110,
      totalDeductions: 8,
      netSalary: 102,
    });
  });

  it('builds the v1 request body', () => {
    expect(
      buildPayslipBody({
        orgId: 'o',
        name: ' Std ',
        basicPay: 1,
        hra: 2,
        epf: 3,
        professionalTax: 4,
        healthInsurance: 5,
        customEarnings: [{ name: ' Bonus ', amount: 9 }, { name: '', amount: 1 }],
      }),
    ).toEqual({
      payslip_name: 'Std',
      org_id: 'o',
      basic_pay: 1,
      hra: 2,
      epf: 3,
      professional_tax: 4,
      health_insurance: 5,
      custom_earnings: [{ name: 'Bonus', amount: 9 }],
      custom_deductions: [],
    });
  });

  it('list / save (create vs update) / delete', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [template] });
    expect(await listPayslipTemplates('org')).toHaveLength(1);
    expect(mocked.get).toHaveBeenCalledWith('/api/salary/templates/org');

    mocked.post.mockResolvedValue({ success: true, pay_slip_id: 'P2', message: 'ok', updated_templates: [template] });
    const created = await savePayslipTemplate({ orgId: 'org', name: 'N', basicPay: 1, hra: 0, epf: 0, professionalTax: 0, healthInsurance: 0 });
    expect(mocked.post).toHaveBeenCalledWith('/api/salary/template', expect.objectContaining({ payslip_name: 'N' }));
    expect(created).toMatchObject({ id: 'P2', message: 'ok' });
    expect(created.templates).toHaveLength(1);

    mocked.put.mockResolvedValue({ success: true, message: 'updated' });
    const updated = await savePayslipTemplate({ orgId: 'org', name: 'N', basicPay: 1, hra: 0, epf: 0, professionalTax: 0, healthInsurance: 0 }, 'P1');
    expect(mocked.put).toHaveBeenCalledWith('/api/salary/template/P1', expect.any(Object));
    expect(updated.id).toBe('P1');

    await expect(
      savePayslipTemplate({ orgId: 'org', name: ' ', basicPay: 1, hra: 0, epf: 0, professionalTax: 0, healthInsurance: 0 }),
    ).rejects.toThrow('Enter a template name');

    mocked.delete.mockResolvedValue({ success: true });
    await deletePayslipTemplate('P1');
    expect(mocked.delete).toHaveBeenCalledWith('/api/salary/template/P1');
  });

  it('staff rows are keyed by staff_id (fix: v1 read user_id)', async () => {
    const row = mapPayslipStaffRow({ staff_id: 'S1', staff_name: 'Asha', emp_id: 'E1', branch_name: 'HQ', department_name: 'Ops', is_assigned: 1 });
    expect(row).toEqual({ staffId: 'S1', name: 'Asha', empId: 'E1', branchName: 'HQ', departmentName: 'Ops', isAssigned: true });
    mocked.get.mockResolvedValue({ success: true, data: [{ staff_id: 'S1', is_assigned: 0 }] });
    const rows = await listPayslipStaff('org', { branchId: 3, payslipId: 'P1' });
    expect(mocked.get).toHaveBeenCalledWith('/api/salary/staff/org?branch_id=3&pay_slip_id=P1');
    expect(rows[0].isAssigned).toBe(false);
  });

  it('assignPayslip surfaces the existing assignment', async () => {
    mocked.post.mockResolvedValue({ success: false, message: "Already assigned to 'Std'", payslip_name: 'Std' });
    await expect(assignPayslip('o', 's', 'p')).rejects.toThrow("Already assigned to 'Std'");
    expect(mocked.post).toHaveBeenCalledWith('/api/salary/assign', { org_id: 'o', staff_id: 's', pay_slip_id: 'p' });
  });

  it('getAssignedPayslipId returns null when none is assigned', async () => {
    mocked.get.mockResolvedValueOnce({ success: false, message: 'No payslip assigned' });
    expect(await getAssignedPayslipId('o', 's')).toBeNull();
    mocked.get.mockResolvedValueOnce({ success: true, pay_slip_id: 'P7' });
    expect(await getAssignedPayslipId('o', 's')).toBe('P7');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/salary/employee/o/s');
  });

  it('preview and filter options', async () => {
    mocked.get.mockResolvedValueOnce({
      success: true,
      data: {
        org_name: 'Org',
        payslip_name: 'Std',
        month: 'October',
        year: 2026,
        staff_name: 'Asha',
        emp_id: 'E1',
        department: 'Ops',
        branch: 'HQ',
        account_number: 'N/A',
        ifsc_code: 'N/A',
        earnings: [{ name: 'Basic Pay', amount: 100 }],
        total_earnings: 100,
        deductions: [{ name: 'EPF', amount: 10 }],
        total_deductions: 10,
        net_pay: 90,
      },
    });
    expect(await getPayslipPreview('o', 's', 'p')).toMatchObject({ staffName: 'Asha', netPay: 90, month: 'October', year: 2026 });
    expect(mocked.get).toHaveBeenLastCalledWith('/api/salary/preview/o/s/p');
    mocked.get.mockResolvedValueOnce({ success: true, data: [{ branch_id: 2, branch_name: 'HQ' }] });
    expect(await listSalaryBranches('o')).toEqual([{ id: '2', name: 'HQ' }]);
  });
});

describe('wages', () => {
  it('maps templates', () => {
    expect(mapWageTemplate({ id: 'T1', amount: '450.5', assigned_count: 2 })).toMatchObject({ id: 'T1', amount: 450.5, assignedCount: 2, name: null });
  });

  it('uses the daily / hourly base paths', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [{ id: 'T1', amount: 100 }] });
    await listWageTemplates('daily', 'org');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/daily-wages/templates/org');
    await listWageTemplates('hourly', 'org');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/hourly-charges/templates/org');

    mocked.post.mockResolvedValue({ success: true });
    await saveWageTemplate('daily', { orgId: 'org', amount: 500 });
    expect(mocked.post).toHaveBeenLastCalledWith('/api/daily-wages/template', { org_id: 'org', amount: 500 });
    mocked.put.mockResolvedValue({ success: true });
    await saveWageTemplate('hourly', { orgId: 'org', amount: 60, id: 'T9' });
    expect(mocked.put).toHaveBeenLastCalledWith('/api/hourly-charges/template/T9', { org_id: 'org', amount: 60 });
    mocked.delete.mockResolvedValue({ success: true });
    await deleteWageTemplate('hourly', 'T9');
    expect(mocked.delete).toHaveBeenLastCalledWith('/api/hourly-charges/template/T9');
  });

  it('rejects zero / negative / non-numeric rates', async () => {
    await expect(saveWageTemplate('daily', { orgId: 'o', amount: 0 })).rejects.toThrow('valid amount');
    await expect(saveWageTemplate('daily', { orgId: 'o', amount: -5 })).rejects.toThrow('valid amount');
    await expect(saveWageTemplate('daily', { orgId: 'o', amount: Number.NaN })).rejects.toThrow('valid amount');
    expect(mocked.post).not.toHaveBeenCalled();
  });

  it('assignment endpoints', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [{ user_id: 'u1', name: 'A', emp_id: 'E', branch_name: 'HQ', dept_name: 'Ops' }] });
    expect(await listWageStaff('o', 'T1', 'assigned')).toEqual([{ userId: 'u1', name: 'A', empId: 'E', branchName: 'HQ', deptName: 'Ops' }]);
    expect(mocked.get).toHaveBeenLastCalledWith('/api/wages/assigned/o/T1');
    await listWageStaff('o', 'T1', 'unassigned');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/wages/unassigned/o/T1');
    mocked.post.mockResolvedValue({ success: true });
    await assignWages('o', ['u1', 'u2'], 'T1');
    expect(mocked.post).toHaveBeenLastCalledWith('/api/wages/assign', { org_id: 'o', user_ids: ['u1', 'u2'], temp_id: 'T1' });
    mocked.delete.mockResolvedValue({ success: true });
    await unassignWages('o', 'u1', 'T1');
    expect(mocked.delete).toHaveBeenLastCalledWith('/api/wages/unassign/o/u1/T1');
  });
});

describe('incentives', () => {
  it('nextTemplateName increments the highest numeric name', () => {
    expect(nextTemplateName([])).toBe('1');
    expect(nextTemplateName([{ name: '1' }, { name: '3' }, { name: 'Custom' }, { name: '2' }])).toBe('4');
    expect(nextTemplateName([{ name: 'a' }])).toBe('1');
  });

  it('count list uses list columns and fetches details only when missing', async () => {
    mocked.get.mockImplementation(async (path: string) => {
      if (path === '/api/incentive/count/org') {
        return {
          success: true,
          data: [
            { incentive_id: 'I1', template_name: '1', count_upto_basic_salary: 10, next_count: 5, each_incentive: 50, assigned_count: 2 },
            { incentive_id: 'I2', template_name: '2', assigned_count: 0 },
          ],
        };
      }
      if (path === '/api/incentive/count/details/I2') {
        return { success: true, data: [{ incentive_id: 'I2', count_upto_basic_salary: 20, next_count: 4, each_incentive: 75 }] };
      }
      throw new Error(`unexpected ${path}`);
    });
    const list = await listCountIncentives('org');
    expect(list.map((i) => [i.id, i.countUpto, i.nextCount, i.eachIncentive])).toEqual([
      ['I1', 10, 5, 50],
      ['I2', 20, 4, 75],
    ]);
    expect(mocked.get).toHaveBeenCalledTimes(2);
  });

  it('turnover list maps both column spellings', async () => {
    mocked.get.mockResolvedValue({
      success: true,
      data: [{ incentive_id: 'T1', template_name: '1', turnover_upto_basic_salary: 100000, after_target_incentive_percent: '2.5' }],
    });
    expect((await listTurnoverIncentives('o'))[0]).toMatchObject({ kind: 'turnover', turnoverUpto: 100000, incentivePercent: 2.5 });
  });

  it('bonus rows expose assigned ids only when the server sends them', async () => {
    const withIds = mapBonusIncentive({ incentive_id: 'B1', bonus_percent: 10, month: 'March', year: 2026, user_ids: ['u1', 'u2'] });
    const withoutIds = mapBonusIncentive({ incentive_id: 'B2', bonus_percent: 5 });
    expect(withIds).toMatchObject({ bonusPercent: 10, month: 'March', year: 2026, assignedUserIds: ['u1', 'u2'] });
    expect(withoutIds.assignedUserIds).toBeNull();
    expect([...collectAssignedUserIds([withIds, withoutIds])].sort()).toEqual(['u1', 'u2']);

    mocked.get.mockResolvedValue({ success: true, data: [{ user_id: 'u3', name: 'C' }] });
    const ids = await getBonusAssignedUserIds('org', [withIds, withoutIds]);
    expect([...ids].sort()).toEqual(['u1', 'u2', 'u3']);
    expect(mocked.get).toHaveBeenCalledTimes(1);
    expect(mocked.get).toHaveBeenCalledWith('/api/incentive/assigned/org/B2');
    mocked.get.mockResolvedValue({ success: true, data: [{ incentive_id: 'B1', bonus_percent: 1 }] });
    expect((await listBonusIncentives('org'))[0].kind).toBe('bonus');
  });

  it('create / update bodies follow the v1 field names', async () => {
    mocked.post.mockResolvedValue({ success: true, data: { incentive_id: 'N1' } });
    expect(await createCountIncentive({ orgId: 'o', templateName: '1', countUpto: 10.9, nextCount: 5, eachIncentive: 50 })).toEqual({ id: 'N1' });
    expect(mocked.post).toHaveBeenLastCalledWith('/api/incentive/count', {
      org_id: 'o',
      template_name: '1',
      count_upto: 10,
      next_count: 5,
      each_incentive: 50,
    });
    await createTurnoverIncentive({ orgId: 'o', templateName: '2', turnoverUpto: 1000, incentivePercent: 2 });
    expect(mocked.post).toHaveBeenLastCalledWith('/api/incentive/turnover', { org_id: 'o', template_name: '2', turnover_upto: 1000, incentive_percent: 2 });
    await createOvertimeIncentive({ orgId: 'o', templateName: '1', durationMinutes: 60, amount: 100 });
    expect(mocked.post).toHaveBeenLastCalledWith('/api/incentive/overtime', { org_id: 'o', template_name: '1', duration_minutes: 60, amount: 100 });
    await createBonusIncentive({ orgId: 'o', templateName: '1', bonusPercent: 10, month: 'March', year: 2026 });
    expect(mocked.post).toHaveBeenLastCalledWith('/api/incentive/bonus', { org_id: 'o', template_name: '1', bonus_percent: 10, month: 'March', year: 2026 });

    mocked.put.mockResolvedValue({ success: true });
    await updateCountIncentive('I1', { countUpto: 12, nextCount: 6, eachIncentive: 60 });
    expect(mocked.put).toHaveBeenLastCalledWith('/api/incentive/count/I1', { count_upto: 12, next_count: 6, each_incentive: 60 });
    await updateTurnoverIncentive('I2', { orgId: 'o', templateName: '2', turnoverUpto: 5, incentivePercent: 1 });
    expect(mocked.put).toHaveBeenLastCalledWith('/api/incentive/turnover/I2', { org_id: 'o', template_name: '2', turnover_upto: 5, incentive_percent: 1 });
    await updateOvertimeIncentive('I3', { durationMinutes: 30, amount: 50 });
    expect(mocked.put).toHaveBeenLastCalledWith('/api/incentive/overtime/I3', { duration_minutes: 30, amount: 50 });
    await updateBonusIncentive('I4', 12.5);
    expect(mocked.put).toHaveBeenLastCalledWith('/api/incentive/bonus/I4', { bonus_percent: 12.5 });
  });

  it('delete / assign / unassign / staff lists', async () => {
    mocked.delete.mockResolvedValue({ success: true });
    await deleteIncentive('overtime', 'I3');
    expect(mocked.delete).toHaveBeenLastCalledWith('/api/incentive/overtime/I3');
    mocked.post.mockResolvedValue({ success: true });
    await assignIncentive('o', ['u1'], 'I1');
    expect(mocked.post).toHaveBeenLastCalledWith('/api/incentive/assign', { org_id: 'o', user_ids: ['u1'], incentive_id: 'I1' });
    await unassignIncentive('o', 'u1', 'I1');
    expect(mocked.delete).toHaveBeenLastCalledWith('/api/incentive/unassign/o/u1/I1');
    mocked.get.mockResolvedValue({ success: true, data: [] });
    await listIncentiveStaff('o', 'I1', 'unassigned');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/incentive/unassigned/o/I1');
  });

  it('assign failure message is surfaced', async () => {
    mocked.post.mockResolvedValue({ success: false, message: 'Staff already assigned' });
    await expect(assignIncentive('o', ['u1'], 'I1')).rejects.toThrow('Staff already assigned');
  });
});
