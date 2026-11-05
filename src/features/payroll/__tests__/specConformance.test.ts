/**
 * Spec-conformance pins (QA Q4b-05): worked examples and rule tables of the payroll specs that the feature suites do not
 * pin one by one - payslip totals vs the server formula, en-IN amount in words, wire bodies built from the typed form,
 * FIX_POLICY B.10 (zero / negative / non-numeric rejection) across every validator and the v1 failure copy.
 */
import { api } from '@/lib/api/client';
import {
  assignIncentive,
  assignWages,
  buildPayslipBody,
  computePayslipTotals,
  createBonusIncentive,
  createCountIncentive,
  createOvertimeIncentive,
  createTurnoverIncentive,
  deleteIncentive,
  deletePayslipTemplate,
  savePayslipTemplate,
  unassignIncentive,
  unassignWages,
  updateCountIncentive,
} from '@/api/payroll';
import type { BonusIncentive, CountIncentive, TurnoverIncentive } from '@/types/api/payroll';
import { validateBonusForm } from '../utils/bonusForm';
import { validateCountForm, validateTurnoverForm } from '../utils/incentiveForms';
import { liveWholeNumberError, parsePositive, parsePositiveInt } from '../utils/numbers';
import { numberToWords, rupeesInWords } from '../utils/numberToWords';
import { validateOvertimeForm } from '../utils/overtimeForm';
import { buildPayslipInput, computeLiveTotals, emptyPayslipForm, newCustomLine, validatePayslipForm } from '../utils/payslipForm';
import { validateWageForm } from '../utils/wageForm';

