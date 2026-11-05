/** DTOs for payroll set-up (`src/api/payroll.ts`): payslip templates, wage templates, incentives. */
import type { RawRecord } from './common';

/** A named custom earning or deduction line. */
export interface PayItem {
  name: string;
  amount: number;
}

/** A monthly-fixed payslip (salary structure) template. */
export interface PayslipTemplate {
  /** `pay_slip_id`. */
  id: string;
  name: string;
  basicPay: number;
  hra: number;
  /** Provident fund (UI label PF). */
  epf: number;
  /** Wire `professional_tax` (the v1 UI labelled this field ESI). */
  professionalTax: number;
  healthInsurance: number;
  customEarnings: PayItem[];
  customDeductions: PayItem[];
  totalEarnings: number;
  totalDeductions: number;
  /** Server-computed: earnings minus deductions. */
  netSalary: number;
  assignedCount: number;
  createdAt: string | null;
  raw: RawRecord;
}

/** Create / update input of a payslip template. */
export interface PayslipTemplateInput {
  orgId: string;
  name: string;
  basicPay: number;
  hra: number;
  epf: number;
  professionalTax: number;
  healthInsurance: number;
  customEarnings?: PayItem[];
  customDeductions?: PayItem[];
}

/** Totals computed with the server's formula. */
export interface PayslipTotals {
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
}

/** Result of saving a template: the id (create only) and the refreshed list. */
export interface SavedPayslipTemplate {
  id: string | null;
  message: string;
  /** Updated template list as returned by the server (may be empty). */
  templates: PayslipTemplate[];
}

/** Staff row of the payslip-assignment picker. */
export interface PayslipStaffRow {
  staffId: string;
  name: string;
  empId: string;
  branchName: string;
  departmentName: string;
  /** Already assigned to the template passed as `payslipId`. */
  isAssigned: boolean;
}

/** Filter for `listPayslipStaff`. */
export interface PayslipStaffFilter {
  branchId?: string | number | null;
  departmentId?: string | null;
  payslipId?: string | null;
}

/** Payslip preview for one staff member (current month). */
export interface PayslipPreview {
  orgName: string;
  payslipName: string;
  /** Month name, e.g. `October`. */
  month: string;
  year: number;
  staffName: string;
  empId: string;
  department: string;
  branch: string;
  accountNumber: string;
  ifscCode: string;
  earnings: PayItem[];
  totalEarnings: number;
  deductions: PayItem[];
  totalDeductions: number;
  netPay: number;
}

/** Id + name used by branch / department filter dropdowns. */
export interface FilterOption {
  id: string;
  name: string;
}

/** Daily wage vs hourly charge templates share the same shape and `/api/wages/*` assignment endpoints. */
export type WageKind = 'daily' | 'hourly';

/** A daily-wage or hourly-charge template. */
export interface WageTemplate {
  id: string;
  /** Auto-numbered name (`"1"`, `"2"`, ...) when the server provides one. */
  name: string | null;
  amount: number;
  assignedCount: number;
  raw: RawRecord;
}

/** Staff row of the wage / incentive assignment pickers. */
export interface AssignableStaff {
  userId: string;
  name: string;
  empId: string;
  branchName: string;
  deptName: string;
}

/** Which side of an assignment list to read. */
export type AssignmentSide = 'assigned' | 'unassigned';

/** The four incentive template kinds. */
export type IncentiveKind = 'count' | 'turnover' | 'overtime' | 'bonus';

/** Fields common to every incentive template. */
interface IncentiveBase {
  /** `incentive_id`. */
  id: string;
  /** Auto-numbered template name (`"1"`, `"2"`, ...). */
  name: string;
  assignedCount: number;
  createdAt: string | null;
  raw: RawRecord;
}

/** Count-based incentive: after `countUpto` units, `eachIncentive` per every `nextCount`. */
export interface CountIncentive extends IncentiveBase {
  kind: 'count';
  countUpto: number;
  nextCount: number;
  eachIncentive: number;
}

/** Turnover-based incentive. */
export interface TurnoverIncentive extends IncentiveBase {
  kind: 'turnover';
  turnoverUpto: number;
  /** Percent paid on turnover beyond the target. */
  incentivePercent: number;
}

/** Overtime incentive: `amount` per `durationMinutes` of overtime. */
export interface OvertimeIncentive extends IncentiveBase {
  kind: 'overtime';
  durationMinutes: number;
  amount: number;
}

/** Bonus incentive: `bonusPercent` for a month/year. */
export interface BonusIncentive extends IncentiveBase {
  kind: 'bonus';
  bonusPercent: number;
  month: string;
  year: number | null;
  /** User ids already assigned (when the server includes them in the list), else `null`. */
  assignedUserIds: string[] | null;
}

/** Any incentive template. */
export type Incentive = CountIncentive | TurnoverIncentive | OvertimeIncentive | BonusIncentive;

/** Create inputs (field names follow the v1 request bodies). */
export interface CountIncentiveInput {
  orgId: string;
  templateName: string;
  countUpto: number;
  nextCount: number;
  eachIncentive: number;
}
export interface TurnoverIncentiveInput {
  orgId: string;
  templateName: string;
  turnoverUpto: number;
  incentivePercent: number;
}
export interface OvertimeIncentiveInput {
  orgId: string;
  templateName: string;
  durationMinutes: number;
  amount: number;
}
export interface BonusIncentiveInput {
  orgId: string;
  templateName: string;
  bonusPercent: number;
  month: string;
  year: number;
}
