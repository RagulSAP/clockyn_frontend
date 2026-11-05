import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as payroll from '@/api/payroll';
import { routes } from '@/lib/navigation';
import { ApiError } from '@/lib/api/errors';
import IncentiveChooserScreen from '../screens/IncentiveChooserScreen';
import PayslipEditScreen from '../screens/PayslipEditScreen';
import PayslipListScreen from '../screens/PayslipListScreen';
import { alreadyAssignedPayslip } from '../components/PayslipAssignModal';
import { renderPayrollScreen, signInTestAdmin } from '../testing/harness';

jest.mock('@/api/payroll');

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: mockRouter,
  useLocalSearchParams: () => mockParams,
}));

const api = payroll as jest.Mocked<typeof payroll>;

const template = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  basicPay: 30000,
  hra: 10000,
  epf: 1800,
  professionalTax: 200,
  healthInsurance: 500,
  customEarnings: [{ name: 'Travel', amount: 1000.5 }],
  customDeductions: [{ name: 'Loan', amount: 300 }],
  totalEarnings: 41000.5,
  totalDeductions: 2800,
  netSalary: 38200.5,
  assignedCount: 0,
  createdAt: '2026-01-01 10:00:00',
  raw: {},
  ...over,
});
const row = (staffId: string, name: string, isAssigned = false) => ({
  staffId,
  name,
  empId: `E-${staffId}`,
  branchName: 'HQ',
  departmentName: 'Ops',
  isAssigned,
});

beforeEach(() => {
  Object.values(payroll).forEach((fn) => (fn as unknown as jest.Mock).mockReset?.());
  jest.clearAllMocks();
  mockParams = {};
  signInTestAdmin();
  api.listPayslipTemplates.mockResolvedValue([
    template('P2', 'Senior', { createdAt: '2026-02-01 10:00:00', assignedCount: 3 }),
    template('P1', 'Standard'),
  ] as never);
  api.listSalaryBranches.mockResolvedValue([{ id: 'b1', name: 'HQ' }]);
  api.listSalaryDepartments.mockResolvedValue([{ id: 'd1', name: 'Ops' }]);
  api.listPayslipStaff.mockResolvedValue([row('s1', 'Asha Verma', true), row('s2', 'Rahul Nair')]);
});

