/**
 * Payroll set-up API: salary / payslip templates (`/api/salary/*`), daily-wage and hourly-charge templates
 * (`/api/daily-wages/*`, `/api/hourly-charges/*`) with their shared assignment endpoints (`/api/wages/*`),
 * and the four incentive families (`/api/incentive/{count|turnover|overtime|bonus}`) with assignment.
 *
 * Decisions
 *  - Fix (FIX_POLICY B6): the payslip staff picker is keyed by the server's `staff_id` (v1 read a `user_id` that
 *    the server never returns, so already-assigned staff were not shown as assigned).
 *  - Fix: the assigned payslip of one employee is read with `GET /api/salary/employee/{org}/{staff}` instead of v1's
 *    N+1 loop over every template; "no payslip assigned" resolves to `null`.
 *  - The count / turnover list endpoints already include the detail columns on the repo backend; v1 additionally
 *    fetched `details/{id}` for every row. Here the extra call is made only for rows whose list entry lacks them.
 *  - Positive-amount validation (FIX_POLICY B10) is enforced for wage / hourly rates.
 *  - The orphan `/payslip/template*` family is not ported (dead).
 *  - The `/api/daily-wages`, `/api/hourly-charges`, `/api/wages` routes are not in the backend repo snapshot; the v1
 *    contract is followed and must be confirmed on the deployed service (see docs/changes).
 */
import { api } from '@/lib/api/client';
import type {
  AssignableStaff,
  AssignmentSide,
  BonusIncentive,
  BonusIncentiveInput,
  CountIncentive,
  CountIncentiveInput,
  FilterOption,
  Incentive,
  IncentiveKind,
  OvertimeIncentive,
  OvertimeIncentiveInput,
  PayItem,
  PayslipPreview,
  PayslipStaffFilter,
  PayslipStaffRow,
  PayslipTemplate,
  PayslipTemplateInput,
  PayslipTotals,
  SavedPayslipTemplate,
  TurnoverIncentive,
  TurnoverIncentiveInput,
  WageKind,
  WageTemplate,
} from '@/types/api/payroll';
import { arr, bool, listOf, num, objectOf, optNum, optStr, rec, str } from './mappers/common';
import { ensureSuccess, requireId, seg, successBody, buildQuery } from './sharedHelpers';

/* ------------------------------------------------------------------------------------------------ */
/* Mapping & pure computation                                                                        */
/* ------------------------------------------------------------------------------------------------ */

/** Maps wire `[{name, amount}]` lines to `PayItem[]` (blank names are dropped). */
export function mapPayItems(input: unknown): PayItem[] {
  return arr(input)
    .map((item) => {
      const r = rec(item);
      return { name: str(r.name), amount: num(r.amount) };
    })
    .filter((item) => item.name !== '');
}

/** Maps one wire salary template to a `PayslipTemplate`. */
export function mapPayslipTemplate(input: unknown): PayslipTemplate {
  const r = rec(input);
  const customEarnings = mapPayItems(r.custom_earnings);
  const customDeductions = mapPayItems(r.custom_deductions);
  const basicPay = num(r.basic_pay);
  const hra = num(r.hra);
  const epf = num(r.epf);
  const professionalTax = num(r.professional_tax);
  const healthInsurance = num(r.health_insurance);
  const totals = computePayslipTotals({ basicPay, hra, epf, professionalTax, healthInsurance, customEarnings, customDeductions });
  return {
    id: str(r.pay_slip_id),
    name: str(r.payslip_name),
    basicPay,
    hra,
    epf,
    professionalTax,
    healthInsurance,
    customEarnings,
    customDeductions,
    totalEarnings: num(r.total_earnings, totals.totalEarnings),
    totalDeductions: num(r.total_deductions, totals.totalDeductions),
    netSalary: num(r.net_salary, totals.netSalary),
    assignedCount: num(r.assigned_count),
    createdAt: optStr(r.created_at) ?? null,
    raw: r,
  };
}

