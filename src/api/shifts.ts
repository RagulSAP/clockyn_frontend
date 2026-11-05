/** Work shifts and shift <-> staff assignment. */
import { api, isApiError } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult } from '@/types/api/common';
import type { AssignShiftInput, Shift, ShiftInput, ShiftWriteResult } from '@/types/api/shifts';
import type { StaffMember } from '@/types/api/staff';
import { listOf, messageOf, optNum, rec } from './mappers/common';
import { mapShift, mapSingleShift, toShiftBody } from './mappers/shifts';
import { mapStaffMember } from './mappers/staff';
import { seg } from './sharedHelpers';

/** Active shifts of an organisation (times as `HH:mm`). `GET /shift/get_shifts/{orgId}`. */
export async function listShifts(orgId: string): Promise<Shift[]> {
  const body = assertSuccess(await api.get<unknown>(`/shift/get_shifts/${seg(orgId)}`), 'Failed to load shifts');
  return listOf(body, ['data', 'shifts']).map(mapShift);
}

/**
 * One shift. `GET /shift/get_shift/{shiftId}`. When `orgId` is given and the single-shift call fails with
 * an HTTP error, falls back to finding the shift in the organisation list (v1 behaviour); resolves
 * `undefined` if it is not there.
 */
export async function getShift(shiftId: number, orgId?: string): Promise<Shift | undefined> {
  try {
    const body = assertSuccess(await api.get<unknown>(`/shift/get_shift/${seg(shiftId)}`), 'Failed to load shift');
    return mapSingleShift(body);
  } catch (e) {
    if (orgId && isApiError(e) && !e.isNetwork) {
      const all = await listShifts(orgId);
      return all.find((s) => s.id === shiftId);
    }
    throw e;
  }
}

/** Creates a shift (times are sent as `hh:mmAM/PM`). `POST /shift/create`. */
export async function createShift(input: ShiftInput): Promise<ShiftWriteResult> {
  const body = assertSuccess(await api.post<unknown>('/shift/create', toShiftBody(input)), 'Failed to create shift');
  return { shiftId: optNum(rec(body).shift_id), message: messageOf(body, 'Shift created successfully') };
}

/** Updates a shift. `PUT /shift/update/{shiftId}`. */
export async function updateShift(shiftId: number, input: ShiftInput): Promise<ShiftWriteResult> {
  const body = assertSuccess(await api.put<unknown>(`/shift/update/${seg(shiftId)}`, toShiftBody(input)), 'Failed to update shift');
  return { shiftId, message: messageOf(body, 'Shift updated successfully') };
}

/** Deletes a shift. `DELETE /shift/delete/{shiftId}?org_id=`. */
export async function deleteShift(shiftId: number, orgId: string): Promise<ActionResult> {
  const body = assertSuccess(await api.delete<unknown>(`/shift/delete/${seg(shiftId)}`, { org_id: orgId }), 'Failed to delete shift');
  return { message: messageOf(body, 'Shift deleted successfully') };
}

/** Staff currently on a shift. `GET /shift/assigned_staff/{orgId}/{shiftId}` (route unverified on the server). */
export async function getAssignedStaff(orgId: string, shiftId: number): Promise<StaffMember[]> {
  const body = assertSuccess(await api.get<unknown>(`/shift/assigned_staff/${seg(orgId)}/${seg(shiftId)}`), 'Failed to load assigned staff');
  return listOf(body).map(mapStaffMember);
}

/** Staff not on a shift. `GET /shift/unassigned_staff/{orgId}/{shiftId}` (route unverified on the server). */
export async function getUnassignedStaff(orgId: string, shiftId: number): Promise<StaffMember[]> {
  const body = assertSuccess(await api.get<unknown>(`/shift/unassigned_staff/${seg(orgId)}/${seg(shiftId)}`), 'Failed to load unassigned staff');
  return listOf(body).map(mapStaffMember);
}

/** Assigns staff to a shift. `POST /shift/assign_staff` (route unverified on the server). */
export async function assignStaff(input: AssignShiftInput): Promise<ActionResult> {
  const body = assertSuccess(
    await api.post<unknown>('/shift/assign_staff', { org_id: input.orgId, user_ids: input.userIds, shift_id: input.shiftId }),
    'Failed to assign staff',
  );
  return { message: messageOf(body, 'Staff assigned successfully') };
}

/** Removes one staff member from a shift. `DELETE /shift/unassign_staff/{orgId}/{userId}/{shiftId}` (route unverified on the server). */
export async function unassignStaff(orgId: string, userId: string, shiftId: number): Promise<ActionResult> {
  const body = assertSuccess(
    await api.delete<unknown>(`/shift/unassign_staff/${seg(orgId)}/${seg(userId)}/${seg(shiftId)}`),
    'Failed to unassign staff',
  );
  return { message: messageOf(body, 'Staff unassigned successfully') };
}
