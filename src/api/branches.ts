/** Company branches and their punch geofence. */
import { api } from '@/lib/api/client';
import type {
  Branch,
  BranchInput,
  BranchStaffMember,
  BranchWriteResult,
  ReassignStaffResult,
} from '@/types/api/branches';
import { bool, listOf, messageOf, num, rec, str } from './mappers/common';
import { mapBranch, mapBranchStaff, toBranchBody } from './mappers/org';
import { seg } from './sharedHelpers';

/** Active branches of an organisation. `GET /home/branches?org_id=` (a manager's own user id returns their scope). */
export async function listBranches(orgId: string): Promise<Branch[]> {
  const body = await api.get<unknown>('/home/branches', { org_id: orgId });
  return listOf(body).map(mapBranch);
}

/** One branch with its geofence (latitude / longitude / radius). `GET /branch/{branchId}`. */
export async function getBranch(branchId: string): Promise<Branch> {
  const body = await api.get<unknown>(`/branch/${seg(branchId)}`);
  return mapBranch(body);
}

function mapWrite(body: unknown, fallback: string): BranchWriteResult {
  const r = rec(body);
  return { branchId: str(r.branch_id), branchName: str(r.branch_name), message: messageOf(r, fallback) };
}

/** Creates a branch. `POST /branch/add`. */
export async function addBranch(input: BranchInput): Promise<BranchWriteResult> {
  const body = await api.post<unknown>('/branch/add', toBranchBody(input));
  return mapWrite(body, 'Branch added successfully');
}

/** Updates a branch. `PUT /branch/update/{branchId}`. */
export async function updateBranch(branchId: string, input: BranchInput): Promise<BranchWriteResult> {
  const body = await api.put<unknown>(`/branch/update/${seg(branchId)}`, toBranchBody(input));
  return mapWrite(body, 'Branch updated successfully');
}

/** Deletes a branch (hard delete; the server refuses while staff are assigned). `POST /branch/delete/{branchId}?org_id=`. */
export async function deleteBranch(branchId: string, orgId: string): Promise<BranchWriteResult> {
  const body = await api.post<unknown>(`/branch/delete/${seg(branchId)}`, undefined, { query: { org_id: orgId } });
  return mapWrite(body, 'Branch deleted successfully');
}

/** Staff (incl. managers) currently in a branch. `GET /branch/staff/{branchId}?org_id=`. */
export async function getBranchStaff(branchId: string, orgId: string): Promise<BranchStaffMember[]> {
  const body = await api.get<unknown>(`/branch/staff/${seg(branchId)}`, { org_id: orgId });
  return listOf(body).map(mapBranchStaff);
}

/**
 * Moves staff to another branch, optionally deleting the emptied branch afterwards.
 * `POST /branch/reassign-staff`.
 */
export async function reassignStaff(input: {
  staffIds: string[];
  newBranchId: string;
  orgId: string;
  /** Branch to delete once it has no staff left. */
  deleteBranchId?: string;
}): Promise<ReassignStaffResult> {
  const payload: Record<string, unknown> = {
    staff_ids: input.staffIds,
    new_branch_id: input.newBranchId,
    org_id: input.orgId,
  };
  if (input.deleteBranchId) payload.delete_branch_id = input.deleteBranchId;
  const body = await api.post<unknown>('/branch/reassign-staff', payload);
  const r = rec(body);
  return {
    reassignedCount: num(r.reassigned_count),
    branchDeleted: bool(r.branch_deleted),
    message: messageOf(r, 'Staff reassigned successfully'),
  };
}
