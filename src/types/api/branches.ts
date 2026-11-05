import type { RawRecord } from './common';

/** Company branch with its punch geofence. `id` is always a string (the server mixes numbers and strings). */
export interface Branch {
  id: string;
  name: string;
  address: string;
  orgId: string;
  /** Geofence centre; 0 when the branch has no GPS configured. */
  latitude: number;
  longitude: number;
  /** Allowed punch radius in metres (server default 100). */
  radius: number;
  raw: RawRecord;
}

export interface BranchInput {
  orgId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

/** Staff member listed under a branch (reassign-before-delete flow). */
export interface BranchStaffMember {
  userId: string;
  name: string;
  empId: string;
  mobile: string;
  email: string;
  department: string;
  branchId: string;
  branchName: string;
}

export interface BranchWriteResult {
  branchId: string;
  branchName: string;
  message: string;
}

export interface ReassignStaffResult {
  reassignedCount: number;
  branchDeleted: boolean;
  message: string;
}
