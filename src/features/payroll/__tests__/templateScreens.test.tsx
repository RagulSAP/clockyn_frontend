import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as payroll from '@/api/payroll';
import { ApiError } from '@/lib/api/errors';
import BonusScreen from '../screens/BonusScreen';
import CountBasisScreen from '../screens/CountBasisScreen';
import DailyWagesScreen from '../screens/DailyWagesScreen';
import HourlyChargesScreen from '../screens/HourlyChargesScreen';
import OvertimeScreen from '../screens/OvertimeScreen';
import TurnoverScreen from '../screens/TurnoverScreen';
import { renderPayrollScreen, signInTestAdmin } from '../testing/harness';

jest.mock('@/api/payroll');
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() };
  return { useRouter: () => router, router, useLocalSearchParams: () => ({}) };
});

const api = payroll as jest.Mocked<typeof payroll>;

const wageRows = [
  { id: 'D1', name: '1', amount: 500, assignedCount: 0, raw: {} },
  { id: 'D2', name: '2', amount: 750.5, assignedCount: 2, raw: {} },
];
const incentive = (kind: string, extra: Record<string, unknown>, id: string, name: string, assignedCount = 0) => ({
  id,
  name,
  kind,
  assignedCount,
  createdAt: null,
  raw: {},
  ...extra,
});
const staff = (userId: string, name: string) => ({ userId, name, empId: `E-${userId}`, branchName: 'HQ', deptName: 'Ops' });

beforeEach(() => {
  Object.values(payroll).forEach((fn) => (fn as unknown as jest.Mock).mockReset?.());
  jest.clearAllMocks();
  signInTestAdmin();
  api.listWageTemplates.mockResolvedValue(wageRows as never);
  api.listOvertimeIncentives.mockResolvedValue([
    incentive('overtime', { durationMinutes: 90, amount: 200 }, 'O1', '1'),
    incentive('overtime', { durationMinutes: 45, amount: 120 }, 'O2', '2', 1),
  ] as never);
  api.listBonusIncentives.mockResolvedValue([
    incentive('bonus', { bonusPercent: 10, month: 'March', year: 2026, assignedUserIds: ['u9'] }, 'B1', '1', 1),
  ] as never);
  api.listCountIncentives.mockResolvedValue([
    incentive('count', { countUpto: 10, nextCount: 5, eachIncentive: 100 }, 'C1', '1'),
  ] as never);
  api.listTurnoverIncentives.mockResolvedValue([
    incentive('turnover', { turnoverUpto: 50000, incentivePercent: 5 }, 'T1', '1'),
  ] as never);
  api.getBonusAssignedUserIds.mockResolvedValue(new Set(['u9']));
  api.listWageStaff.mockImplementation(async (_org, _tpl, side) =>
    side === 'assigned' ? [staff('u1', 'Asha Verma')] : [staff('u2', 'Rahul Nair'), staff('u3', 'Meera Iyer')],
  );
  api.listIncentiveStaff.mockImplementation(async (_org, _tpl, side) =>
    side === 'assigned' ? [] : [staff('u9', 'Kabir Shah'), staff('u2', 'Rahul Nair')],
  );
});

