/** Managers: promotion, branch/department scope, permissions and the staff under a manager. */
import { api } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult } from '@/types/api/common';
import type {
  AssignManagerInput,
  ManagedStaff,
  Manager,
  ManagerCandidate,
  ManagerPermissions,
} from '@/types/api/managers';
import { listOf, messageOf } from './mappers/common';
import {
  mapManagedStaff,
  mapManager,
  mapManagerCandidate,
  mapPermissions,
  toAssignBody,
} from './mappers/managers';
import { seg } from './sharedHelpers';

/** Managers of an organisation with their assignments. `GET /managers/?org_id=` (trailing slash). */
export async function listManagers(orgId: string): Promise<Manager[]> {
  const body = await api.get<unknown>('/managers/', { org_id: orgId });
  return listOf(body).map(mapManager);
}

/**
 * Active role-3 staff that can be promoted. `GET /managers/staff?org_id&branch_id&dept_id`.
 * `branchId` null / empty = all branches (sent as 0); `deptId` empty = all departments (sent as `ALL`).
 */
export async function getPromotableStaff(orgId: string, branchId: string | number | null, deptId: string): Promise<ManagerCandidate[]> {
  const body = await api.get<unknown>('/managers/staff', {
    org_id: orgId,
    branch_id: branchId ? String(branchId) : '0',
    dept_id: deptId || 'ALL',
  });
  return listOf(body).map(mapManagerCandidate);
}

/** Promotes a staff member to manager (replaces previous assignments). `POST /managers/assign`. */
export async function assignManager(input: AssignManagerInput): Promise<ActionResult> {
  const body = assertSuccess(await api.post<unknown>('/managers/assign', toAssignBody(input)), 'Failed to assign manager');
  return { message: messageOf(body, 'Manager assigned successfully') };
}

/** Demotes a manager back to staff. `DELETE /managers/{userId}`. */
export async function removeManager(userId: string): Promise<ActionResult> {
  const body = assertSuccess(await api.delete<unknown>(`/managers/${seg(userId)}`), 'Failed to remove manager');
  return { message: messageOf(body, 'Manager removed successfully') };
}

/** Permission settings of a manager (name -> enabled). `GET /managers/{userId}/permissions`. */
export async function getManagerPermissions(userId: string): Promise<ManagerPermissions> {
  const body = assertSuccess(await api.get<unknown>(`/managers/${seg(userId)}/permissions`), 'Failed to load permissions');
  return mapPermissions(body);
}

/** Saves the full permission map of a manager. `POST /managers/{userId}/permissions`. */
export async function saveManagerPermissions(userId: string, permissions: ManagerPermissions): Promise<ActionResult> {
  const body = assertSuccess(await api.post<unknown>(`/managers/${seg(userId)}/permissions`, { permissions }), 'Failed to save permissions');
  return { message: messageOf(body, 'Permissions saved successfully') };
}

/** Active staff within a manager's branches / departments. `GET /managers/{userId}/staff`. */
export async function getStaffUnderManager(userId: string): Promise<ManagedStaff[]> {
  const body = await api.get<unknown>(`/managers/${seg(userId)}/staff`);
  return listOf(body).map(mapManagedStaff);
}
