/**
 * System-level API: app version check, feature suggestions, account-deletion request, holidays and weekly
 * offs, and the late-arrival attendance rule.
 *
 * Ownership decisions (per the endpoint catalogue)
 *  - Holiday CRUD + weekly offs (`/api/holidays*`) are here; the read-only working-days figure used by reports is
 *    `getWorkingDays` in `salaryReports.ts`.
 *  - `/company/suggest-feature` and `/company/request-deletion/{id}` are here; the other `/company/*` routes
 *    (details, list, add, update, logo, delete-account) belong to `company.ts`.
 *  - `/version/check` is here; the store-lookup fallbacks (iTunes / Play) are native update logic in `@/lib/platform`.
 *  - `/api/attendance-rule/{org}` is not routed in the backend repo snapshot (v1 contract followed).
 *  - Fix (FIX_POLICY B1/B2): holiday dates are plain IST `YYYY-MM-DD`; multi-date adds report per-date failures
 *    instead of silently swallowing them.
 */
import { api } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/errors';
import { pythonWeekday } from '@/lib/datetime';
import type {
  AddHolidaysResult,
  AttendanceRule,
  AttendanceRuleConsider,
  DeletionRequestResult,
  FeatureSuggestionInput,
  Holiday,
  HolidayInput,
  HolidayPatch,
  PyWeekday,
  VersionCheck,
} from '@/types/api/system';
import { bool, dateOnly, listOf, num, objectOf, optStr, rec, str } from './mappers/common';
import { dateParam } from './params';
import { cleanQuery, ensureSuccess, requireId, seg, serverMessage, successBody } from './sharedHelpers';

export const DEFAULT_WEEKLY_OFFS: readonly PyWeekday[] = [6];
export const DEFAULT_ATTENDANCE_RULE: AttendanceRule = { latePunchInCount: 3, considerAs: 'Half Day' };

/** Maps the `version/check` payload. */
export function mapVersionCheck(input: unknown): VersionCheck {
  const d = objectOf(input);
  return {
    updateRequired: bool(d.update_required),
    latestVersion: optStr(d.latest_version) ?? null,
    forceUpdate: bool(d.force_update),
    message: optStr(d.message) ?? null,
    storeUrl: optStr(d.store_url) ?? null,
  };
}

/** Maps one wire holiday row. */
export function mapHoliday(input: unknown): Holiday {
  const r = rec(input);
  return {
    id: num(r.id),
    name: str(r.name),
    date: dateOnly(r.date) ?? '',
    branchName: optStr(r.branch_name) ?? null,
    deptName: optStr(r.dept_name) ?? null,
    // Only an explicit false / 0 means "punching allowed"; a missing or null column counts as blocking (v1 rule).
    blockAttendance: r.block_attendance === undefined || r.block_attendance === null ? true : bool(r.block_attendance),
  };
}

/** Python weekdays (0 = Monday … 6 = Sunday), validated, de-duplicated and sorted. */
export function normaliseWeeklyOffs(days: readonly unknown[]): PyWeekday[] {
  const set = new Set<number>();
  for (const d of days) {
    const n = typeof d === 'string' ? Number(d) : d;
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b) as PyWeekday[];
}

/** True when `date` (`YYYY-MM-DD`) falls on one of the weekly off days. */
export function isWeeklyOff(date: string, offDays: readonly number[]): boolean {
  const w = pythonWeekday(date);
  return w >= 0 && offDays.includes(w);
}

/** Maps the attendance-rule payload, applying the v1 defaults (3 / `Half Day`). */
export function mapAttendanceRule(input: unknown): AttendanceRule {
  const d = objectOf(input);
  const count = Number(d.late_punch_in_count);
  const consider = str(d.consider_as);
  return {
    latePunchInCount: Number.isInteger(count) && count > 0 ? count : DEFAULT_ATTENDANCE_RULE.latePunchInCount,
    considerAs: consider === 'Leave' ? 'Leave' : 'Half Day',
  };
}

/**
 * `GET /version/check?platform&version&app_id` — whether a newer app version exists and whether the update is forced.
 * `appId` (the native bundle / package id) selects this app's version rows; an older server ignores it.
 */
export async function checkAppVersion(platform: 'ios' | 'android' | string, version: string, appId?: string): Promise<VersionCheck> {
  const body = await api.get<unknown>('/version/check', cleanQuery({ platform, version, app_id: appId }));
  ensureSuccess(body, 'Failed to check for updates');
  return mapVersionCheck(body);
}

/** `POST /company/suggest-feature` `{org_id, subject, content, company_name, user_email}` — sends a feature suggestion. */
export async function submitFeatureSuggestion(input: FeatureSuggestionInput): Promise<void> {
  const subject = input.subject.trim();
  const content = input.content.trim();
  if (subject === '') throw new Error('Enter a subject');
  if (content === '') throw new Error('Enter your suggestion');
  const body = await api.post<unknown>('/company/suggest-feature', {
    org_id: input.orgId,
    subject,
    content,
    company_name: input.companyName,
    user_email: input.userEmail,
  });
  ensureSuccess(body, 'Failed to send suggestion');
}