describe('shared template screens render their own copy', () => {
  it.each([
    ['Daily Wages', DailyWagesScreen, 'All Daily Wages', 'Day Pay 2'],
    ['Hourly Charges', HourlyChargesScreen, 'All Hourly Charges', 'Hour-Pay-2'],
    ['Overtime', OvertimeScreen, 'All Overtime', 'Over Time 2'],
    ['Bonus', BonusScreen, 'All Bonuses', 'Bonus 1'],
    ['Count Basis', CountBasisScreen, 'All Count Basis', 'Count 1'],
    ['Turnover Basis', TurnoverScreen, 'All Turnovers', 'Turnover 1'],
  ] as const)('%s', async (title, Screen, label, cardTitle) => {
    await renderPayrollScreen(<Screen />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    expect(await screen.findByText(cardTitle)).toBeTruthy();
  });

  it('shows card details of each type', async () => {
    await renderPayrollScreen(<OvertimeScreen />);
    expect(await screen.findByText('⏱ 1h 30m')).toBeTruthy();
    expect(screen.getByText('⏱ 45m')).toBeTruthy();
  });

  it('count basis cards show the three values', async () => {
    await renderPayrollScreen(<CountBasisScreen />);
    expect(await screen.findByText('Count Upto Basic Salary:')).toBeTruthy();
    expect(screen.getByText('Next Count:')).toBeTruthy();
    expect(screen.getByText('₹100')).toBeTruthy();
  });

  it('shows an error state with retry when the list fails to load', async () => {
    api.listWageTemplates.mockRejectedValueOnce(new ApiError({ status: 500, message: 'boom' }));
    await renderPayrollScreen(<DailyWagesScreen />);
    expect(await screen.findByText('Failed to load templates')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Day Pay 2')).toBeTruthy();
  });

  it('shows an empty state with an add action', async () => {
    api.listWageTemplates.mockResolvedValue([]);
    await renderPayrollScreen(<DailyWagesScreen />);
    expect(await screen.findByText('Nothing here yet')).toBeTruthy();
  });
});

describe('card menu and delete rule', () => {
  it('offers Delete only on the highest-numbered template, with an inline confirmation', async () => {
    api.deleteWageTemplate.mockResolvedValue(undefined);
    await renderPayrollScreen(<DailyWagesScreen />);
    await screen.findByText('Day Pay 2');

    await fireEvent.press(screen.getByTestId('template-D1-menu'));
    expect(screen.getByTestId('template-D1-edit')).toBeTruthy();
    expect(screen.queryByTestId('template-D1-delete')).toBeNull();

    await fireEvent.press(screen.getByTestId('template-D2-menu'));
    await fireEvent.press(screen.getByTestId('template-D2-delete'));
    expect(screen.getByText('Delete this template?')).toBeTruthy();

    await fireEvent.press(screen.getByText('Cancel'));
    expect(api.deleteWageTemplate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('template-D2-delete'));
    await fireEvent.press(screen.getByTestId('template-D2-confirm-delete'));
    await waitFor(() => expect(api.deleteWageTemplate).toHaveBeenCalledWith('daily', 'D2'));
  });

  it('uses the type specific delete prompt (overtime)', async () => {
    await renderPayrollScreen(<OvertimeScreen />);
    await screen.findByText('Over Time 2');
    await fireEvent.press(screen.getByTestId('template-O2-menu'));
    await fireEvent.press(screen.getByTestId('template-O2-delete'));
    expect(screen.getByText('Delete this overtime?')).toBeTruthy();
  });
});

describe('add / edit dialog', () => {
  it('daily wages: validates then creates with {org, amount}', async () => {
    api.saveWageTemplate.mockResolvedValue(undefined);
    await renderPayrollScreen(<DailyWagesScreen />);
    await screen.findByText('Day Pay 2');

    await fireEvent.press(screen.getByTestId('template-add'));
    expect(screen.getByText('Day Pay 3')).toBeTruthy();
    expect(screen.getByText(/If one day present/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('Amount is required')).toBeTruthy();
    expect(api.saveWageTemplate).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('field-amount'), '-5');
    expect(screen.getByText('Amount must be a valid number')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('field-amount'), '650');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    await waitFor(() => expect(api.saveWageTemplate).toHaveBeenCalledWith('daily', { orgId: 'ORG1', amount: 650, id: undefined }));
    // list is refetched after the save
    await waitFor(() => expect(api.listWageTemplates.mock.calls.length).toBeGreaterThan(1));
  });

  it('edit prefills the amount and updates by id', async () => {
    api.saveWageTemplate.mockResolvedValue(undefined);
    await renderPayrollScreen(<DailyWagesScreen />);
    await screen.findByText('Day Pay 2');
    await fireEvent.press(screen.getByTestId('template-D1-menu'));
    await fireEvent.press(screen.getByTestId('template-D1-edit'));
    expect(screen.getByTestId('field-amount').props.value).toBe('500');
    await fireEvent.changeText(screen.getByTestId('field-amount'), '600');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    await waitFor(() => expect(api.saveWageTemplate).toHaveBeenCalledWith('daily', { orgId: 'ORG1', amount: 600, id: 'D1' }));
  });

  it('hourly charges: refuses a duplicate amount', async () => {
    await renderPayrollScreen(<HourlyChargesScreen />);
    await screen.findByText('Hour-Pay-2');
    await fireEvent.press(screen.getByTestId('template-add'));
    await fireEvent.changeText(screen.getByTestId('field-amount'), '750.5');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('This amount already exists in Hour-Pay-2')).toBeTruthy();
    expect(api.saveWageTemplate).not.toHaveBeenCalled();
  });

  it('overtime: duration rules and payload', async () => {
    api.createOvertimeIncentive.mockResolvedValue({ id: 'O3' });
    await renderPayrollScreen(<OvertimeScreen />);
    await screen.findByText('Over Time 2');
    await fireEvent.press(screen.getByText('Add OT'));
    expect(screen.getByText('Over Time 3')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('Enter the Duration')).toBeTruthy();
    expect(screen.getByText('Amount is required')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('field-hours'), '1');
    await fireEvent.changeText(screen.getByTestId('field-minutes'), '30');
    await fireEvent.changeText(screen.getByTestId('field-amount'), '300');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('This duration already exists in Over Time 1')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('field-hours'), '2');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    await waitFor(() =>
      expect(api.createOvertimeIncentive).toHaveBeenCalledWith({ orgId: 'ORG1', templateName: '3', durationMinutes: 150, amount: 300 }),
    );
  });

  it('bonus: percent range and month / year are required', async () => {
    await renderPayrollScreen(<BonusScreen />);
    await screen.findByText('Bonus 1');
    await fireEvent.press(screen.getByText('Add Bonus'));
    await fireEvent.changeText(screen.getByTestId('field-percent'), '150');
    expect(screen.getByText('Enter a number between 0-100')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('Month is required')).toBeTruthy();
    expect(screen.getByText('Year is required')).toBeTruthy();
    expect(api.createBonusIncentive).not.toHaveBeenCalled();
  });

  it('count basis: duplicates name the other template', async () => {
    await renderPayrollScreen(<CountBasisScreen />);
    await screen.findByText('Count 1');
    await fireEvent.press(screen.getByText('Add Count'));
    await fireEvent.changeText(screen.getByTestId('field-count-upto'), '10');
    await fireEvent.changeText(screen.getByTestId('field-next-count'), '7');
    await fireEvent.changeText(screen.getByTestId('field-incentive'), '55');
    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('This value already exists in Count 1')).toBeTruthy();
    expect(api.createCountIncentive).not.toHaveBeenCalled();
  });

  it('turnover: requires both values', async () => {
    await renderPayrollScreen(<TurnoverScreen />);
    await screen.findByText('Turnover 1');
    await fireEvent.press(screen.getByText('Add Turnover'));
    await fireEvent.press(screen.getByTestId('template-form-save'));
    expect(await screen.findByText('Turnover upto is required')).toBeTruthy();
    expect(screen.getByText('Incentive is required')).toBeTruthy();
  });
});

