/** DTOs for salary reports (`src/api/salaryReports.ts`): breakdown grid, monthly paid list, advances, working days. */
import type { DateString, RawRecord } from './common';

/** One row of the org-wide salary breakdown grid. All amounts are numbers (INR). */
export interface StaffSalaryBreakdown {
  userId: string;
  name: string;
  empId: string;
  roleName: string;
  branchName: string;
  salaryType: string;
  basicSalary: number;
  /** Count + turnover incentive. */
  incentive: number;
  incentiveCount: number;
  incentiveTurnover: number;
  overtime: number;
  bonus: number;
  /** Always 0 on the current backend ("fine/deduction" is not implemented). */
  fine: number;
  travelAllowance: number;
  odometer: number;
  /** Same value as `travelAllowance` on the current backend. */
  travelTicket: number;
  /** Deduction. */
  advance: number;
  otherBills: number;
  dailyWages: number;
  hourlyCalc: number;
  /** Server-computed total; never recompute client-side. */
  netSalary: number;
  photoUrl: string | null;
}

/** Row of the monthly "mark as paid" list. */
export interface MonthlySalaryEntry {
  userId: string;
  name: string;
  empId: string;
  deptName: string;
  branchName: string;
  salaryType: string;
  basicSalary: number;
  netSalary: number;
  paid: boolean;
  paidDate: DateString | null;
}

/** Input of `markSalaryPaid`. */
export interface MarkSalaryPaidInput {
  orgId: string;
  userIds: string[];
  /** 1-12. */
  month: number;
  year: number;
}

/** An advance paid to a staff member. */
export interface Advance {
  id: string;
  userId: string;
  /** Employee display name (org list only). */
  employeeName: string;
  empId: string;
  amount: number;
  date: DateString;
  createdBy: string;
  raw: RawRecord;
}

/** Input of `createAdvance`. */
export interface CreateAdvanceInput {
  orgId: string;
  userId: string;
  /** Admin's user id. */
  createdBy: string;
  amount: number;
  /** Defaults to today (IST). */
  date?: DateString;
}

/** Working-day figures of a month. */
export interface WorkingDays {
  totalDays: number;
  offDays: number;
  holidays: number;
  workingDays: number;
}

/** Filter of `getWorkingDays`. */
export interface WorkingDaysFilter {
  branchName?: string | null;
  deptName?: string | null;
}
