import type { PayslipTemplate } from '@/types/api/payroll';
import { numberToWords, rupeesInWords } from '../utils/numberToWords';
import {
  buildPayslipInput,
  computeLiveTotals,
  deletablePayslipId,
  emptyPayslipForm,
  newCustomLine,
  orderPayslipTemplates,
  payslipFormFromTemplate,
  validatePayslipForm,
  type PayslipFormValues,
} from '../utils/payslipForm';

function form(patch: Partial<PayslipFormValues> = {}): PayslipFormValues {
  return { ...emptyPayslipForm(), name: 'Standard', basic: '30000', hra: '10000', ...patch };
}

describe('live payslip totals', () => {
  it('matches the v1 acceptance example', () => {
    const totals = computeLiveTotals(form({ earnings: [newCustomLine('Bonus', '2000')], epf: '1800' }));
    expect(totals).toEqual({ totalEarnings: 42000, totalDeductions: 1800, netSalary: 40200 });
  });

  it('keeps decimals instead of truncating them with parseInt', () => {
    const totals = computeLiveTotals(form({ basic: '1000.75', hra: '0.25' }));
    expect(totals.totalEarnings).toBe(1001);
    expect(computeLiveTotals(form({ basic: '1000.75', hra: '0' })).totalEarnings).toBe(1000.75);
  });

  it('is exact where binary floats are not (0.1 + 0.2)', () => {
    expect(computeLiveTotals(form({ basic: '0.1', hra: '0.2' })).totalEarnings).toBe(0.3);
  });

  it('never produces NaN for blank or invalid text', () => {
    const totals = computeLiveTotals(form({ basic: 'abc', hra: '', epf: '--', deductions: [newCustomLine('x', 'zz')] }));
    expect(totals).toEqual({ totalEarnings: 0, totalDeductions: 0, netSalary: 0 });
  });

  it('counts only custom rows that will be saved (name and amount)', () => {
    const totals = computeLiveTotals(
      form({ earnings: [newCustomLine('', '500'), newCustomLine('Travel', ''), newCustomLine('Travel', '250')] }),
    );
    expect(totals.totalEarnings).toBe(40250);
  });

  it('can go negative (deductions above earnings)', () => {
    expect(computeLiveTotals(form({ basic: '100', hra: '0', epf: '250' })).netSalary).toBe(-150);
  });
});

describe('payslip validation', () => {
  it('requires Basic and HRA first, then the name (v1 order and copy)', () => {
    expect(validatePayslipForm(form({ basic: '', name: '' })).message).toBe('Please fill basic salary and HRA');
    expect(validatePayslipForm(form({ hra: '' })).message).toBe('Please fill basic salary and HRA');
    expect(validatePayslipForm(form({ name: '   ' })).message).toBe('Please enter template name');
    expect(validatePayslipForm(form()).message).toBeNull();
  });

  it('accepts zero (v1 let "0" through)', () => {
    expect(validatePayslipForm(form({ basic: '0', hra: '0' })).message).toBeNull();
  });

  it('rejects non-numeric and negative amounts inline', () => {
    const result = validatePayslipForm(form({ basic: 'abc', epf: '-5' }));
    expect(result.message).toBe('Please correct the highlighted amounts');
    expect(result.fields).toEqual({ basic: 'Enter a valid amount', epf: 'Enter a valid amount' });
  });

  it('validates saved custom rows only', () => {
    const bad = newCustomLine('Travel', 'x1');
    const ignored = newCustomLine('', 'x2');
    const result = validatePayslipForm(form({ earnings: [bad, ignored] }));
    expect(Object.keys(result.fields)).toEqual([`earnings:${bad.id}`]);
  });
});

describe('payslip payload', () => {
  it('sends numbers, zero for blank optional amounts and only complete custom rows', () => {
    const input = buildPayslipInput(
      'ORG',
      form({
        name: '  Standard ',
        basic: '30000.5',
        earnings: [newCustomLine('Travel', '1000'), newCustomLine('Travel', ''), newCustomLine('', '5')],
        deductions: [newCustomLine('Loan', '300.25')],
      }),
    );
    expect(input).toEqual({
      orgId: 'ORG',
      name: 'Standard',
      basicPay: 30000.5,
      hra: 10000,
      epf: 0,
      professionalTax: 0,
      healthInsurance: 0,
      customEarnings: [{ name: 'Travel', amount: 1000 }],
      customDeductions: [{ name: 'Loan', amount: 300.25 }],
    });
  });

  it('prefills the edit form from a template', () => {
    const template = {
      id: 'P1',
      name: 'Standard',
      basicPay: 20000,
      hra: 5000.5,
      epf: 1800,
      professionalTax: 200,
      healthInsurance: 0,
      customEarnings: [{ name: 'Travel', amount: 1000 }],
      customDeductions: [],
    } as unknown as PayslipTemplate;
    const values = payslipFormFromTemplate(template);
    expect(values).toMatchObject({ name: 'Standard', basic: '20000', hra: '5000.5', epf: '1800', professionalTax: '200', healthInsurance: '0' });
    expect(values.earnings.map((l) => [l.name, l.amount])).toEqual([['Travel', '1000']]);
  });
});

describe('payslip list order and delete rule', () => {
  const tpl = (id: string, createdAt: string | null) => ({ id, createdAt }) as unknown as PayslipTemplate;

  it('orders by created_at ascending (not by parseInt of a UUID) and deletes only the newest', () => {
    const ordered = orderPayslipTemplates([
      tpl('9aaa-new', '2026-03-01 10:00:00'),
      tpl('1bbb-old', '2026-01-01 10:00:00'),
      tpl('5ccc-mid', '2026-02-01 10:00:00'),
    ]);
    expect(ordered.map((t) => t.id)).toEqual(['1bbb-old', '5ccc-mid', '9aaa-new']);
    expect(deletablePayslipId(ordered)).toBe('9aaa-new');
  });

  it('keeps the server order for equal / missing timestamps and does not mutate the input', () => {
    const input = [tpl('b', null), tpl('a', null), tpl('c', '2026-01-01')];
    const copy = [...input];
    expect(orderPayslipTemplates(input).map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(input).toEqual(copy);
    expect(deletablePayslipId([])).toBeNull();
  });
});

describe('amount in words (en-IN)', () => {
  it('spells Indian number groups', () => {
    expect(numberToWords(0)).toBe('Zero');
    expect(numberToWords(7)).toBe('Seven');
    expect(numberToWords(15)).toBe('Fifteen');
    expect(numberToWords(40)).toBe('Forty');
    expect(numberToWords(99)).toBe('Ninety Nine');
    expect(numberToWords(105)).toBe('One Hundred Five');
    expect(numberToWords(12345)).toBe('Twelve Thousand Three Hundred Forty Five');
    expect(numberToWords(10000000)).toBe('One Crore');
    expect(numberToWords(123456789)).toBe('Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine');
  });

  it('drops paise and reads the acceptance example', () => {
    expect(rupeesInWords(125000.75)).toBe('One Lakh Twenty Five Thousand Rupees Only');
  });

  it('handles negative and non-finite net pay without "undefined"', () => {
    expect(numberToWords(-250)).toBe('Minus Two Hundred Fifty');
    expect(numberToWords(Number.NaN)).toBe('Zero');
  });
});