/** Server formula: earnings = basic + HRA + custom earnings; deductions = EPF + professional tax + insurance + custom deductions. */
export function computePayslipTotals(
  t: Pick<PayslipTemplateInput, 'basicPay' | 'hra' | 'epf' | 'professionalTax' | 'healthInsurance'> & {
    customEarnings?: PayItem[];
    customDeductions?: PayItem[];
  },
): PayslipTotals {
  const sum = (items: PayItem[] | undefined) => (items ?? []).reduce((total, i) => total + (Number.isFinite(i.amount) ? i.amount : 0), 0);
  const totalEarnings = t.basicPay + t.hra + sum(t.customEarnings);
  const totalDeductions = t.epf + t.professionalTax + t.healthInsurance + sum(t.customDeductions);
  return { totalEarnings, totalDeductions, netSalary: totalEarnings - totalDeductions };
}

/** Builds the JSON body shared by payslip template create and update. */
export function buildPayslipBody(input: PayslipTemplateInput): Record<string, unknown> {
  const items = (list: PayItem[] | undefined) =>
    (list ?? []).filter((i) => i.name.trim() !== '').map((i) => ({ name: i.name.trim(), amount: i.amount }));
  return {
    payslip_name: input.name.trim(),
    org_id: input.orgId,
    basic_pay: input.basicPay,
    hra: input.hra,
    epf: input.epf,
    professional_tax: input.professionalTax,
    health_insurance: input.healthInsurance,
    custom_earnings: items(input.customEarnings),
    custom_deductions: items(input.customDeductions),
  };
}

/** Maps one wire row of the payslip staff picker. */
export function mapPayslipStaffRow(input: unknown): PayslipStaffRow {
  const r = rec(input);
  return {
    staffId: str(r.staff_id ?? r.user_id),
    name: str(r.staff_name ?? r.name),
    empId: str(r.emp_id),
    branchName: str(r.branch_name),
    departmentName: str(r.department_name ?? r.dept_name),
    isAssigned: bool(r.is_assigned),
  };
}

/** Maps the payslip preview payload. */
export function mapPayslipPreview(input: unknown): PayslipPreview {
  const r = objectOf(input);
  return {
    orgName: str(r.org_name),
    payslipName: str(r.payslip_name),
    month: str(r.month),
    year: num(r.year),
    staffName: str(r.staff_name),
    empId: str(r.emp_id),
    department: str(r.department),
    branch: str(r.branch),
    accountNumber: str(r.account_number),
    ifscCode: str(r.ifsc_code),
    earnings: mapPayItems(r.earnings),
    totalEarnings: num(r.total_earnings),
    deductions: mapPayItems(r.deductions),
    totalDeductions: num(r.total_deductions),
    netPay: num(r.net_pay),
  };
}

/** Maps one wire daily-wage / hourly-charge template. */
export function mapWageTemplate(input: unknown): WageTemplate {
  const r = rec(input);
  return {
    id: str(r.id ?? r.temp_id),
    name: optStr(r.template_name ?? r.temp_name) ?? null,
    amount: num(r.amount ?? r.temp_amount),
    assignedCount: num(r.assigned_count),
    raw: r,
  };
}

/** Maps a staff row of an assignment picker (wages and incentives share the shape). */
export function mapAssignableStaff(input: unknown): AssignableStaff {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    branchName: str(r.branch_name),
    deptName: str(r.dept_name ?? r.department_name),
  };
}

/** Maps a `{branch_id|department_id, ...name}` row to a filter option. */
export function mapFilterOption(input: unknown, idKey: string, nameKey: string): FilterOption {
  const r = rec(input);
  return { id: str(r[idKey]), name: str(r[nameKey]) };
}

const incentiveBase = (r: Record<string, unknown>) => ({
  id: str(r.incentive_id),
  name: str(r.template_name),
  assignedCount: num(r.assigned_count),
  createdAt: optStr(r.created_at) ?? null,
  raw: r,
});

/** Maps one wire count-incentive row (list or details). */
export function mapCountIncentive(input: unknown): CountIncentive {
  const r = rec(input);
  return {
    ...incentiveBase(r),
    kind: 'count',
    countUpto: num(r.count_upto_basic_salary ?? r.count_upto),
    nextCount: num(r.next_count),
    eachIncentive: num(r.each_incentive),
  };
}

/** Maps one wire turnover-incentive row (list or details). */
export function mapTurnoverIncentive(input: unknown): TurnoverIncentive {
  const r = rec(input);
  return {
    ...incentiveBase(r),
    kind: 'turnover',
    turnoverUpto: num(r.turnover_upto_basic_salary ?? r.turnover_upto),
    incentivePercent: num(r.after_target_incentive_percent ?? r.incentive_percent),
  };
}

