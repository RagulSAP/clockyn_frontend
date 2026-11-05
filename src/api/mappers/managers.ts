import type {
  AssignManagerInput,
  ManagedStaff,
  Manager,
  ManagerAssignment,
  ManagerCandidate,
  ManagerPermissions,
} from '@/types/api/managers';
import { arr, bool, isRecord, num, optStr, rec, str } from './common';

export function mapManagerAssignment(input: unknown): ManagerAssignment {
  const r = rec(input);
  const deptId = optStr(r.dept_id);
  return {
    branchId: str(r.branch_id),
    branchName: str(r.branch_name),
    deptId: deptId ?? null,
    deptName: str(r.dept_name),
  };
}

export function mapManager(input: unknown): Manager {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    assignments: arr(r.assignments).map(mapManagerAssignment),
    raw: r,
  };
}

export function mapManagerCandidate(input: unknown): ManagerCandidate {
  const r = rec(input);
  return { userId: str(r.user_id), name: str(r.name), empId: str(r.emp_id) };
}

export function mapManagedStaff(input: unknown): ManagedStaff {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    branch: str(r.branch_name),
    department: str(r.dept_name),
  };
}

/** `{permissions: {name: bool}}` -> map of booleans. Non-boolean values are coerced. */
export function mapPermissions(body: unknown): ManagerPermissions {
  const p = rec(body).permissions;
  const out: ManagerPermissions = {};
  if (isRecord(p)) {
    for (const [k, v] of Object.entries(p)) out[k] = bool(v);
  }
  return out;
}

/** Body of `POST /managers/assign`; branch ids are numeric on the wire. */
export function toAssignBody(input: AssignManagerInput): Record<string, unknown> {
  return {
    user_id: input.userId,
    assignments: input.assignments.map((a) => {
      const entry: Record<string, unknown> = { branch_id: num(a.branchId) };
      if (a.deptId) entry.dept_id = a.deptId;
      return entry;
    }),
  };
}
