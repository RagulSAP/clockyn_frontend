/**
 * Salary reports API: org-wide salary breakdown (`/api/salary/staff-breakdown`), monthly paid list
 * (`/salary/monthly-list`, `/salary/mark-paid`), advances (`/api/advance*`) and working days
 * (`/api/holidays/working-days`).
 *
 * Decisions
 *  - Holiday CRUD and weekly offs live in `system.ts`; only the read-only working-days figure used by the
 *    reports lives here.
 *  - `/salary/monthly-list` and `/salary/mark-paid` are not routed in the backend repo snapshot (v1 contract is
 *    followed; the paid list is now actually used to hydrate state, which v1 never did).
 *  - The salary breakdown is plan-gated (`salary_structure`): a block surfaces as `ApiError` status 403 with the
 *    server message (v1 lost it).
 *  - Fix (FIX_POLICY B10): advance amounts must be positive numbers; the advance date defaults to the IST date.
 */
import { api } from '@/lib/api/client';
import { todayIST } from '@/lib/datetime';
import type {
  Advance,
  CreateAdvanceInput,
  MarkSalaryPaidInput,
  MonthlySalaryEntry,
  StaffSalaryBreakdown,
  WorkingDays,
  WorkingDaysFilter,
} from '@/types/api/salaryReports';
import { bool, dateOnly, listOf, num, optNum, optStr, rec, str } from './mappers/common';
import { buildQuery, cleanQuery, ensureSuccess, requireId, seg, successBody } from './sharedHelpers';

/** Maps one wire row of the salary breakdown. */
export function mapSalaryBreakdown(input: unknown): StaffSalaryBreakdown {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    roleName: str(r.role_name),
    branchName: str(r.branch_name),
    salaryType: str(r.salary_type),
    basicSalary: num(r.basic_salary),
    incentive: num(r.incentive),
    incentiveCount: num(r.incentive_count),
    incentiveTurnover: num(r.incentive_turnover),
    overtime: num(r.overtime),
    bonus: num(r.bonus),
    fine: num(r.fine),
    travelAllowance: num(r.travel_allowance),
    odometer: num(r.odometer),
    travelTicket: num(r.travel_ticket),
    advance: num(r.advance),
    otherBills: num(r.other_bills),
    dailyWages: num(r.daily_wages),
    hourlyCalc: num(r.hourly_calc),
    netSalary: num(r.net_salary),
    photoUrl: optStr(r.profile_photo_url) ?? null,
  };
}

/** Maps one wire row of the monthly salary list. */
export function mapMonthlySalaryEntry(input: unknown): MonthlySalaryEntry {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    deptName: str(r.dept_name),
    branchName: str(r.branch_name),
    salaryType: str(r.salary_type),
    basicSalary: num(r.basic_salary),
    netSalary: num(r.net_salary),
    paid: bool(r.paid),
    paidDate: dateOnly(r.paid_date) ?? null,
  };
}

/** Maps one wire advance row. */
export function mapAdvance(input: unknown): Advance {
  const r = rec(input);
  return {
    id: str(r.id ?? r.advance_id),
    userId: str(r.user_id),
    employeeName: str(r.employee_name),
    empId: str(r.emp_id),
    amount: num(r.advance_amt),
    date: dateOnly(r.date) ?? '',
    createdBy: str(r.created_by),
    raw: r,
  };
}

/** Sum of advance amounts. */
export function totalAdvances(list: readonly Advance[]): number {
  return list.reduce((total, a) => total + a.amount, 0);
}

/** Splits a monthly list into paid / unpaid user ids (the bulk "pay all unpaid" action). */
export function unpaidUserIds(list: readonly MonthlySalaryEntry[]): string[] {
  return list.filter((e) => !e.paid).map((e) => e.userId);
}

/** `GET /api/salary/staff-breakdown?org_id&month&year` — salary components for every active staff member (plan-gated). */
export async function getStaffSalaryBreakdown(orgId: string, month: number, year: number): Promise<StaffSalaryBreakdown[]> {
  const body = await api.get<unknown>('/api/salary/staff-breakdown', cleanQuery({ org_id: requireId(orgId, 'orgId'), month, year }));
  ensureSuccess(body, 'Failed to load salary breakdown');
  return listOf(body).map(mapSalaryBreakdown);
}

/** `GET /salary/monthly-list?org_id&month&year` — staff with their paid state for a month. */
export async function listMonthlySalary(orgId: string, month: number, year: number): Promise<MonthlySalaryEntry[]> {
  const body = await api.get<unknown>('/salary/monthly-list', cleanQuery({ org_id: requireId(orgId, 'orgId'), month, year }));
  ensureSuccess(body, 'Failed to load salary list');
  return listOf(body).map(mapMonthlySalaryEntry);
}

/** `POST /salary/mark-paid` `{org_id, user_ids, month, year}` — marks salaries paid for a month. */
export async function markSalaryPaid(input: MarkSalaryPaidInput): Promise<void> {
  if (input.userIds.length === 0) throw new Error('Select at least one employee');
  const body = await api.post<unknown>('/salary/mark-paid', {
    org_id: input.orgId,
    user_ids: input.userIds,
    month: input.month,
    year: input.year,
  });
  ensureSuccess(body, 'Failed to process payment');
}

/** `GET /api/advance/user/{userId}/{orgId}` — advances paid to one staff member. */
export async function listUserAdvances(userId: string, orgId: string): Promise<Advance[]> {
  const body = await api.get<unknown>(`/api/advance/user/${seg(requireId(userId, 'userId'))}/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load advances');
  return listOf(body).map(mapAdvance);
}

/** `GET /api/advance/org/{orgId}` — every advance of the organisation with employee names. */
export async function listOrgAdvances(orgId: string): Promise<Advance[]> {
  const body = await api.get<unknown>(`/api/advance/org/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load advances');
  return listOf(body).map(mapAdvance);
}

/** `POST /api/advance` `{org_id, user_id, created_by, advance_amt, date}` — records an advance (admin only, amount > 0). */
export async function createAdvance(input: CreateAdvanceInput): Promise<Advance> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Enter a valid advance amount greater than 0');
  const body = await api.post<unknown>('/api/advance', {
    org_id: input.orgId,
    user_id: input.userId,
    created_by: input.createdBy,
    advance_amt: input.amount,
    date: input.date ?? todayIST(),
  });
  const r = successBody(body, 'Failed to record advance');
  return mapAdvance(r.data ?? r);
}

/** `DELETE /api/advance/{advanceId}/{orgId}` — removes an advance record. */
export async function deleteAdvance(advanceId: string, orgId: string): Promise<void> {
  const body = await api.delete<unknown>(`/api/advance/${seg(requireId(advanceId, 'advanceId'))}/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to delete advance');
}

/** `GET /api/holidays/working-days/{orgId}?year&month[&branch_name][&dept_name]` — working days of a month (off days and holidays excluded). */
export async function getWorkingDays(orgId: string, year: number, month: number, filter: WorkingDaysFilter = {}): Promise<WorkingDays> {
  const query = buildQuery({ year, month, branch_name: filter.branchName ?? undefined, dept_name: filter.deptName ?? undefined });
  const body = await api.get<unknown>(`/api/holidays/working-days/${seg(requireId(orgId, 'orgId'))}${query}`);
  const r = successBody(body, 'Failed to load working days');
  const workingDays = optNum(r.working_days);
  if (workingDays === undefined) throw new Error('Working days are not available');
  return {
    totalDays: num(r.total_days),
    offDays: num(r.off_days),
    holidays: num(r.holidays),
    workingDays,
  };
}