jest.mock('@/lib/api/client', () => jest.requireActual('@/api/testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete', jest.Mock>;
beforeEach(() => Object.values(mocked).forEach((m) => m.mockReset()));

describe('add_payslip §7 / §14: live totals equal the server formula', () => {
  const form = (patch: object) => ({ ...emptyPayslipForm(), name: 'N', basic: '0', hra: '0', ...patch });

  it('acceptance #10: 30000 + 10000 + custom 2000, EPF 1800 -> 42000 / 1800 / 40200', () => {
    const t = computeLiveTotals(form({ basic: '30000', hra: '10000', epf: '1800', earnings: [newCustomLine('Bonus', '2000')] }));
    expect(t).toEqual({ totalEarnings: 42000, totalDeductions: 1800, netSalary: 40200 });
  });

  it.each([
    ['decimals', { basic: '1000.75', hra: '0.25', epf: '10.10', professionalTax: '0.20', healthInsurance: '0.30' }],
    ['float trap', { basic: '0.1', hra: '0.2', epf: '0.7' }],
    ['large', { basic: '9999999.99', hra: '0.01', professionalTax: '200' }],
  ])('matches computePayslipTotals (%s)', (_name, patch) => {
    const v = form(patch);
    const live = computeLiveTotals(v);
    const server = computePayslipTotals({
      basicPay: Number(v.basic),
      hra: Number(v.hra),
      epf: Number(v.epf || 0),
      professionalTax: Number(v.professionalTax || 0),
      healthInsurance: Number(v.healthInsurance || 0),
    });
    expect(live.totalEarnings).toBeCloseTo(server.totalEarnings, 6);
    expect(live.totalDeductions).toBeCloseTo(server.totalDeductions, 6);
    expect(live.netSalary).toBeCloseTo(server.netSalary, 6);
  });

  it('acceptance #16: 1000.75 is not truncated to 1000', () => {
    expect(computeLiveTotals(form({ basic: '1000.75' })).totalEarnings).toBe(1000.75);
  });

  it('custom rows with a name but amount "0" are counted as 0 and still sent (server drops them)', () => {
    const v = form({ basic: '10', earnings: [newCustomLine('Zero', '0')] });
    expect(computeLiveTotals(v).totalEarnings).toBe(10);
    expect(buildPayslipInput('O', v).customEarnings).toEqual([{ name: 'Zero', amount: 0 }]);
  });
});

describe('add_payslip §6: wire body built from the typed form', () => {
  it('uses the v1 snake_case names with numeric values (blank EPF / PT / insurance -> 0)', () => {
    const v = {
      ...emptyPayslipForm(),
      name: ' Standard ',
      basic: '30000',
      hra: '10000.5',
      earnings: [newCustomLine('Travel', '2000'), newCustomLine('NoAmount', ''), newCustomLine('', '9')],
      deductions: [newCustomLine('Loan', '250.25')],
    };
    expect(validatePayslipForm(v).message).toBeNull();
    expect(buildPayslipBody(buildPayslipInput('ORG', v))).toEqual({
      payslip_name: 'Standard',
      org_id: 'ORG',
      basic_pay: 30000,
      hra: 10000.5,
      epf: 0,
      professional_tax: 0,
      health_insurance: 0,
      custom_earnings: [{ name: 'Travel', amount: 2000 }],
      custom_deductions: [{ name: 'Loan', amount: 250.25 }],
    });
  });

  it('create is a POST, update a PUT to /api/salary/template/{pay_slip_id}', async () => {
    mocked.post.mockResolvedValue({ success: true, pay_slip_id: 'N1', updated_templates: [] });
    mocked.put.mockResolvedValue({ success: true, updated_templates: [] });
    const input = buildPayslipInput('ORG', { ...emptyPayslipForm(), name: 'S', basic: '1', hra: '1' });
    await savePayslipTemplate(input);
    expect(mocked.post).toHaveBeenCalledWith('/api/salary/template', expect.objectContaining({ org_id: 'ORG', payslip_name: 'S' }));
    await savePayslipTemplate(input, 'P9');
    expect(mocked.put).toHaveBeenCalledWith('/api/salary/template/P9', expect.objectContaining({ org_id: 'ORG' }));
    expect(mocked.put.mock.calls[0][1]).not.toHaveProperty('pay_slip_id');
  });
});

describe('monthly_fixed R4 / acceptance #16: amount in words (en-IN)', () => {
  it.each([
    [0, 'Zero'],
    [9, 'Nine'],
    [10, 'Ten'],
    [19, 'Nineteen'],
    [20, 'Twenty'],
    [21, 'Twenty One'],
    [100, 'One Hundred'],
    [101, 'One Hundred One'],
    [999, 'Nine Hundred Ninety Nine'],
    [1000, 'One Thousand'],
    [1001, 'One Thousand One'],
    [40200, 'Forty Thousand Two Hundred'],
    [99999, 'Ninety Nine Thousand Nine Hundred Ninety Nine'],
    [100000, 'One Lakh'],
    [125000, 'One Lakh Twenty Five Thousand'],
    [1000000, 'Ten Lakh'],
    [9999999, 'Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine'],
    [10000000, 'One Crore'],
    [10100000, 'One Crore One Lakh'],
    [123456789, 'Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine'],
    [1000000000, 'One Hundred Crore'],
  ])('%i -> %s', (n, words) => {
    expect(numberToWords(n)).toBe(words);
  });

  it('floors paise and always ends with "Rupees Only"', () => {
    expect(rupeesInWords(125000.75)).toBe('One Lakh Twenty Five Thousand Rupees Only');
    expect(rupeesInWords(0.99)).toBe('Zero Rupees Only');
    expect(rupeesInWords(40200)).toBe('Forty Thousand Two Hundred Rupees Only');
  });
});

describe('FIX_POLICY B.10: zero / negative / non-numeric amounts are rejected everywhere', () => {
  const bad = ['abc', '-1', '-0.5', '12abc', '1e3', 'Infinity', 'NaN', '--5', '5-'];
  const badOrZero = ['0', '0.0', ...bad];
  const none = { items: [], editing: null };

  it.each(badOrZero)('wage / hourly rate %p', (raw) => {
    expect(validateWageForm({ amount: raw }, none).amount).toBe('Amount must be a valid number');
  });

  it.each(badOrZero)('overtime amount %p', (raw) => {
    expect(validateOvertimeForm({ hours: '1', minutes: '', amount: raw }, none).amount).toBe('Amount must be a valid number');
  });

  it.each(['-1', '1.5', 'x', '1e1'])('overtime hours %p', (raw) => {
    expect(validateOvertimeForm({ hours: raw, minutes: '', amount: '10' }, none).hours).toBe('Invalid hours');
  });

  it.each(['60', '99', '-1', '5.5', 'x'])('overtime minutes %p', (raw) => {
    expect(validateOvertimeForm({ hours: '1', minutes: raw, amount: '10' }, none).minutes).toBe('Minutes must be 0-59');
  });

  it.each([...bad, '100.01', '101', '1000'])('bonus percentage %p', (raw) => {
    const ctx = { items: [] as BonusIncentive[], editing: null };
    expect(validateBonusForm({ percent: raw, month: 'May', year: 2026 }, ctx).percent).toBe('Enter a number between 0-100');
  });

  const countCtx = { items: [] as CountIncentive[], editing: null };
  it.each([...badOrZero, '2.5'])('count whole-number fields %p', (raw) => {
    expect(validateCountForm({ countUpto: raw, nextCount: '1', incentive: '1' }, countCtx).countUpto).toBe('Must be a valid number');
    expect(validateCountForm({ countUpto: '1', nextCount: raw, incentive: '1' }, countCtx).nextCount).toBe('Must be a valid number');
  });
  it.each(badOrZero)('count each-incentive %p', (raw) => {
    expect(validateCountForm({ countUpto: '1', nextCount: '1', incentive: raw }, countCtx).incentive).toBe('Must be a valid number');
  });

  const turnoverCtx = { items: [] as TurnoverIncentive[], editing: null };
  it.each(badOrZero)('turnover amount and percent %p', (raw) => {
    expect(validateTurnoverForm({ turnoverUpto: raw, incentive: '1' }, turnoverCtx).turnoverUpto).toBe('Must be a valid number');
    expect(validateTurnoverForm({ turnoverUpto: '1', incentive: raw }, turnoverCtx).incentive).toBe('Must be a valid number');
  });

  it.each(['abc', '-1', '12abc', '1e3'])('payslip amount %p is flagged inline (zero stays allowed per spec)', (raw) => {
    const v = { ...emptyPayslipForm(), name: 'N', basic: raw, hra: '1' };
    expect(validatePayslipForm(v).fields.basic).toBe('Enter a valid amount');
  });

  it('shared parsers', () => {
    for (const raw of badOrZero) expect(parsePositive(raw)).toBeNull();
    for (const raw of ['0', '-1', '1.5', 'x', '']) expect(parsePositiveInt(raw)).toBeNull();
    expect(parsePositive('1,250.50')).toBe(1250.5);
    expect(parsePositiveInt('12')).toBe(12);
  });

  it('count whole-number fields flag a decimal live, as soon as it is typed', () => {
    expect(liveWholeNumberError('12.5')).toBe('Must be a valid number');
    expect(liveWholeNumberError('12')).toBe('');
    expect(liveWholeNumberError('')).toBe('');
    expect(liveWholeNumberError('0')).toBe('Must be a valid number');
  });
});

describe('failure copy when the server sends {success:false} without a message (v1 toasts)', () => {
  const payslip = { orgId: 'o', name: 'n', basicPay: 1, hra: 1, epf: 0, professionalTax: 0, healthInsurance: 0 };
  const calls: [string, () => Promise<unknown>, 'post' | 'put' | 'delete', string][] = [
    ['payslip save', () => savePayslipTemplate(payslip), 'post', 'Failed to save template'],
    ['payslip delete', () => deletePayslipTemplate('P1'), 'delete', 'Failed to delete template'],
    ['wage unassign', () => unassignWages('o', 'u', 't'), 'delete', 'Failed to unassign'],
    ['incentive unassign', () => unassignIncentive('o', 'u', 'i'), 'delete', 'Failed to unassign'],
    ['incentive delete', () => deleteIncentive('count', 'i'), 'delete', 'Failed to delete'],
    [
      'count create',
      () => createCountIncentive({ orgId: 'o', templateName: '1', countUpto: 1, nextCount: 1, eachIncentive: 1 }),
      'post',
      'Failed to save',
    ],
    ['count update', () => updateCountIncentive('i', { countUpto: 1, nextCount: 1, eachIncentive: 1 }), 'put', 'Failed to save'],
    [
      'overtime create',
      () => createOvertimeIncentive({ orgId: 'o', templateName: '1', durationMinutes: 1, amount: 1 }),
      'post',
      'Failed to save',
    ],
    [
      'turnover create',
      () => createTurnoverIncentive({ orgId: 'o', templateName: '1', turnoverUpto: 1, incentivePercent: 1 }),
      'post',
      'Failed to save',
    ],
    [
      'bonus create',
      () => createBonusIncentive({ orgId: 'o', templateName: '1', bonusPercent: 1, month: 'May', year: 2026 }),
      'post',
      'Failed to save',
    ],
    ['wage assign', () => assignWages('o', ['u'], 't'), 'post', 'Failed to assign staff'],
    ['incentive assign', () => assignIncentive('o', ['u'], 'i'), 'post', 'Failed to assign staff'],
  ];

  it.each(calls)('%s', async (_name, call, verb, message) => {
    mocked[verb].mockResolvedValue({ success: false });
    await expect(call()).rejects.toThrow(message);
  });

  it('a server message always wins', async () => {
    mocked.post.mockResolvedValue({ success: false, message: 'Template exists' });
    await expect(
      createBonusIncentive({ orgId: 'o', templateName: '1', bonusPercent: 1, month: 'May', year: 2026 }),
    ).rejects.toThrow('Template exists');
  });
});
