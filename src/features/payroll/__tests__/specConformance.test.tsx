/**
 * Spec-conformance interaction pins (QA Q4b-05): success / failure feedback copy, saving state, stale inline errors and
 * preview money formatting that the screen suites do not assert.
 */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as payroll from '@/api/payroll';
import { ApiError } from '@/lib/api/errors';
import CountBasisScreen from '../screens/CountBasisScreen';
import DailyWagesScreen from '../screens/DailyWagesScreen';
import OvertimeScreen from '../screens/OvertimeScreen';
import PayslipEditScreen from '../screens/PayslipEditScreen';
import PayslipListScreen from '../screens/PayslipListScreen';
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

const payslip = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  basicPay: 30000,
  hra: 10000,
  epf: 1800,
  professionalTax: 200,
  healthInsurance: 0,
  customEarnings: [],
  customDeductions: [],
  totalEarnings: 40000,
  totalDeductions: 2000,
  netSalary: 38000,
  assignedCount: 0,
  createdAt: '2026-01-01 10:00:00',
  raw: {},
  ...over,
});
const staff = (userId: string, name: string) => ({ userId, name, empId: `E-${userId}`, branchName: 'HQ', deptName: 'Ops' });

beforeEach(() => {
  Object.values(payroll).forEach((fn) => (fn as unknown as jest.Mock).mockReset?.());
  jest.clearAllMocks();
  mockParams = {};
  signInTestAdmin();
  api.listPayslipTemplates.mockResolvedValue([payslip('P1', 'Standard')] as never);
  api.listWageTemplates.mockResolvedValue([{ id: 'D1', name: '1', amount: 500, assignedCount: 1, raw: {} }] as never);
  api.listOvertimeIncentives.mockResolvedValue([
    { id: 'O1', name: '1', kind: 'overtime', durationMinutes: 90, amount: 200, assignedCount: 0, createdAt: null, raw: {} },
  ] as never);
  api.listCountIncentives.mockResolvedValue([]);
  api.listWageStaff.mockImplementation(async (_o, _t, side) => (side === 'assigned' ? [staff('u1', 'Asha Verma')] : [staff('u2', 'Rahul Nair')]));
});

const fillValidPayslip = async () => {
  await fireEvent.changeText(screen.getByTestId('payslip-name'), 'Standard');
  await fireEvent.changeText(screen.getByTestId('payslip-basic'), '30000');
  await fireEvent.changeText(screen.getByTestId('payslip-hra'), '10000');
};

describe('add_payslip feedback (acceptance #5, #6, #11-#13)', () => {
  it('add: "Saving..." disables the button, success toast "Payslip Added!", list reopens after ~1.5 s', async () => {
    let finish: (value: { id: string; message: string; templates: never[] }) => void = () => undefined;
    api.savePayslipTemplate.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await renderPayrollScreen(<PayslipEditScreen />);
    await fillValidPayslip();

    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(await screen.findByText('Saving...')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(api.savePayslipTemplate).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();

    finish({ id: 'N1', message: '', templates: [] });
    expect(await screen.findByText('Payslip Added!')).toBeTruthy();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled(), { timeout: 4000 });
  });

  it('edit: success toast "Payslip Updated!"', async () => {
    mockParams = { templateId: 'P1' };
    api.savePayslipTemplate.mockResolvedValue({ id: 'P1', message: '', templates: [] });
    await renderPayrollScreen(<PayslipEditScreen />);
    await waitFor(() => expect(screen.getByTestId('payslip-name').props.value).toBe('Standard'));
    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(await screen.findByText('Payslip Updated!')).toBeTruthy();
  });

  it('server rejection (403 plan expired) shows the server message, keeps the form editable and Save usable', async () => {
    const detail = 'Your plan has expired. Please renew your plan to continue using this feature.';
    api.savePayslipTemplate.mockRejectedValue(new ApiError({ status: 403, message: detail, detail }));
    await renderPayrollScreen(<PayslipEditScreen />);
    await fillValidPayslip();
    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(await screen.findByText(detail)).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('payslip-hra'), '11000');
    expect(screen.getByTestId('payslip-hra').props.value).toBe('11000');
    await fireEvent.press(screen.getByTestId('payslip-save'));
    await waitFor(() => expect(api.savePayslipTemplate).toHaveBeenCalledTimes(2));
  });

  it('body-less 5xx failure falls back to the v1 copy "Failed to save template"', async () => {
    api.savePayslipTemplate.mockRejectedValue(new ApiError({ status: 422 }));
    await renderPayrollScreen(<PayslipEditScreen />);
    await fillValidPayslip();
    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(await screen.findByText('Failed to save template')).toBeTruthy();
  });

  it('an inline custom-row amount error clears as soon as that amount is edited', async () => {
    await renderPayrollScreen(<PayslipEditScreen />);
    await fillValidPayslip();
    await fireEvent.press(screen.getByTestId('earning-add'));
    await fireEvent.changeText(screen.getByTestId('earning-name-0'), 'Travel');
    await fireEvent.changeText(screen.getByTestId('earning-amount-0'), 'x1');
    await fireEvent.press(screen.getByTestId('payslip-save'));
    expect(await screen.findByText('Enter a valid amount')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('earning-amount-0'), '5');
    expect(screen.queryByText('Enter a valid amount')).toBeNull();
  });
});

