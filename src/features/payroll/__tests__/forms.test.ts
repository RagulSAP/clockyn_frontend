import type { BonusIncentive, CountIncentive, OvertimeIncentive, TurnoverIncentive } from '@/types/api/payroll';
import {
  BONUS_MONTHS,
  bonusFormFromItem,
  bonusYearOptions,
  livePercentError,
  validateBonusForm,
} from '../utils/bonusForm';
import {
  countFormFromItem,
  turnoverFormFromItem,
  validateCountForm,
  validateTurnoverForm,
} from '../utils/incentiveForms';
import { liveAmountError } from '../utils/numbers';
import {
  formatOvertimeDuration,
  liveMinutesError,
  overtimeFormFromItem,
  overtimeTotalMinutes,
  validateOvertimeForm,
} from '../utils/overtimeForm';
import { validateWageForm, wageAmount, type WageItem } from '../utils/wageForm';

const wage = (id: string, name: string, amount: number): WageItem => ({ id, name, amount, assignedCount: 0 });
const ot = (id: string, name: string, durationMinutes: number, amount = 100) =>
  ({ id, name, durationMinutes, amount, assignedCount: 0, kind: 'overtime' }) as unknown as OvertimeIncentive;
const bonus = (id: string, name: string, bonusPercent: number) =>
  ({ id, name, bonusPercent, month: 'March', year: 2026, assignedCount: 0, kind: 'bonus' }) as unknown as BonusIncentive;
const count = (id: string, name: string, countUpto: number, nextCount: number, eachIncentive: number) =>
  ({ id, name, countUpto, nextCount, eachIncentive, assignedCount: 0, kind: 'count' }) as unknown as CountIncentive;
const turnover = (id: string, name: string, turnoverUpto: number, incentivePercent: number) =>
  ({ id, name, turnoverUpto, incentivePercent, assignedCount: 0, kind: 'turnover' }) as unknown as TurnoverIncentive;

describe('daily wages / hourly charges validation', () => {
  const items = [wage('a', '1', 500), wage('b', '2', 750.5)];
  const ctx = { items, editing: null };

  it('requires a positive number', () => {
    expect(validateWageForm({ amount: '' }, ctx)).toEqual({ amount: 'Amount is required' });
    expect(validateWageForm({ amount: '   ' }, ctx)).toEqual({ amount: 'Amount is required' });
    expect(validateWageForm({ amount: '0' }, ctx)).toEqual({ amount: 'Amount must be a valid number' });
    expect(validateWageForm({ amount: '-5' }, ctx)).toEqual({ amount: 'Amount must be a valid number' });
    expect(validateWageForm({ amount: 'abc' }, ctx)).toEqual({ amount: 'Amount must be a valid number' });
    expect(validateWageForm({ amount: '12abc' }, ctx)).toEqual({ amount: 'Amount must be a valid number' });
    expect(validateWageForm({ amount: '1200.5' }, ctx)).toEqual({});
  });

  it('daily wages accept an amount another template already has', () => {
    expect(validateWageForm({ amount: '500' }, ctx)).toEqual({});
  });

  it('hourly charges refuse duplicates (naming the template) but allow keeping the own amount', () => {
    const hourly = { ...ctx, duplicateLabel: 'Hour-Pay-' };
    expect(validateWageForm({ amount: '750.5' }, hourly)).toEqual({ amount: 'This amount already exists in Hour-Pay-2' });
    expect(validateWageForm({ amount: '750.5' }, { ...hourly, editing: items[1] })).toEqual({});
  });

  it('shows the live error only for non-empty invalid text', () => {
    expect(liveAmountError('')).toBe('');
    expect(liveAmountError('-5')).toBe('Amount must be a valid number');
    expect(liveAmountError('5')).toBe('');
  });

  it('parses the amount to send and throws on invalid input', () => {
    expect(wageAmount({ amount: ' 1,250.5 ' })).toBe(1250.5);
    expect(() => wageAmount({ amount: '0' })).toThrow();
  });
});

describe('overtime form', () => {
  const items = [ot('a', '1', 90), ot('b', '2', 45)];
  const ctx = { items, editing: null };
  const form = (hours: string, minutes: string, amount = '100') => ({ hours, minutes, amount });

  it('formats the duration chip', () => {
    expect(formatOvertimeDuration(90)).toBe('1h 30m');
    expect(formatOvertimeDuration(120)).toBe('2h');
    expect(formatOvertimeDuration(45)).toBe('45m');
    expect(formatOvertimeDuration(0)).toBe('0m');
  });

  it('splits an existing duration for editing (minutes blank when 0)', () => {
    expect(overtimeFormFromItem(ot('a', '1', 90))).toEqual({ hours: '1', minutes: '30', amount: '100' });
    expect(overtimeFormFromItem(ot('a', '1', 120))).toEqual({ hours: '2', minutes: '', amount: '100' });
    expect(overtimeFormFromItem(null)).toEqual({ hours: '', minutes: '', amount: '' });
  });

  it('computes total minutes from the two boxes', () => {
    expect(overtimeTotalMinutes({ hours: '2', minutes: '15' })).toBe(135);
    expect(overtimeTotalMinutes({ hours: '', minutes: '45' })).toBe(45);
  });

  it('reports a blank or zero duration and a missing amount', () => {
    expect(validateOvertimeForm(form('', '', ''), ctx)).toEqual({ hours: 'Enter the Duration', amount: 'Amount is required' });
    expect(validateOvertimeForm(form('0', '0'), ctx)).toEqual({ hours: 'Enter the Duration' });
  });

  it('limits minutes to 0-59 and the amount to a positive number', () => {
    expect(validateOvertimeForm(form('1', '75'), ctx).minutes).toBe('Minutes must be 0-59');
    expect(liveMinutesError('75')).toBe('Minutes must be 0-59');
    expect(liveMinutesError('59')).toBe('');
    expect(validateOvertimeForm(form('1', '5', '0'), ctx).amount).toBe('Amount must be a valid number');
  });

  it('refuses a duplicate duration but not the template own duration', () => {
    expect(validateOvertimeForm(form('1', '30'), ctx)).toEqual({ hours: 'This duration already exists in Over Time 1' });
    expect(validateOvertimeForm(form('0', '45'), { items, editing: items[1] })).toEqual({});
    expect(validateOvertimeForm(form('3', '0'), ctx)).toEqual({});
  });
});