describe('assign staff dialog', () => {
  it('lists assigned and available staff and assigns the selection in bulk', async () => {
    api.assignWages.mockResolvedValue(undefined);
    await renderPayrollScreen(<DailyWagesScreen />);
    await screen.findByText('Day Pay 2');
    await fireEvent.press(screen.getByTestId('template-D2-staff'));

    expect(await screen.findByText('ASSIGNED (1)')).toBeTruthy();
    expect(screen.getByText('AVAILABLE STAFF (2)')).toBeTruthy();
    expect(screen.getByText('Assign Staff')).toBeTruthy();
    expect(screen.getByText(/moves them off their other Day Pay template/)).toBeTruthy();
    expect(api.listWageStaff).toHaveBeenCalledWith('ORG1', 'D2', 'assigned');

    await fireEvent.press(screen.getByTestId('available-u2'));
    await fireEvent.press(screen.getByTestId('available-u3'));
    await fireEvent.press(screen.getByText('Assign 2 Staff'));
    await waitFor(() => expect(api.assignWages).toHaveBeenCalledWith('ORG1', ['u2', 'u3'], 'D2'));
  });

  it('removes an assigned staff member', async () => {
    api.unassignWages.mockResolvedValue(undefined);
    await renderPayrollScreen(<DailyWagesScreen />);
    await screen.findByText('Day Pay 2');
    await fireEvent.press(screen.getByTestId('template-D2-staff'));
    await screen.findByText('ASSIGNED (1)');
    await fireEvent.press(screen.getByTestId('remove-u1'));
    await waitFor(() => expect(api.unassignWages).toHaveBeenCalledWith('ORG1', 'u1', 'D2'));
  });

  it('shows a retry state when the staff lists fail', async () => {
    api.listWageStaff.mockRejectedValue(new ApiError({ status: 500, message: 'down' }));
    await renderPayrollScreen(<DailyWagesScreen />);
    await screen.findByText('Day Pay 2');
    await fireEvent.press(screen.getByTestId('template-D2-staff'));
    expect(await screen.findByText('Failed to load staff')).toBeTruthy();
  });

  it('bonus: warns before selecting staff who already have a bonus', async () => {
    api.assignIncentive.mockResolvedValue(undefined);
    await renderPayrollScreen(<BonusScreen />);
    await screen.findByText('Bonus 1');
    await fireEvent.press(screen.getByTestId('template-B1-staff'));
    expect(await screen.findByText('Staff Details')).toBeTruthy();
    await screen.findByText('AVAILABLE STAFF (2)');
    await waitFor(() => expect(api.getBonusAssignedUserIds).toHaveBeenCalled());

    // Kabir (u9) already has a bonus: tapping opens the warning, Assign then selects him.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await fireEvent.press(screen.getByTestId('available-u9'));
    expect(await screen.findByText('Already Assigned')).toBeTruthy();
    expect(screen.getByText('Kabir Shah is already assigned to a bonus. Do you still want to assign them?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('warn-assigned-confirm'));
    await fireEvent.press(await screen.findByText('Assign 1 Staff'));
    await waitFor(() => expect(api.assignIncentive).toHaveBeenCalledWith('ORG1', ['u9'], 'B1'));
  });
});