/** Maps one wire overtime-incentive row. */
export function mapOvertimeIncentive(input: unknown): OvertimeIncentive {
  const r = rec(input);
  return { ...incentiveBase(r), kind: 'overtime', durationMinutes: num(r.duration_minutes), amount: num(r.amount) };
}

/** Maps one wire bonus-incentive row. */
export function mapBonusIncentive(input: unknown): BonusIncentive {
  const r = rec(input);
  return {
    ...incentiveBase(r),
    kind: 'bonus',
    bonusPercent: num(r.bonus_percent),
    month: str(r.month),
    year: optNum(r.year) ?? null,
    assignedUserIds: Array.isArray(r.user_ids) ? r.user_ids.map((id) => str(id)).filter((id) => id !== '') : null,
  };
}

/**
 * Next auto-numbered template name: one more than the highest numeric name (`"1"`, `"2"`, ...); `"1"` for none.
 * Non-numeric names are ignored (v1 used the same rule for bonus / overtime / count templates).
 */
export function nextTemplateName(existing: readonly { name: string }[]): string {
  let max = 0;
  for (const t of existing) {
    if (/^\d+$/.test(t.name.trim())) max = Math.max(max, Number(t.name.trim()));
  }
  return String(max + 1);
}

/** Ids of every staff member already assigned to any of the given bonus templates (needs `assignedUserIds`). */
export function collectAssignedUserIds(templates: readonly BonusIncentive[]): Set<string> {
  const out = new Set<string>();
  for (const t of templates) for (const id of t.assignedUserIds ?? []) out.add(id);
  return out;
}

/* ------------------------------------------------------------------------------------------------ */
/* Salary / payslip templates                                                                         */
/* ------------------------------------------------------------------------------------------------ */