describe('PayslipListScreen', () => {
  it('lists templates oldest first with net salary and assigned counts', async () => {
    await renderPayrollScreen(<PayslipListScreen />);
    expect(screen.getByText('Salary Payslips')).toBeTruthy();
    expect(screen.getByText('All Payslips')).toBeTruthy();
    expect(await screen.findByText('Standard')).toBeTruthy();
    expect(screen.getByText('Senior')).toBeTruthy();
    expect(screen.getAllByText('₹38,200.5').length).toBe(2);
    expect(screen.getByText('View 3 Assigned Staff')).toBeTruthy();
    expect(screen.getByText('No staff assigned yet')).toBeTruthy();
  });

  it('Add opens the empty form, Edit passes the template id', async () => {
    await renderPayrollScreen(<PayslipListScreen />);
    await screen.findByText('Standard');
    await fireEvent.press(screen.getByTestId('payslip-add'));
    expect(mockRouter.push).toHaveBeenCalledWith(routes.admin.payroll.payslipEdit);
    await fireEvent.press(screen.getByTestId('payslip-P1-menu'));
    await fireEvent.press(screen.getByTestId('payslip-P1-edit'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: routes.admin.payroll.payslipEdit, params: { templateId: 'P1' } });
  });

  it('offers Delete on the newest template only and deletes after the inline confirmation', async () => {
    api.deletePayslipTemplate.mockResolvedValue(undefined);
    await renderPayrollScreen(<PayslipListScreen />);
    await screen.findByText('Standard');
    await fireEvent.press(screen.getByTestId('payslip-P1-menu'));
    expect(screen.queryByTestId('payslip-P1-delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('payslip-P2-menu'));
    await fireEvent.press(screen.getByTestId('payslip-P2-delete'));
    expect(screen.getByText('Delete this template?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('payslip-P2-confirm-delete'));
    await waitFor(() => expect(api.deletePayslipTemplate).toHaveBeenCalledWith('P2'));
  });

  it('an empty server list replaces the cached list (no stale cards)', async () => {
    api.listPayslipTemplates.mockResolvedValue([]);
    await renderPayrollScreen(<PayslipListScreen />);
    expect(await screen.findByText('No payslips yet')).toBeTruthy();
  });

  it('assign dialog: server filters, assigned flag from staff_id, assign + preview', async () => {
    api.assignPayslip.mockResolvedValue(undefined);
    api.getPayslipPreview.mockResolvedValue({
      orgName: 'Acme Traders',
      payslipName: 'Standard',
      month: 'October',
      year: 2026,
      staffName: 'Rahul Nair',
      empId: 'E-s2',
      department: 'Ops',
      branch: 'HQ',
      accountNumber: '',
      ifscCode: '',
      earnings: [{ name: 'Basic Pay', amount: 30000 }],
      totalEarnings: 30000,
      deductions: [{ name: 'EPF', amount: 1800 }],
      totalDeductions: 1800,
      netPay: 125000.75,
    });
    await renderPayrollScreen(<PayslipListScreen />);
    await screen.findByText('Standard');
    await fireEvent.press(screen.getByTestId('payslip-P1-menu'));
    await fireEvent.press(screen.getByTestId('payslip-P1-assign'));

    expect(await screen.findByText('Acme Traders')).toBeTruthy();
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
    expect(api.listPayslipStaff).toHaveBeenCalledWith('ORG1', { branchId: '', departmentId: '', payslipId: 'P1' });
    expect(screen.getByText('All Branches')).toBeTruthy();
    expect(screen.getByText('All Departments')).toBeTruthy();
    expect(screen.getByText('Assigned')).toBeTruthy();
    expect(screen.queryByTestId('assign-s1')).toBeNull();

    await fireEvent.press(screen.getByTestId('assign-s2'));
    await waitFor(() => expect(api.assignPayslip).toHaveBeenCalledWith('ORG1', 's2', 'P1'));
    await waitFor(() => expect(screen.queryByTestId('assign-s2')).toBeNull());

    await fireEvent.press(screen.getByTestId('preview-s2'));
    expect(await screen.findByText('Standard - October 2026')).toBeTruthy();
    expect(screen.getByText('One Lakh Twenty Five Thousand Rupees Only')).toBeTruthy();
    expect(screen.getByText('Total Earnings')).toBeTruthy();
    expect(screen.getAllByText('N/A').length).toBe(2);
    expect(api.getPayslipPreview).toHaveBeenCalledWith('ORG1', 's2', 'P1');
  });

  it('assign dialog: tells the admin which payslip the staff member is already on', async () => {
    api.assignPayslip.mockRejectedValue(
      new ApiError({ status: 200, message: "Already assigned to 'Senior'", raw: { success: false, payslip_name: 'Senior' } }),
    );
    await renderPayrollScreen(<PayslipListScreen />);
    await screen.findByText('Standard');
    await fireEvent.press(screen.getByTestId('payslip-P1-menu'));
    await fireEvent.press(screen.getByTestId('payslip-P1-assign'));
    await fireEvent.press(await screen.findByTestId('assign-s2'));
    expect(await screen.findByText('Already Assigned')).toBeTruthy();
    expect(screen.getByText('This staff member is already assigned to "Senior"')).toBeTruthy();
    expect(screen.getByTestId('assign-s2')).toBeTruthy();
  });

  it('extracts the existing payslip name from the failure body', () => {
    expect(alreadyAssignedPayslip(new ApiError({ status: 200, raw: { payslip_name: ' Gold ' } }))).toBe('Gold');
    expect(alreadyAssignedPayslip(new ApiError({ status: 200, raw: { message: 'x' } }))).toBeNull();
    expect(alreadyAssignedPayslip(new Error('x'))).toBeNull();
  });
});

describe('PayslipEditScreen', () => {
  it('add mode: validates in the v1 order, shows decimal-safe live totals and posts numbers', async () => {
    api.savePayslipTemplate.mockResolvedValue({ id: 'N1', message: '', templates: [] });
    await renderPayrollScreen(<PayslipEditScreen />);
    expect(screen.getByText('Add Payslip')).toBeTruthy();
    expect(screen.getByText('Save Payslip')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(api.savePayslipTemplate).not.toHaveBeenCalled();
    expect(await screen.findByText('Please fill basic salary and HRA')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('payslip-basic'), '30000.75');
    await fireEvent.changeText(screen.getByTestId('payslip-hra'), '10000');
    await fireEvent.changeText(screen.getByTestId('payslip-epf'), '1800');
    await fireEvent.press(screen.getByTestId('earning-add'));
    await fireEvent.changeText(screen.getByTestId('earning-name-0'), 'Travel');
    await fireEvent.changeText(screen.getByTestId('earning-amount-0'), '2000.25');

    expect(screen.getByTestId('total-earnings').props.children).toBe('₹42,001');
    expect(screen.getByTestId('total-deductions').props.children).toBe('₹1,800');
    expect(screen.getByTestId('net-salary').props.children).toBe('₹40,201');

    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(await screen.findByText('Please enter template name')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('payslip-name'), 'Standard');
    await fireEvent.press(screen.getByTestId('payslip-save'));
    await waitFor(() =>
      expect(api.savePayslipTemplate).toHaveBeenCalledWith(
        {
          orgId: 'ORG1',
          name: 'Standard',
          basicPay: 30000.75,
          hra: 10000,
          epf: 1800,
          professionalTax: 0,
          healthInsurance: 0,
          customEarnings: [{ name: 'Travel', amount: 2000.25 }],
          customDeductions: [],
        },
        undefined,
      ),
    );
  });

  it('never shows NaN while typing text and flags invalid amounts on save', async () => {
    await renderPayrollScreen(<PayslipEditScreen />);
    await fireEvent.changeText(screen.getByTestId('payslip-name'), 'X');
    await fireEvent.changeText(screen.getByTestId('payslip-basic'), 'abc');
    await fireEvent.changeText(screen.getByTestId('payslip-hra'), '1');
    expect(screen.getByTestId('total-earnings').props.children).toBe('₹1');
    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(await screen.findByText('Please correct the highlighted amounts')).toBeTruthy();
    expect(screen.getByText('Enter a valid amount')).toBeTruthy();
    expect(api.savePayslipTemplate).not.toHaveBeenCalled();
  });

  it('removes only the chosen custom row', async () => {
    await renderPayrollScreen(<PayslipEditScreen />);
    await fireEvent.press(screen.getByTestId('earning-add'));
    await fireEvent.press(screen.getByTestId('earning-add'));
    expect(screen.getByTestId('earning-name-1')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('earning-name-1'), 'Keep');
    await fireEvent.press(screen.getByTestId('earning-remove-0'));
    expect(screen.queryByTestId('earning-name-1')).toBeNull();
    expect(screen.getByTestId('earning-name-0').props.value).toBe('Keep');
  });

  it('edit mode: prefills from the template and updates by id', async () => {
    mockParams = { templateId: 'P1' };
    api.savePayslipTemplate.mockResolvedValue({ id: 'P1', message: '', templates: [] });
    await renderPayrollScreen(<PayslipEditScreen />);
    expect(await screen.findByText('Edit Payslip')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('payslip-name').props.value).toBe('Standard'));
    expect(screen.getByTestId('payslip-basic').props.value).toBe('30000');
    expect(screen.getByTestId('earning-name-0').props.value).toBe('Travel');
    expect(screen.getByTestId('earning-amount-0').props.value).toBe('1000.5');
    expect(screen.getByTestId('deduction-name-0').props.value).toBe('Loan');
    expect(screen.getByText('Update Payslip')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('payslip-hra'), '12000');
    await fireEvent.press(screen.getByTestId('payslip-save'));
    await waitFor(() => expect(api.savePayslipTemplate).toHaveBeenCalled());
    const [input, id] = api.savePayslipTemplate.mock.calls[0];
    expect(id).toBe('P1');
    expect(input).toMatchObject({ name: 'Standard', hra: 12000, customEarnings: [{ name: 'Travel', amount: 1000.5 }] });
  });

  it('edit mode: unknown template id shows not-found instead of an empty form', async () => {
    mockParams = { templateId: 'GONE' };
    await renderPayrollScreen(<PayslipEditScreen />);
    expect(await screen.findByText('Payslip not found')).toBeTruthy();
  });
});

describe('IncentiveChooserScreen', () => {
  it('offers Count Basis and Turnover Basis only and navigates through routes', async () => {
    await renderPayrollScreen(<IncentiveChooserScreen />);
    expect(screen.getByText('Select Incentive Type')).toBeTruthy();
    await fireEvent.press(screen.getByText('Count Basis'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(routes.admin.payroll.countBasis);
    await fireEvent.press(screen.getByText('Turnover Basis'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(routes.admin.payroll.turnover);
    expect(screen.queryByText('Overtime')).toBeNull();
    expect(screen.queryByText('Bonus')).toBeNull();
  });
});