describe('bonus form', () => {
  const items = [bonus('a', '1', 10), bonus('b', '2', 12.5)];
  const ctx = { items, editing: null };

  it('requires percentage, month and year together', () => {
    expect(validateBonusForm({ percent: '', month: '', year: null }, ctx)).toEqual({
      percent: 'Percentage is required',
      month: 'Month is required',
      year: 'Year is required',
    });
  });

  it('keeps the percentage within 0-100 (0 allowed)', () => {
    const base = { month: 'May', year: 2026 };
    expect(validateBonusForm({ ...base, percent: '150' }, ctx).percent).toBe('Enter a number between 0-100');
    expect(validateBonusForm({ ...base, percent: '-1' }, ctx).percent).toBe('Enter a number between 0-100');
    expect(validateBonusForm({ ...base, percent: '0' }, ctx)).toEqual({});
    expect(validateBonusForm({ ...base, percent: '100' }, ctx)).toEqual({});
    expect(livePercentError('150')).toBe('Enter a number between 0-100');
    expect(livePercentError('')).toBe('');
  });

  it('refuses duplicate percentages except for the template being edited', () => {
    const form = { percent: '12.5', month: 'May', year: 2026 };
    expect(validateBonusForm(form, ctx)).toEqual({ percent: 'This percentage already exists in Bonus 2' });
    expect(validateBonusForm(form, { items, editing: items[1] })).toEqual({});
  });

  it('prefills month / year from the template and offers a 10-year window', () => {
    expect(bonusFormFromItem(items[1])).toEqual({ percent: '12.5', month: 'March', year: 2026 });
    expect(BONUS_MONTHS).toHaveLength(12);
    expect(bonusYearOptions(2026)).toEqual([2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]);
    expect(bonusYearOptions(2026, 2018)[0]).toBe(2018);
  });
});

describe('count basis form', () => {
  const items = [count('a', '1', 10, 5, 100), count('b', '2', 20, 8, 250.5)];
  const ctx = { items, editing: null };

  it('reports every blank field together', () => {
    expect(validateCountForm({ countUpto: '', nextCount: ' ', incentive: '' }, ctx)).toEqual({
      countUpto: 'Count upto is required',
      nextCount: 'Next count is required',
      incentive: 'Incentive is required',
    });
  });

  it('rejects zero, text and decimals in the whole-number fields', () => {
    const errors = validateCountForm({ countUpto: '0', nextCount: '12.5', incentive: 'abc' }, ctx);
    expect(errors).toEqual({ countUpto: 'Must be a valid number', nextCount: 'Must be a valid number', incentive: 'Must be a valid number' });
  });

  it('requires each of the three values to be unique and names the other template', () => {
    expect(validateCountForm({ countUpto: '10', nextCount: '99', incentive: '1' }, ctx)).toEqual({
      countUpto: 'This value already exists in Count 1',
    });
    expect(validateCountForm({ countUpto: '11', nextCount: '8', incentive: '250.5' }, ctx)).toEqual({
      nextCount: 'This value already exists in Count 2',
      incentive: 'This value already exists in Count 2',
    });
    expect(validateCountForm({ countUpto: '10', nextCount: '5', incentive: '100' }, { items, editing: items[0] })).toEqual({});
  });

  it('prefills from the template', () => {
    expect(countFormFromItem(items[1])).toEqual({ countUpto: '20', nextCount: '8', incentive: '250.5' });
  });
});

describe('turnover basis form', () => {
  const items = [turnover('a', '1', 50000, 5), turnover('b', '2', 80000, 7.5)];
  const ctx = { items, editing: null };

  it('requires both values and a positive number', () => {
    expect(validateTurnoverForm({ turnoverUpto: '', incentive: '' }, ctx)).toEqual({
      turnoverUpto: 'Turnover upto is required',
      incentive: 'Incentive is required',
    });
    expect(validateTurnoverForm({ turnoverUpto: '0', incentive: 'x' }, ctx)).toEqual({
      turnoverUpto: 'Must be a valid number',
      incentive: 'Must be a valid number',
    });
  });

  it('refuses a duplicate turnover amount but allows a repeated or very large percentage', () => {
    expect(validateTurnoverForm({ turnoverUpto: '50000', incentive: '5' }, ctx)).toEqual({
      turnoverUpto: 'This value already exists in Turnover 1',
    });
    expect(validateTurnoverForm({ turnoverUpto: '60000', incentive: '7.5' }, ctx)).toEqual({});
    expect(validateTurnoverForm({ turnoverUpto: '60000', incentive: '150' }, ctx)).toEqual({});
    expect(validateTurnoverForm({ turnoverUpto: '50000', incentive: '5' }, { items, editing: items[0] })).toEqual({});
  });

  it('prefills from the template', () => {
    expect(turnoverFormFromItem(items[1])).toEqual({ turnoverUpto: '80000', incentive: '7.5' });
  });
});
