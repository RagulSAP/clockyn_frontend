/** Staff CRUD, status toggle, employee-id helpers and the form option lists. */
import { api, isApiError } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult } from '@/types/api/common';
import type { Shift } from '@/types/api/shifts';
import type {
  BranchOption,
  DepartmentOption,
  ManagerOption,
  StaffInput,
  StaffRecord,
  StaffWriteResult,
} from '@/types/api/staff';
import { listBranches } from './branches';
import { listDepartments } from './departments';
import { bool, listOf, messageOf, num, optStr, rec, str } from './mappers/common';
import {
  mapBranchOption,
  mapDepartmentOption,
  mapManagerOption,
  mapStaffRecord,
  toStaffBody,
} from './mappers/staff';
import { seg } from './sharedHelpers';
import { listShifts } from './shifts';

/** Gender choices of the staff form. */
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

/** Row of the lightweight staff picker list. */
export interface StaffPickerItem {
  userId: string;
  name: string;
  empId: string;
  branchId: string;
  deptId: string;
  branch: string;
  department: string;
}

/** Creates a staff member (always role 3). `POST /addstaff/`. */
export async function addStaff(input: StaffInput): Promise<StaffWriteResult> {
  const body = assertSuccess(await api.post<unknown>('/addstaff/', toStaffBody(input)), 'Failed to add staff');
  return { userId: optStr(rec(body).user_id), message: messageOf(body, 'Staff added successfully!') };
}

/** Editable staff record (the server does not return branch / department ids). `GET /addstaff/{userId}`. */
export async function getStaff(userId: string): Promise<StaffRecord> {
  const body = await api.get<unknown>(`/addstaff/${seg(userId)}`);
  return mapStaffRecord(body);
}

/** Updates a staff member. `PUT /addstaff/{userId}`. */
export async function updateStaff(userId: string, input: StaffInput): Promise<StaffWriteResult> {
  const body = assertSuccess(await api.put<unknown>(`/addstaff/${seg(userId)}`, toStaffBody(input)), 'Failed to update staff');
  return { userId, message: messageOf(body, 'Staff updated successfully!') };
}

/** Soft-deletes a staff member (status 0). `DELETE /addstaff/{userId}`. */
export async function deleteStaff(userId: string): Promise<ActionResult> {
  const body = assertSuccess(await api.delete<unknown>(`/addstaff/${seg(userId)}`), 'Failed to delete staff member');
  return { message: messageOf(body, 'Staff deleted successfully!') };
}

/**
 * PERMANENTLY deletes an employee / manager and all their data (admin only, irreversible).
 * `DELETE /addstaff/{staffId}/permanent?requested_by_role_id=`.
 */
export async function permanentlyDeleteStaff(staffId: string, requestedByRoleId: number): Promise<ActionResult> {
  const body = assertSuccess(
    await api.delete<unknown>(`/addstaff/${seg(staffId)}/permanent`, { requested_by_role_id: requestedByRoleId }),
    'Failed to delete staff member',
  );
  return { message: messageOf(body, 'Staff member permanently deleted.') };
}

/** Activates / deactivates a staff member. `PUT /addstaff/{userId}/status?status=1|0`. */
export async function setStaffActive(userId: string, active: boolean): Promise<ActionResult> {
  const body = assertSuccess(
    await api.put<unknown>(`/addstaff/${seg(userId)}/status`, undefined, { query: { status: active ? 1 : 0 } }),
    'Failed to update staff status',
  );
  return { message: messageOf(body, active ? 'Staff activated' : 'Staff deactivated') };
}

/** Number of active staff (role 2 and 3) of the organisation, for the staff-limit banner. `GET /addstaff/count/{orgId}`. */
export async function getActiveStaffCount(orgId: string): Promise<number> {
  const body = assertSuccess(await api.get<unknown>(`/addstaff/count/${seg(orgId)}`), 'Failed to load staff count');
  return num(rec(body).count);
}

/** Lightweight active-staff list for pickers (no live status). `GET /addstaff/all-staff/{orgId}`. */
export async function listStaffForPicker(orgId: string, filter: { branchId?: string; deptId?: string } = {}): Promise<StaffPickerItem[]> {
  const body = assertSuccess(
    await api.get<unknown>(`/addstaff/all-staff/${seg(orgId)}`, {
      branch_id: filter.branchId || undefined,
      dept_id: filter.deptId || undefined,
    }),
    'Failed to load staff',
  );
  return listOf(body).map((r) => ({
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    branchId: str(r.branch_id),
    deptId: str(r.dept_id),
    branch: str(r.branch_name),
    department: str(r.dept_name),
  }));
}

/** Branch choices of the staff form. `GET /addstaff/branches`, falling back to `/home/branches` on HTTP errors (v1). */
export async function getBranchOptions(orgId: string, roleId: number): Promise<BranchOption[]> {
  try {
    const body = await api.get<unknown>('/addstaff/branches', { user_id: orgId, role_id: roleId });
    return listOf(body).map(mapBranchOption);
  } catch (e) {
    if (isApiError(e) && !e.isNetwork) {
      return (await listBranches(orgId)).map((b) => ({ id: b.id, name: b.name }));
    }
    throw e;
  }
}

/** Department choices of the staff form. `GET /addstaff/departments`, falling back to `/home/departments` on HTTP errors (v1). */
export async function getDepartmentOptions(orgId: string, roleId: number): Promise<DepartmentOption[]> {
  try {
    const body = await api.get<unknown>('/addstaff/departments', { user_id: orgId, role_id: roleId });
    return listOf(body).map(mapDepartmentOption);
  } catch (e) {
    if (isApiError(e) && !e.isNetwork) {
      return (await listDepartments(orgId)).map((d) => ({ id: d.id, name: d.name }));
    }
    throw e;
  }
}

/** Managers a new staff member can report to. `GET /addstaff/managers/` (trailing slash required). */
export async function getManagerOptions(orgId: string, roleId: number): Promise<ManagerOption[]> {
  const body = await api.get<unknown>('/addstaff/managers/', { user_id: orgId, role_id: roleId });
  return listOf(body).map(mapManagerOption);
}

/** Shift choices of the staff form (same data as the shift list). `GET /shift/get_shifts/{orgId}`. */
export async function getShiftOptions(orgId: string): Promise<Shift[]> {
  return listShifts(orgId);
}

/** Suggested next employee id; falls back to `'1000'` if the lookup fails (v1 behaviour). `GET /addstaff/next-emp-id`. */
export async function getNextEmployeeId(orgId: string, roleId: number): Promise<string> {
  try {
    const body = await api.get<unknown>('/addstaff/next-emp-id', { user_id: orgId, role_id: roleId });
    return optStr(rec(body).next_emp_id) ?? '1000';
  } catch (e) {
    if (isApiError(e)) return '1000';
    throw e;
  }
}

/**
 * Whether an employee id is free. Fails OPEN (returns true) when the lookup fails, like v1: the server
 * still rejects duplicates on save. `GET /addstaff/validate-emp-id`.
 */
export async function isEmployeeIdAvailable(orgId: string, roleId: number, empId: string): Promise<boolean> {
  try {
    const body = await api.get<unknown>('/addstaff/validate-emp-id', { user_id: orgId, role_id: roleId, emp_id: empId });
    return bool(rec(body).is_available);
  } catch (e) {
    if (isApiError(e)) return true;
    throw e;
  }
}
