/** Payload builders: what each type's `save` sends to the API (v1 bodies; bonus edit now includes month / year). */
import type { BonusIncentive, CountIncentive, OvertimeIncentive, TurnoverIncentive } from '@/types/api/payroll';
import * as payroll from '@/api/payroll';
import { bonusConfig, countBasisConfig, overtimeConfig, turnoverConfig } from '../config/incentiveConfigs';
import { dailyWagesConfig, hourlyConfig } from '../config/wageConfigs';
import type { WageItem } from '../utils/wageForm';

jest.mock('@/api/payroll', () => ({
  assignIncentive: jest.fn(),
  assignWages: jest.fn(),
  createBonusIncentive: jest.fn(),
  createCountIncentive: jest.fn(),
  createOvertimeIncentive: jest.fn(),
  createTurnoverIncentive: jest.fn(),
  deleteIncentive: jest.fn(),
  deleteWageTemplate: jest.fn(),
  getBonusAssignedUserIds: jest.fn(),
  listBonusIncentives: jest.fn(),
  listCountIncentives: jest.fn(),
  listIncentiveStaff: jest.fn(),
  listOvertimeIncentives: jest.fn(),
  listTurnoverIncentives: jest.fn(),
  listWageStaff: jest.fn(),
  listWageTemplates: jest.fn(),
  saveWageTemplate: jest.fn(),
  unassignIncentive: jest.fn(),
  unassignWages: jest.fn(),
  updateBonusIncentive: jest.fn(),
  updateCountIncentive: jest.fn(),
  updateOvertimeIncentive: jest.fn(),
  updateTurnoverIncentive: jest.fn(),
}));

const mocked = payroll as unknown as Record<string, jest.Mock>;
beforeEach(() => Object.values(mocked).forEach((m) => m.mockReset?.()));

const base = { orgId: 'ORG', items: [], nextName: '4' };

describe('daily wages / hourly charges save', () => {
  const editing: WageItem = { id: 'W1', name: '2', amount: 100, assignedCount: 0 };

  it('creates with {org, amount} and updates by template id', async () => {
    await dailyWagesConfig.save({ ...base, form: { amount: '650.5' }, editing: null });
    expect(mocked.saveWageTemplate).toHaveBeenLastCalledWith('daily', { orgId: 'ORG', amount: 650.5, id: undefined });
    await hourlyConfig.save({ ...base, form: { amount: '80' }, editing });
    expect(mocked.saveWageTemplate).toHaveBeenLastCalledWith('hourly', { orgId: 'ORG', amount: 80, id: 'W1' });
  });

  it('lists templates mapped to view items', async () => {
    mocked.listWageTemplates.mockResolvedValue([{ id: 'W1', name: '1', amount: 500, assignedCount: 2, raw: {} }]);
    await expect(dailyWagesConfig.api.list('ORG')).resolves.toEqual([{ id: 'W1', name: '1', amount: 500, assignedCount: 2 }]);
    expect(mocked.listWageTemplates).toHaveBeenCalledWith('daily', 'ORG');
  });
});

describe('overtime save', () => {
  it('creates with the auto number and total minutes, edits keep the name', async () => {
    await overtimeConfig.save({ ...base, form: { hours: '1', minutes: '30', amount: '200' }, editing: null });
    expect(mocked.createOvertimeIncentive).toHaveBeenCalledWith({ orgId: 'ORG', templateName: '4', durationMinutes: 90, amount: 200 });

    const editing = { id: 'I1', name: '2' } as unknown as OvertimeIncentive;
    await overtimeConfig.save({ ...base, form: { hours: '', minutes: '45', amount: '99.5' }, editing });
    expect(mocked.updateOvertimeIncentive).toHaveBeenCalledWith('I1', { durationMinutes: 45, amount: 99.5 });
  });
});