describe('monthly_fixed delete feedback (acceptance #7, #8)', () => {
  it('success toast "Deleted Successfully!"; failure toast "Failed to delete template"', async () => {
    api.deletePayslipTemplate.mockRejectedValueOnce(new ApiError({ status: 500 })).mockResolvedValueOnce(undefined);
    await renderPayrollScreen(<PayslipListScreen />);
    await screen.findByText('Standard');
    await fireEvent.press(screen.getByTestId('payslip-P1-menu'));
    await fireEvent.press(screen.getByTestId('payslip-P1-delete'));
    await fireEvent.press(screen.getByTestId('payslip-P1-confirm-delete'));
    expect(await screen.findByText('Failed to delete template')).toBeTruthy();
    // the inline confirmation stays open so the admin can retry
    await fireEvent.press(screen.getByTestId('payslip-P1-confirm-delete'));
    expect(await screen.findByText('Deleted Successfully!')).toBeTruthy();
  });

  it('preview shows two-decimal money and a non-negative words line for a negative net pay', async () => {
    api.listPayslipStaff.mockResolvedValue([{ staffId: 's1', name: 'Asha', empId: 'E1', branchName: 'HQ', departmentName: 'Ops', isAssigned: false }]);
    api.listSalaryBranches.mockResolvedValue([]);
    api.listSalaryDepartments.mockResolvedValue([]);
    api.getPayslipPreview.mockResolvedValue({
      orgName: 'Acme Traders',
      payslipName: 'Standard',
      month: 'October',
      year: 2026,
      staffName: 'Asha',
      empId: 'E1',
      department: 'Ops',
      branch: 'HQ',
      accountNumber: '123',
      ifscCode: 'ABCD0001',
      earnings: [{ name: 'Basic Pay', amount: 1000.5 }],
      totalEarnings: 1000.5,
      deductions: [{ name: 'EPF', amount: 1250.25 }],
      totalDeductions: 1250.25,
      netPay: -249.75,
    });
    await renderPayrollScreen(<PayslipListScreen />);
    await screen.findByText('Standard');
    await fireEvent.press(screen.getByTestId('payslip-P1-menu'));
    await fireEvent.press(screen.getByTestId('payslip-P1-assign'));
    await fireEvent.press(await screen.findByTestId('preview-s1'));
    expect(await screen.findByText('Standard - October 2026')).toBeTruthy();
    expect(screen.getAllByText('₹1,000.50').length).toBe(2);
    expect(screen.getAllByText('₹1,250.25').length).toBe(2);
    expect(screen.getByTestId('preview-net-pay').props.children).toBe('-₹249.75');
    expect(screen.getByText('Minus Two Hundred Forty Nine Rupees Only')).toBeTruthy();
    expect(screen.queryByText(/undefined|NaN/)).toBeNull();
  });
});

describe('template screens feedback (daily_wages §8, overtime §8)', () => {
  it('daily wages: "Saving..." on SAVE, popup copy "Template Saved!", server rejection keeps the dialog open', async () => {
    api.saveWageTemplate.mockRejectedValueOnce(new ApiError({ status: 500 })).mockResolvedValueOnce(undefined);
    await renderPayrollScreen(<DailyWagesScreen />);
    await screen.findByText('Day Pay 1');
    await fireEvent.press(screen.getByTestId('template-add'));
    await fireEvent.changeText(screen.getByTestId('field-amount'), '650');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('Failed to save template')).toBeTruthy();
    expect(screen.getByTestId('field-amount').props.value).toBe('650');

    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('Template Saved!')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('field-amount')).toBeNull());
  });

  it('overtime: v1 failure toasts "Failed to save" / "Failed to delete"', async () => {
    api.createOvertimeIncentive.mockRejectedValue(new ApiError({ status: 500 }));
    api.deleteIncentive.mockRejectedValue(new ApiError({ status: 500 }));
    await renderPayrollScreen(<OvertimeScreen />);
    await screen.findByText('Over Time 1');

    await fireEvent.press(screen.getByText('Add OT'));
    await fireEvent.changeText(screen.getByTestId('field-hours'), '2');
    await fireEvent.changeText(screen.getByTestId('field-amount'), '300');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('Failed to save')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('template-form-cancel'));

    await fireEvent.press(screen.getByTestId('template-O1-menu'));
    await fireEvent.press(screen.getByTestId('template-O1-delete'));
    await fireEvent.press(screen.getByTestId('template-O1-confirm-delete'));
    expect(await screen.findByText('Failed to delete')).toBeTruthy();
  });

  it('assign / unassign failures: server detail, else the v1 copy', async () => {
    api.assignWages.mockRejectedValueOnce(new ApiError({ status: 400, message: 'Staff limit reached', detail: 'Staff limit reached' }));
    api.unassignWages.mockRejectedValueOnce(new ApiError({ status: 500 }));
    await renderPayrollScreen(<DailyWagesScreen />);
    await screen.findByText('Day Pay 1');
    await fireEvent.press(screen.getByTestId('template-D1-staff'));
    await fireEvent.press(await screen.findByTestId('available-u2'));
    await fireEvent.press(screen.getByText('Assign 1 Staff'));
    expect(await screen.findByText('Staff limit reached')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('remove-u1'));
    expect(await screen.findByText('Failed to unassign')).toBeTruthy();
  });

  it('count basis flags a decimal in a whole-number field live and never sends it', async () => {
    await renderPayrollScreen(<CountBasisScreen />);
    await screen.findByText('Nothing here yet');
    await fireEvent.press(screen.getByTestId('template-add'));
    await fireEvent.changeText(screen.getByTestId('field-count-upto'), '12.5');
    expect(screen.getByText('Must be a valid number')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('field-count-upto'), '12');
    expect(screen.queryByText('Must be a valid number')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('field-next-count'), '3');
    await fireEvent.changeText(screen.getByTestId('field-incentive'), '0');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('Must be a valid number')).toBeTruthy();
    expect(api.createCountIncentive).not.toHaveBeenCalled();
  });
});