/** `GET /api/salary/templates/{orgId}` — payslip templates with totals and assigned counts (plan-gated `salary_structure`). */
export async function listPayslipTemplates(orgId: string): Promise<PayslipTemplate[]> {
  const body = await api.get<unknown>(`/api/salary/templates/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load payslip templates');
  return listOf(body).map(mapPayslipTemplate);
}

/** `GET /api/salary/template/{payslipId}` — one payslip template. */
export async function getPayslipTemplate(payslipId: string): Promise<PayslipTemplate> {
  const body = await api.get<unknown>(`/api/salary/template/${seg(requireId(payslipId, 'payslipId'))}`);
  ensureSuccess(body, 'Failed to load payslip template');
  return mapPayslipTemplate(objectOf(body));
}

/** `POST /api/salary/template` (create) or `PUT /api/salary/template/{payslipId}` (update) — saves a payslip template. */
export async function savePayslipTemplate(input: PayslipTemplateInput, payslipId?: string): Promise<SavedPayslipTemplate> {
  if (input.name.trim() === '') throw new Error('Enter a template name');
  const payload = buildPayslipBody(input);
  const body = payslipId
    ? await api.put<unknown>(`/api/salary/template/${seg(requireId(payslipId, 'payslipId'))}`, payload)
    : await api.post<unknown>('/api/salary/template', payload);
  const r = successBody(body, 'Failed to save template');
  return {
    id: optStr(r.pay_slip_id) ?? payslipId ?? null,
    message: str(r.message),
    templates: arr(r.updated_templates).map(mapPayslipTemplate),
  };
}

/** `DELETE /api/salary/template/{payslipId}` — deletes a payslip template. */
export async function deletePayslipTemplate(payslipId: string): Promise<void> {
  const body = await api.delete<unknown>(`/api/salary/template/${seg(requireId(payslipId, 'payslipId'))}`);
  ensureSuccess(body, 'Failed to delete template');
}

/** `GET /api/salary/branches/{orgId}` — branch filter options of the payslip staff picker. */
export async function listSalaryBranches(orgId: string): Promise<FilterOption[]> {
  const body = await api.get<unknown>(`/api/salary/branches/${seg(requireId(orgId, 'orgId'))}`);
  return listOf(body).map((r) => mapFilterOption(r, 'branch_id', 'branch_name'));
}

/** `GET /api/salary/departments/{orgId}` — department filter options of the payslip staff picker. */
export async function listSalaryDepartments(orgId: string): Promise<FilterOption[]> {
  const body = await api.get<unknown>(`/api/salary/departments/${seg(requireId(orgId, 'orgId'))}`);
  return listOf(body).map((r) => mapFilterOption(r, 'department_id', 'department_name'));
}

/** `GET /api/salary/staff/{orgId}?branch_id&department_id&pay_slip_id` — staff with an "assigned to this template" flag. */
export async function listPayslipStaff(orgId: string, filter: PayslipStaffFilter = {}): Promise<PayslipStaffRow[]> {
  const query = buildQuery({
    branch_id: filter.branchId ?? undefined,
    department_id: filter.departmentId ?? undefined,
    pay_slip_id: filter.payslipId ?? undefined,
  });
  const body = await api.get<unknown>(`/api/salary/staff/${seg(requireId(orgId, 'orgId'))}${query}`);
  ensureSuccess(body, 'Failed to load staff');
  return listOf(body).map(mapPayslipStaffRow);
}

/**
 * `POST /api/salary/assign` — assigns a payslip to ONE staff member. Throws when the staff member already has one
 * (the `ApiError.raw` body then carries `payslip_name` of the existing assignment).
 */
export async function assignPayslip(orgId: string, staffId: string, payslipId: string): Promise<void> {
  const body = await api.post<unknown>('/api/salary/assign', { org_id: orgId, staff_id: staffId, pay_slip_id: payslipId });
  ensureSuccess(body, 'Failed to assign payslip');
}

/** `GET /api/salary/employee/{orgId}/{staffId}` — id of the payslip assigned to the employee, or `null` when none. */
export async function getAssignedPayslipId(orgId: string, staffId: string): Promise<string | null> {
  const body = await api.get<unknown>(`/api/salary/employee/${seg(requireId(orgId, 'orgId'))}/${seg(requireId(staffId, 'staffId'))}`);
  const r = rec(body);
  if (r.success === false) return null;
  return optStr(r.pay_slip_id) ?? null;
}

/** `GET /api/salary/preview/{orgId}/{staffId}/{payslipId}` — payslip preview for the current month. */
export async function getPayslipPreview(orgId: string, staffId: string, payslipId: string): Promise<PayslipPreview> {
  const body = await api.get<unknown>(
    `/api/salary/preview/${seg(requireId(orgId, 'orgId'))}/${seg(requireId(staffId, 'staffId'))}/${seg(requireId(payslipId, 'payslipId'))}`,
  );
  ensureSuccess(body, 'Failed to load payslip preview');
  return mapPayslipPreview(body);
}

/* ------------------------------------------------------------------------------------------------ */
/* Daily wages / hourly charges                                                                       */
/* ------------------------------------------------------------------------------------------------ */

const WAGE_BASE: Record<WageKind, string> = { daily: '/api/daily-wages', hourly: '/api/hourly-charges' };

/** `GET /api/daily-wages/templates/{orgId}` or `GET /api/hourly-charges/templates/{orgId}` — wage templates. */
export async function listWageTemplates(kind: WageKind, orgId: string): Promise<WageTemplate[]> {
  const body = await api.get<unknown>(`${WAGE_BASE[kind]}/templates/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load templates');
  return listOf(body).map(mapWageTemplate);
}

/** `POST {base}/template` (create) or `PUT {base}/template/{id}` (update) with `{org_id, amount}` — saves a wage template. */
export async function saveWageTemplate(kind: WageKind, args: { orgId: string; amount: number; id?: string }): Promise<void> {
  if (!Number.isFinite(args.amount) || args.amount <= 0) throw new Error('Enter a valid amount greater than 0');
  const payload = { org_id: args.orgId, amount: args.amount };
  const body = args.id
    ? await api.put<unknown>(`${WAGE_BASE[kind]}/template/${seg(requireId(args.id, 'id'))}`, payload)
    : await api.post<unknown>(`${WAGE_BASE[kind]}/template`, payload);
  ensureSuccess(body, 'Failed to save template');
}

/** `DELETE {base}/template/{id}` — deletes a wage template. */
export async function deleteWageTemplate(kind: WageKind, id: string): Promise<void> {
  const body = await api.delete<unknown>(`${WAGE_BASE[kind]}/template/${seg(requireId(id, 'id'))}`);
  ensureSuccess(body, 'Failed to delete template');
}

/** `GET /api/wages/{assigned|unassigned}/{orgId}/{templateId}` — staff on / not on a wage template. */
export async function listWageStaff(orgId: string, templateId: string, side: AssignmentSide): Promise<AssignableStaff[]> {
  const body = await api.get<unknown>(`/api/wages/${side}/${seg(requireId(orgId, 'orgId'))}/${seg(requireId(templateId, 'templateId'))}`);
  ensureSuccess(body, 'Failed to load staff');
  return listOf(body).map(mapAssignableStaff);
}

/** `POST /api/wages/assign` `{org_id, user_ids, temp_id}` — assigns staff to a wage template. */
export async function assignWages(orgId: string, userIds: string[], templateId: string): Promise<void> {
  const body = await api.post<unknown>('/api/wages/assign', { org_id: orgId, user_ids: userIds, temp_id: templateId });
  ensureSuccess(body, 'Failed to assign staff');
}

/** `DELETE /api/wages/unassign/{orgId}/{userId}/{templateId}` — removes one staff member from a wage template. */
export async function unassignWages(orgId: string, userId: string, templateId: string): Promise<void> {
  const body = await api.delete<unknown>(
    `/api/wages/unassign/${seg(requireId(orgId, 'orgId'))}/${seg(requireId(userId, 'userId'))}/${seg(requireId(templateId, 'templateId'))}`,
  );
  ensureSuccess(body, 'Failed to unassign');
}

/* ------------------------------------------------------------------------------------------------ */
/* Incentives                                                                                         */
/* ------------------------------------------------------------------------------------------------ */

async function fetchIncentiveRows(kind: IncentiveKind, orgId: string): Promise<Record<string, unknown>[]> {
  const body = await api.get<unknown>(`/api/incentive/${kind}/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load incentives');
  return listOf(body);
}

async function fetchIncentiveDetails(kind: 'count' | 'turnover' | 'overtime' | 'bonus', id: string): Promise<Record<string, unknown>> {
  const body = await api.get<unknown>(`/api/incentive/${kind}/details/${seg(requireId(id, 'id'))}`);
  ensureSuccess(body, 'Failed to load incentive');
  return listOf(body)[0] ?? {};
}

/** `GET /api/incentive/count/{orgId}` — count templates (details are fetched per row only when the list lacks them). */
export async function listCountIncentives(orgId: string): Promise<CountIncentive[]> {
  const rows = await fetchIncentiveRows('count', orgId);
  const merged = await Promise.all(
    rows.map(async (row) => {
      if (row.count_upto_basic_salary !== undefined || row.count_upto !== undefined) return row;
      return { ...row, ...(await fetchIncentiveDetails('count', str(row.incentive_id))) };
    }),
  );
  return merged.map(mapCountIncentive);
}

/** `GET /api/incentive/turnover/{orgId}` — turnover templates (details fetched only when missing from the list). */
export async function listTurnoverIncentives(orgId: string): Promise<TurnoverIncentive[]> {
  const rows = await fetchIncentiveRows('turnover', orgId);
  const merged = await Promise.all(
    rows.map(async (row) => {
      if (row.turnover_upto_basic_salary !== undefined || row.turnover_upto !== undefined) return row;
      return { ...row, ...(await fetchIncentiveDetails('turnover', str(row.incentive_id))) };
    }),
  );
  return merged.map(mapTurnoverIncentive);
}

/** `GET /api/incentive/overtime/{orgId}` — overtime templates. */
export async function listOvertimeIncentives(orgId: string): Promise<OvertimeIncentive[]> {
  return (await fetchIncentiveRows('overtime', orgId)).map(mapOvertimeIncentive);
}

/** `GET /api/incentive/bonus/{orgId}` — bonus templates (with assigned user ids when the server provides them). */
export async function listBonusIncentives(orgId: string): Promise<BonusIncentive[]> {
  return (await fetchIncentiveRows('bonus', orgId)).map(mapBonusIncentive);
}

/** `GET /api/incentive/count/details/{id}` — details of one count template (edit prefill). */
export async function getCountIncentive(id: string): Promise<CountIncentive> {
  return mapCountIncentive({ incentive_id: id, ...(await fetchIncentiveDetails('count', id)) });
}

/** `GET /api/incentive/turnover/details/{id}` — details of one turnover template (edit prefill). */
export async function getTurnoverIncentive(id: string): Promise<TurnoverIncentive> {
  return mapTurnoverIncentive({ incentive_id: id, ...(await fetchIncentiveDetails('turnover', id)) });
}

function createdIncentiveId(body: unknown, fallback: string): string {
  const r = successBody(body, fallback);
  return str(objectOf(r).incentive_id);
}

/** `POST /api/incentive/count` `{org_id, template_name, count_upto, next_count, each_incentive}` — creates a count template. */
export async function createCountIncentive(input: CountIncentiveInput): Promise<{ id: string }> {
  const body = await api.post<unknown>('/api/incentive/count', {
    org_id: input.orgId,
    template_name: input.templateName,
    count_upto: Math.trunc(input.countUpto),
    next_count: Math.trunc(input.nextCount),
    each_incentive: input.eachIncentive,
  });
  return { id: createdIncentiveId(body, 'Failed to save') };
}

/** `PUT /api/incentive/count/{id}` `{count_upto, next_count, each_incentive}` — updates a count template. */
export async function updateCountIncentive(id: string, input: Omit<CountIncentiveInput, 'orgId' | 'templateName'>): Promise<void> {
  const body = await api.put<unknown>(`/api/incentive/count/${seg(requireId(id, 'id'))}`, {
    count_upto: Math.trunc(input.countUpto),
    next_count: Math.trunc(input.nextCount),
    each_incentive: input.eachIncentive,
  });
  ensureSuccess(body, 'Failed to save');
}

/** `POST /api/incentive/turnover` `{org_id, template_name, turnover_upto, incentive_percent}` — creates a turnover template. */
export async function createTurnoverIncentive(input: TurnoverIncentiveInput): Promise<{ id: string }> {
  const body = await api.post<unknown>('/api/incentive/turnover', {
    org_id: input.orgId,
    template_name: input.templateName,
    turnover_upto: input.turnoverUpto,
    incentive_percent: input.incentivePercent,
  });
  return { id: createdIncentiveId(body, 'Failed to save') };
}

/** `PUT /api/incentive/turnover/{id}` (same body as create, as in v1) — updates a turnover template. */
export async function updateTurnoverIncentive(id: string, input: TurnoverIncentiveInput): Promise<void> {
  const body = await api.put<unknown>(`/api/incentive/turnover/${seg(requireId(id, 'id'))}`, {
    org_id: input.orgId,
    template_name: input.templateName,
    turnover_upto: input.turnoverUpto,
    incentive_percent: input.incentivePercent,
  });
  ensureSuccess(body, 'Failed to save');
}

/** `POST /api/incentive/overtime` `{org_id, template_name, duration_minutes, amount}` — creates an overtime template. */
export async function createOvertimeIncentive(input: OvertimeIncentiveInput): Promise<{ id: string }> {
  const body = await api.post<unknown>('/api/incentive/overtime', {
    org_id: input.orgId,
    template_name: input.templateName,
    duration_minutes: Math.trunc(input.durationMinutes),
    amount: input.amount,
  });
  return { id: createdIncentiveId(body, 'Failed to save') };
}

/** `PUT /api/incentive/overtime/{id}` `{duration_minutes, amount}` — updates an overtime template. */
export async function updateOvertimeIncentive(id: string, input: Pick<OvertimeIncentiveInput, 'durationMinutes' | 'amount'>): Promise<void> {
  const body = await api.put<unknown>(`/api/incentive/overtime/${seg(requireId(id, 'id'))}`, {
    duration_minutes: Math.trunc(input.durationMinutes),
    amount: input.amount,
  });
  ensureSuccess(body, 'Failed to save');
}

/** `POST /api/incentive/bonus` `{org_id, template_name, bonus_percent, month, year}` — creates a bonus template. */
export async function createBonusIncentive(input: BonusIncentiveInput): Promise<{ id: string }> {
  const body = await api.post<unknown>('/api/incentive/bonus', {
    org_id: input.orgId,
    template_name: input.templateName,
    bonus_percent: input.bonusPercent,
    month: input.month,
    year: input.year,
  });
  return { id: createdIncentiveId(body, 'Failed to save') };
}

/**
 * `PUT /api/incentive/bonus/{id}` `{bonus_percent[, month, year]}` — updates a bonus template. Without `period` only the
 * percentage is sent (month/year are kept); with it the server also persists the edited month / year.
 */
export async function updateBonusIncentive(id: string, bonusPercent: number, period?: { month: string; year: number }): Promise<void> {
  const payload: Record<string, unknown> = { bonus_percent: bonusPercent };
  if (period) {
    payload.month = period.month;
    payload.year = period.year;
  }
  const body = await api.put<unknown>(`/api/incentive/bonus/${seg(requireId(id, 'id'))}`, payload);
  ensureSuccess(body, 'Failed to save');
}

/** `DELETE /api/incentive/{kind}/{id}` — deletes an incentive template of any kind (also removes its assignments). */
export async function deleteIncentive(kind: IncentiveKind, id: string): Promise<void> {
  const body = await api.delete<unknown>(`/api/incentive/${kind}/${seg(requireId(id, 'id'))}`);
  ensureSuccess(body, 'Failed to delete');
}

/** `GET /api/incentive/{assigned|unassigned}/{orgId}/{incentiveId}` — staff on / not on an incentive template. */
export async function listIncentiveStaff(orgId: string, incentiveId: string, side: AssignmentSide): Promise<AssignableStaff[]> {
  const body = await api.get<unknown>(`/api/incentive/${side}/${seg(requireId(orgId, 'orgId'))}/${seg(requireId(incentiveId, 'incentiveId'))}`);
  ensureSuccess(body, 'Failed to load staff');
  return listOf(body).map(mapAssignableStaff);
}

/** `GET /api/incentive/unassigned-all/{orgId}` — active staff who are not assigned to any incentive of the org. */
export async function listUnassignedIncentiveStaff(orgId: string): Promise<AssignableStaff[]> {
  const body = await api.get<unknown>(`/api/incentive/unassigned-all/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load staff');
  return listOf(body).map(mapAssignableStaff);
}

/**
 * Ids of everyone already on any bonus template ("already assigned elsewhere" warning). Uses `assignedUserIds`
 * from the list; templates lacking it are resolved with one `assigned` call each.
 */
export async function getBonusAssignedUserIds(orgId: string, templates: readonly BonusIncentive[]): Promise<Set<string>> {
  const out = collectAssignedUserIds(templates);
  const missing = templates.filter((t) => t.assignedUserIds === null);
  const lists = await Promise.all(missing.map((t) => listIncentiveStaff(orgId, t.id, 'assigned')));
  for (const list of lists) for (const s of list) out.add(s.userId);
  return out;
}

/** `POST /api/incentive/assign` `{org_id, user_ids, incentive_id}` — assigns staff to an incentive template. */
export async function assignIncentive(orgId: string, userIds: string[], incentiveId: string): Promise<void> {
  const body = await api.post<unknown>('/api/incentive/assign', { org_id: orgId, user_ids: userIds, incentive_id: incentiveId });
  ensureSuccess(body, 'Failed to assign staff');
}

/** `DELETE /api/incentive/unassign/{orgId}/{userId}/{incentiveId}` — removes one staff member from an incentive template. */
export async function unassignIncentive(orgId: string, userId: string, incentiveId: string): Promise<void> {
  const body = await api.delete<unknown>(
    `/api/incentive/unassign/${seg(requireId(orgId, 'orgId'))}/${seg(requireId(userId, 'userId'))}/${seg(requireId(incentiveId, 'incentiveId'))}`,
  );
  ensureSuccess(body, 'Failed to unassign');
}

/** Any incentive list for a kind (convenience for generic screens). */
export async function listIncentives(kind: IncentiveKind, orgId: string): Promise<Incentive[]> {
  switch (kind) {
    case 'count':
      return listCountIncentives(orgId);
    case 'turnover':
      return listTurnoverIncentives(orgId);
    case 'overtime':
      return listOvertimeIncentives(orgId);
    default:
      return listBonusIncentives(orgId);
  }
}
