import type { RawRecord } from './common';

/** One (branch, department) scope assigned to a manager. `deptId` is null for "all departments". */
export interface ManagerAssignment {
  branchId: string;
  branchName: string;
  deptId: string | null;
  deptName: string;
}

export interface Manager {
  userId: string;
  name: string;
  empId: string;
  assignments: ManagerAssignment[];
  raw: RawRecord;
}

/** Staff eligible to be promoted to manager. */
export interface ManagerCandidate {
  userId: string;
  name: string;
  empId: string;
}

/** Staff member reporting to a manager. */
export interface ManagedStaff {
  userId: string;
  name: string;
  empId: string;
  branch: string;
  department: string;
}

/** Permission setting name -> enabled. */
export type ManagerPermissions = Record<string, boolean>;

export interface AssignManagerInput {
  userId: string;
  assignments: { branchId: string | number; deptId?: string | null }[];
}