/** `POST /company/request-deletion/{userId}` — asks the support team to delete the account (idempotent). */
export async function requestAccountDeletion(userId: string): Promise<DeletionRequestResult> {
  const body = await api.post<unknown>(`/company/request-deletion/${seg(requireId(userId, 'userId'))}`);
  const r = successBody(body, 'Failed to submit deletion request');
  return { message: serverMessage(r, 'Account deletion request submitted.') };
}

/** `GET /api/holidays/{orgId}?year&month` — holidays of a month (month 1-12). */
export async function listHolidays(orgId: string, year: number, month: number): Promise<Holiday[]> {
  const body = await api.get<unknown>(`/api/holidays/${seg(requireId(orgId, 'orgId'))}`, { year, month });
  ensureSuccess(body, 'Failed to load holidays');
  return listOf(body).map(mapHoliday);
}

/** `POST /api/holidays/{orgId}` `{name, date, branch_name, dept_name, block_attendance}` — adds one holiday; returns its id. */
export async function addHoliday(orgId: string, input: HolidayInput): Promise<{ id: number }> {
  const name = input.name.trim();
  if (name === '') throw new Error('Enter a holiday name');
  const date = dateParam(input.date);
  if (!date) throw new Error('Select a date');
  const body = await api.post<unknown>(`/api/holidays/${seg(requireId(orgId, 'orgId'))}`, {
    name,
    date,
    branch_name: input.branchName ? input.branchName : null,
    dept_name: input.deptName ? input.deptName : null,
    block_attendance: input.blockAttendance ?? true,
  });
  const r = successBody(body, 'Failed to add holiday');
  return { id: num(r.id) };
}

/** Adds the same holiday on several dates (one request per date); never throws for partial failures. */
export async function addHolidayDates(
  orgId: string,
  base: Omit<HolidayInput, 'date'>,
  dates: readonly string[],
): Promise<AddHolidaysResult> {
  const settled = await Promise.allSettled(dates.map((date) => addHoliday(orgId, { ...base, date })));
  const failed: AddHolidaysResult['failed'] = [];
  settled.forEach((result, i) => {
    if (result.status === 'rejected') failed.push({ date: dates[i], message: getErrorMessage(result.reason, 'Failed to add holiday') });
  });
  return { added: dates.length - failed.length, failed };
}

/** `PUT /api/holidays/{orgId}/{holidayId}` `{name, block_attendance}` — renames a holiday / toggles attendance blocking. */
export async function updateHoliday(orgId: string, holidayId: number, patch: HolidayPatch): Promise<void> {
  const body = await api.put<unknown>(`/api/holidays/${seg(requireId(orgId, 'orgId'))}/${seg(holidayId)}`, {
    name: patch.name.trim(),
    ...(patch.blockAttendance !== undefined ? { block_attendance: patch.blockAttendance } : {}),
    ...(patch.date ? { date: dateParam(patch.date) } : {}),
  });
  ensureSuccess(body, 'Failed to update holiday');
}

/** `DELETE /api/holidays/{orgId}/{holidayId}` — removes a holiday. */
export async function deleteHoliday(orgId: string, holidayId: number): Promise<void> {
  const body = await api.delete<unknown>(`/api/holidays/${seg(requireId(orgId, 'orgId'))}/${seg(holidayId)}`);
  ensureSuccess(body, 'Failed to delete holiday');
}

/** `GET /api/holidays/off-days/{orgId}` — weekly off days (Monday = 0 … Sunday = 6); defaults to `[6]` when unset. */
export async function getWeeklyOffs(orgId: string): Promise<PyWeekday[]> {
  const body = await api.get<unknown>(`/api/holidays/off-days/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load weekly offs');
  const days = rec(body).off_days;
  return Array.isArray(days) ? normaliseWeeklyOffs(days) : [...DEFAULT_WEEKLY_OFFS];
}

/** `POST /api/holidays/off-days/{orgId}` `{off_days}` — saves the weekly off days. */
export async function setWeeklyOffs(orgId: string, days: readonly number[]): Promise<void> {
  const body = await api.post<unknown>(`/api/holidays/off-days/${seg(requireId(orgId, 'orgId'))}`, { off_days: normaliseWeeklyOffs(days) });
  ensureSuccess(body, 'Failed to save weekly offs');
}

/** `GET /api/attendance-rule/{orgId}` — the late-arrival rule (defaults 3 / `Half Day` when none is saved). */
export async function getAttendanceRule(orgId: string): Promise<AttendanceRule> {
  const body = await api.get<unknown>(`/api/attendance-rule/${seg(requireId(orgId, 'orgId'))}`);
  const r = rec(body);
  if (r.success === false) return { ...DEFAULT_ATTENDANCE_RULE };
  return mapAttendanceRule(body);
}

/** `POST /api/attendance-rule/{orgId}` `{late_punch_in_count, consider_as}` — saves the late-arrival rule. */
export async function saveAttendanceRule(orgId: string, rule: { latePunchInCount: number; considerAs: AttendanceRuleConsider }): Promise<void> {
  if (!Number.isInteger(rule.latePunchInCount) || rule.latePunchInCount < 1) throw new Error('Enter a valid late punch-in count');
  const body = await api.post<unknown>(`/api/attendance-rule/${seg(requireId(orgId, 'orgId'))}`, {
    late_punch_in_count: rule.latePunchInCount,
    consider_as: rule.considerAs,
  });
  ensureSuccess(body, 'Failed to save rule');
}
