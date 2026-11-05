/** Salary sheet: columns, salary-type labels, display formatting and the 18-column export mapping. */
import { formatNumber, formatINR } from '@/lib/format';
import type { StaffSalaryBreakdown } from '@/types/api/salaryReports';
import type { StaffMember } from '@/types/api/staff';
import type { ExportColumnDef } from '../types';

export const SALARY_TYPES = [
  { key: 'MONTHLY_FIXED', label: 'Monthly', tone: 'primary' },
  { key: 'WEEKLY', label: 'Weekly', tone: 'info' },
  { key: 'DAILY_WAGES', label: 'Daily', tone: 'warning' },
  { key: 'HOURLY', label: 'Hourly', tone: 'success' },
] as const;

export type SalaryTypeKey = (typeof SALARY_TYPES)[number]['key'];

/** `Monthly`/`Weekly`/`Daily`/`Hourly`; an unknown key is shown raw, empty as `—`. */
export function salaryTypeLabel(key: string | null | undefined): string {
  const found = SALARY_TYPES.find((t) => t.key === key);
  return found ? found.label : String(key || '—');
}

export const EMPTY_CELL = '—';

/** Currency cell: `₹1,23,456`; zero / empty → `—`. */
export function formatMoneyCell(value: number | null | undefined): string {
  return value ? formatINR(Number(value)) : EMPTY_CELL;
}

/** Plain count cell (`incentive_count`): number or `—`. */
export function formatCountCell(value: number | null | undefined): string {
  return value ? formatNumber(value) : EMPTY_CELL;
}

export type SalaryAmountKey =
  | 'basicSalary'
  | 'dailyWages'
  | 'hourlyCalc'
  | 'incentiveCount'
  | 'incentiveTurnover'
  | 'overtime'
  | 'bonus'
  | 'fine'
  | 'odometer'
  | 'travelTicket'
  | 'otherBills'
  | 'advance'
  | 'netSalary';

export interface SalaryColumn {
  key: SalaryAmountKey;
  title: string;
  kind: 'money' | 'count';
  /** Only the Fine column is drawn red when non-zero, only Net is drawn bold green. */
  emphasis?: 'fine' | 'net';
}

/** The 13 amount columns after the Type column (14 on-screen columns in total). */
export const SALARY_COLUMNS: SalaryColumn[] = [
  { key: 'basicSalary', title: 'Basic (₹)', kind: 'money' },
  { key: 'dailyWages', title: 'Daily Wages', kind: 'money' },
  { key: 'hourlyCalc', title: 'Hourly Calc', kind: 'money' },
  { key: 'incentiveCount', title: 'Count (#)', kind: 'count' },
  { key: 'incentiveTurnover', title: 'Turnover (₹)', kind: 'money' },
  { key: 'overtime', title: 'OT (₹)', kind: 'money' },
  { key: 'bonus', title: 'Bonus (₹)', kind: 'money' },
  { key: 'fine', title: 'Fine (₹)', kind: 'money', emphasis: 'fine' },
  { key: 'odometer', title: 'Odometer', kind: 'money' },
  { key: 'travelTicket', title: 'Ticket', kind: 'money' },
  { key: 'otherBills', title: 'Other Bills', kind: 'money' },
  { key: 'advance', title: 'Advance (₹)', kind: 'money' },
  { key: 'netSalary', title: 'Net Salary', kind: 'money', emphasis: 'net' },
];

/** `DataTable` header groups in display order (Employee + Type + 3 amounts, Incentive ×2, OT/Bonus/Fine, Travel ×2, rest). */
export const SALARY_HEADER_GROUPS: { title: string; span: number }[] = [
  { title: '', span: 5 },
  { title: 'Incentive', span: 2 },
  { title: '', span: 3 },
  { title: 'Travel', span: 2 },
  { title: '', span: 3 },
];

/** A sheet row: the server breakdown with the (local-only) salary type that may have been overridden. */
export type SalarySheetRow = StaffSalaryBreakdown;

/** Zero-amount row for a staff member (used when the breakdown endpoint fails): type Monthly, all amounts 0. */
export function zeroRowFromStaff(s: StaffMember): SalarySheetRow {
  return {
    userId: s.userId,
    name: s.name,
    empId: s.empId,
    roleName: s.roleId === 2 ? 'Manager' : 'Employee',
    branchName: s.branch,
    salaryType: 'MONTHLY_FIXED',
    basicSalary: 0,
    incentive: 0,
    incentiveCount: 0,
    incentiveTurnover: 0,
    overtime: 0,
    bonus: 0,
    fine: 0,
    travelAllowance: 0,
    odometer: 0,
    travelTicket: 0,
    advance: 0,
    otherBills: 0,
    dailyWages: 0,
    hourlyCalc: 0,
    netSalary: 0,
    photoUrl: s.photoUrl ?? null,
  };
}

/** Sub-line under the name: `role_name || branch_name || emp_id || '—'`. */
export function salarySubline(row: Pick<SalarySheetRow, 'roleName' | 'branchName' | 'empId'>): string {
  return row.roleName || row.branchName || row.empId || EMPTY_CELL;
}

/** Applies local type overrides (per row id, then the "all staff" override). Net and amounts are NOT recomputed. */
export function applySalaryTypes(
  rows: readonly SalarySheetRow[],
  overrides: Readonly<Record<string, string>>,
  allType: string | null,
): SalarySheetRow[] {
  return rows.map((r) => {
    const type = overrides[r.userId] ?? allType ?? r.salaryType;
    return type === r.salaryType ? r : { ...r, salaryType: type };
  });
}

/** The 18 export columns, in the v1 order. */
export const SALARY_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'name', title: 'Employee' },
  { key: 'empId', title: 'Emp ID' },
  { key: 'role', title: 'Role' },
  { key: 'branch', title: 'Branch' },
  { key: 'type', title: 'Type' },
  { key: 'basic', title: 'Basic' },
  { key: 'dailyWages', title: 'Daily Wages' },
  { key: 'hourlyCalc', title: 'Hourly Calc' },
  { key: 'incentiveCount', title: 'Incentive Count' },
  { key: 'incentiveTurnover', title: 'Incentive Turnover' },
  { key: 'overtime', title: 'OT' },
  { key: 'bonus', title: 'Bonus' },
  { key: 'fine', title: 'Fine' },
  { key: 'odometer', title: 'Odometer' },
  { key: 'travelTicket', title: 'Travel Ticket' },
  { key: 'otherBills', title: 'Other Bills' },
  { key: 'advance', title: 'Advance' },
  { key: 'netSalary', title: 'Net Salary' },
];

/** Export rows carry RAW numbers (no ₹, zeros stay 0) and the (possibly overridden) type label. */
export function toSalaryExportRows(rows: readonly SalarySheetRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    name: r.name,
    empId: r.empId,
    role: r.roleName,
    branch: r.branchName,
    type: salaryTypeLabel(r.salaryType),
    basic: r.basicSalary,
    dailyWages: r.dailyWages,
    hourlyCalc: r.hourlyCalc,
    incentiveCount: r.incentiveCount,
    incentiveTurnover: r.incentiveTurnover,
    overtime: r.overtime,
    bonus: r.bonus,
    fine: r.fine,
    odometer: r.odometer,
    travelTicket: r.travelTicket,
    otherBills: r.otherBills,
    advance: r.advance,
    netSalary: r.netSalary,
  }));
}