describe('bonus save', () => {
  it('creates with month name and numeric year', async () => {
    await bonusConfig.save({ ...base, form: { percent: '12.5', month: 'March', year: 2026 }, editing: null });
    expect(mocked.createBonusIncentive).toHaveBeenCalledWith({
      orgId: 'ORG',
      templateName: '4',
      bonusPercent: 12.5,
      month: 'March',
      year: 2026,
    });
  });

  it('persists the edited month and year as well as the percentage (v1 sent only the percentage)', async () => {
    const editing = { id: 'B1', name: '2' } as unknown as BonusIncentive;
    await bonusConfig.save({ ...base, form: { percent: '15', month: 'June', year: 2027 }, editing });
    expect(mocked.updateBonusIncentive).toHaveBeenCalledWith('B1', 15, { month: 'June', year: 2027 });
  });

  it('collects the staff already on any bonus for the warning', async () => {
    mocked.getBonusAssignedUserIds.mockResolvedValue(new Set(['u1', 'u2']));
    await expect(bonusConfig.assign.loadWarnIds?.('ORG', [])).resolves.toEqual(['u1', 'u2']);
    expect(bonusConfig.assign.title).toBe('Staff Details');
    expect(bonusConfig.assign.warnMessage?.('Asha')).toBe('Asha is already assigned to a bonus. Do you still want to assign them?');
  });
});

describe('count / turnover save', () => {
  it('count: whole numbers and incentive amount', async () => {
    await countBasisConfig.save({ ...base, form: { countUpto: '10', nextCount: '5', incentive: '100.5' }, editing: null });
    expect(mocked.createCountIncentive).toHaveBeenCalledWith({
      orgId: 'ORG',
      templateName: '4',
      countUpto: 10,
      nextCount: 5,
      eachIncentive: 100.5,
    });
    const editing = { id: 'C1', name: '1' } as unknown as CountIncentive;
    await countBasisConfig.save({ ...base, form: { countUpto: '12', nextCount: '6', incentive: '90' }, editing });
    expect(mocked.updateCountIncentive).toHaveBeenCalledWith('C1', { countUpto: 12, nextCount: 6, eachIncentive: 90 });
  });

  it('turnover: create and update carry the same body (v1), the update keeps the template name', async () => {
    await turnoverConfig.save({ ...base, form: { turnoverUpto: '50000', incentive: '7.5' }, editing: null });
    expect(mocked.createTurnoverIncentive).toHaveBeenCalledWith({ orgId: 'ORG', templateName: '4', turnoverUpto: 50000, incentivePercent: 7.5 });
    const editing = { id: 'T1', name: '3' } as unknown as TurnoverIncentive;
    await turnoverConfig.save({ ...base, form: { turnoverUpto: '60000', incentive: '150' }, editing });
    expect(mocked.updateTurnoverIncentive).toHaveBeenCalledWith('T1', {
      orgId: 'ORG',
      templateName: '3',
      turnoverUpto: 60000,
      incentivePercent: 150,
    });
  });
});

describe('screen copy per type', () => {
  it('titles, numbering and delete prompts follow the specs', () => {
    expect(dailyWagesConfig.itemTitle({ id: 'a', name: '3', amount: 1, assignedCount: 0 }, 0)).toBe('Day Pay 3');
    expect(hourlyConfig.itemTitle({ id: 'a', name: '3', amount: 1, assignedCount: 0 }, 0)).toBe('Hour-Pay-3');
    expect(overtimeConfig.itemTitle({ id: 'a', name: '', assignedCount: 0 } as unknown as OvertimeIncentive, 1)).toBe('Over Time 2');
    expect(dailyWagesConfig.formTitle(null, '5')).toBe('Day Pay 5');
    expect(turnoverConfig.formTitle(null, '2')).toBe('Turnover 2');
    expect(overtimeConfig.deleteConfirm).toBe('Delete this overtime?');
    expect(bonusConfig.deleteConfirm).toBe('Delete this bonus?');
    expect(countBasisConfig.deleteConfirm).toBe('Delete this template?');
    expect(dailyWagesConfig.messages.saved).toBe('Template Saved!');
    expect(overtimeConfig.messages.saved).toBe('Saved Successfully!');
  });
});
