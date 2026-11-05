/**
 * Payslip template form: model, decimal-safe live totals, validation and payload builder.
 * v1 summed with `parseInt` (decimals truncated, "NaN" for text); here every amount is parsed strictly and summed in
 * integer paise so the live totals equal what the server computes from the saved floats.
 */
import type { PayItem, PayslipTemplate, PayslipTemplateInput, PayslipTotals } from '@/types/api/payroll';
import { toNumber } from '@/lib/format';

/** One custom earning / deduction row of the editor. */
export interface CustomLine {
  /** Local row key (never sent). */
  id: string;
  name: string;
  /** Typed amount (kept as text while editing). */
  amount: string;
}

export interface PayslipFormValues {
  name: string;
  basic: string;
  hra: string;
  epf: string;
  professionalTax: string;
  healthInsurance: string;
  earnings: CustomLine[];
  deductions: CustomLine[];
}

export type FixedAmountField = 'basic' | 'hra' | 'epf' | 'professionalTax' | 'healthInsurance';
export const FIXED_AMOUNT_FIELDS: readonly FixedAmountField[] = ['basic', 'hra', 'epf', 'professionalTax', 'healthInsurance'];

let lineCounter = 0;
/** New empty custom row with a process-unique key. */
export function newCustomLine(name = '', amount = ''): CustomLine {
  lineCounter += 1;
  return { id: `line-${lineCounter}`, name, amount };
}

export function emptyPayslipForm(): PayslipFormValues {
  return { name: '', basic: '', hra: '', epf: '', professionalTax: '', healthInsurance: '', earnings: [], deductions: [] };
}

const amountText = (n: number): string => String(n);

/** Prefill of the edit mode from a template (`health_insurance` null maps to 0, as in v1). */
export function payslipFormFromTemplate(t: PayslipTemplate): PayslipFormValues {
  const lines = (items: PayItem[]) => items.map((i) => newCustomLine(i.name, amountText(i.amount)));
  return {
    name: t.name,
    basic: amountText(t.basicPay),
    hra: amountText(t.hra),
    epf: amountText(t.epf),
    professionalTax: amountText(t.professionalTax),
    healthInsurance: amountText(t.healthInsurance),
    earnings: lines(t.customEarnings),
    deductions: lines(t.customDeductions),
  };
}

/** Amount in whole paise (rounded), so sums of decimals are exact. */
export function toPaise(n: number): number {
  return Math.round((n + Number.EPSILON * Math.sign(n)) * 100);
}

/** Parsed amount of a typed value: `0` for blank, `null` when the text is not a valid non-negative number. */
export function parseAmountField(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const n = toNumber(trimmed);
  return n !== null && n >= 0 ? n : null;
}

/** A custom row is saved (and counted) only when it has a name AND an amount. */
export function isSavedLine(line: CustomLine): boolean {
  return line.name.trim() !== '' && line.amount.trim() !== '';
}

/** Typed value as a safe number for display math: invalid / blank text counts as 0, never NaN. */
function safeAmount(raw: string): number {
  return parseAmountField(raw) ?? 0;
}

/** Live totals shown while typing (decimal-safe; never NaN; counts only the rows that will be saved). */
export function computeLiveTotals(v: PayslipFormValues): PayslipTotals {
  const sumLines = (lines: CustomLine[]) => lines.filter(isSavedLine).reduce((t, l) => t + toPaise(safeAmount(l.amount)), 0);
  const earnings = toPaise(safeAmount(v.basic)) + toPaise(safeAmount(v.hra)) + sumLines(v.earnings);
  const deductions =
    toPaise(safeAmount(v.epf)) + toPaise(safeAmount(v.professionalTax)) + toPaise(safeAmount(v.healthInsurance)) + sumLines(v.deductions);
  return { totalEarnings: earnings / 100, totalDeductions: deductions / 100, netSalary: (earnings - deductions) / 100 };
}

export interface PayslipValidation {
  /** Toast to show (the v1 required-field messages, or a generic prompt for invalid amounts). */
  message: string | null;
  /** Inline errors keyed by field (`basic`, `hra`, ..., `earnings:<id>`, `deductions:<id>`). */
  fields: Record<string, string>;
}

export const MSG_REQUIRED_AMOUNTS = 'Please fill basic salary and HRA';
export const MSG_REQUIRED_NAME = 'Please enter template name';
export const MSG_INVALID_AMOUNTS = 'Please correct the highlighted amounts';
export const MSG_INVALID_AMOUNT = 'Enter a valid amount';

/**
 * Save validation. v1 order: Basic/HRA required, then name; new: every typed amount must be a non-negative number
 * (v1 sent NaN, which the server rejected with a generic failure).
 */
export function validatePayslipForm(v: PayslipFormValues): PayslipValidation {
  if (v.basic.trim() === '' || v.hra.trim() === '') return { message: MSG_REQUIRED_AMOUNTS, fields: {} };
  if (v.name.trim() === '') return { message: MSG_REQUIRED_NAME, fields: {} };

  const fields: Record<string, string> = {};
  for (const key of FIXED_AMOUNT_FIELDS) {
    if (parseAmountField(v[key]) === null) fields[key] = MSG_INVALID_AMOUNT;
  }
  for (const [prefix, lines] of [['earnings', v.earnings], ['deductions', v.deductions]] as const) {
    for (const line of lines) {
      if (isSavedLine(line) && parseAmountField(line.amount) === null) fields[`${prefix}:${line.id}`] = MSG_INVALID_AMOUNT;
    }
  }
  return Object.keys(fields).length > 0 ? { message: MSG_INVALID_AMOUNTS, fields } : { message: null, fields };
}

/** API input of a valid form: blank optional amounts are sent as 0; unnamed / amount-less custom rows are dropped. */
export function buildPayslipInput(orgId: string, v: PayslipFormValues): PayslipTemplateInput {
  const lines = (list: CustomLine[]): PayItem[] =>
    list.filter(isSavedLine).map((l) => ({ name: l.name.trim(), amount: parseAmountField(l.amount) ?? 0 }));
  return {
    orgId,
    name: v.name.trim(),
    basicPay: parseAmountField(v.basic) ?? 0,
    hra: parseAmountField(v.hra) ?? 0,
    epf: parseAmountField(v.epf) ?? 0,
    professionalTax: parseAmountField(v.professionalTax) ?? 0,
    healthInsurance: parseAmountField(v.healthInsurance) ?? 0,
    customEarnings: lines(v.earnings),
    customDeductions: lines(v.deductions),
  };
}

/* ------------------------------------------------------------------------------------------------ */
/* List order / delete rule                                                                           */
/* ------------------------------------------------------------------------------------------------ */

/**
 * Deterministic list order: oldest first by `createdAt` (the server order, `created_at ASC`); templates without a
 * timestamp keep their relative position. v1 sorted with `parseInt(<uuid>)`, which is meaningless.
 */
export function orderPayslipTemplates(list: readonly PayslipTemplate[]): PayslipTemplate[] {
  return list
    .map((t, index) => ({ t, index }))
    .sort((a, b) => {
      const ca = a.t.createdAt;
      const cb = b.t.createdAt;
      if (ca && cb && ca !== cb) return ca < cb ? -1 : 1;
      return a.index - b.index;
    })
    .map((x) => x.t);
}

/** Only the newest template (last in `orderPayslipTemplates`) offers Delete. */
export function deletablePayslipId(ordered: readonly PayslipTemplate[]): string | null {
  return ordered.length > 0 ? ordered[ordered.length - 1].id : null;
}
