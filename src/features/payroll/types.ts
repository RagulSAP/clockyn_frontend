/** Shared types of the payroll feature. */

/** Per-field error messages of a template form (`''` / missing = valid). */
export type FieldErrors<F> = Partial<Record<keyof F & string, string>>;

/** `true` when at least one field carries an error message. */
export function hasErrors<F>(errors: FieldErrors<F>): boolean {
  return Object.values(errors).some((message) => typeof message === 'string' && message !== '');
}

/** Query-key `kind` of every payroll list screen. */
export type PayrollKind = 'payslip' | 'daily-wages' | 'hourly' | 'overtime' | 'bonus' | 'count' | 'turnover';
