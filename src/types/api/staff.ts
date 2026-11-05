import type { DateString, RawRecord, RoleId, TimeString } from './common';

/** Live attendance status of a staff member for the selected day. */
export type StaffLiveStatus =
  | 'working'
  | 'punched_in'
  | 'punched_out'
  | 'absent'
  | 'late_punched_in'
  | 'inactive'
  | 'unknown';

/** Row of a staff list (`/home/*` lists, all-staff, chat/people pickers, shift assignment lists). */
export interface StaffMember {
  userId: string;
  name: string;
  empId: string;
  mobile: string;
  email: string;
  /** Department name ('' when none). */
  department: string;
  /** Branch name ('' when none). */
  branch: string;
  status: StaffLiveStatus;
  /** Server label for `status` as shown in v1 (e.g. "Punched In"). */
  statusLabel: string;
  isActive: boolean;
  roleId?: RoleId;
  roleName?: string;
  photoUrl?: string;
  raw: RawRecord;
}

/** Row of the daily attendance report (`/home/daily-attendance`). */
export interface DailyAttendanceRow extends StaffMember {
  punchIn?: TimeString;
  punchOut?: TimeString;
  /** Total worked hours (only set once punched out). */
  totalHours?: number;
  /** Location of the first punch-in. */
  location?: { latitude: number; longitude: number };
}

/** `/home/staff-detail` (summary card used by the staff directory). */
export interface StaffDetail {
  userId: string;
  name: string;
  empId: string;
  mobile: string;
  email: string;
  department: string;
  branch: string;
  branchAddress: string;
  status: StaffLiveStatus;
  statusLabel: string;
  orgId?: string;
  photoUrl?: string;
  raw: RawRecord;
}

/** Personal / bank / statutory details (`/home/staff-profile`, `/employee/personal-details`). */
export interface StaffProfile {
  userId: string;
  name: string;
  empId: string;
  mobile: string;
  email: string;
  department: string;
  branch: string;
  roleName?: string;
  dob?: DateString;
  doj?: DateString;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  fatherName?: string;
  maritalStatus?: string;
  bankAccountNo?: string;
  ifsc?: string;
  bankName?: string;
  bankBranch?: string;
  aadhaarNo?: string;
  panNo?: string;
  uanNo?: string;
  pfNo?: string;
  esiNo?: string;
  shiftId?: number;
  photoUrl?: string;
  raw: RawRecord;
}

/** Editable staff record (`/addstaff/{id}`); the server does not return the branch / department ids. */
export interface StaffRecord extends StaffProfile {
  isActive: boolean;
  isFieldStaff: boolean;
}

/** Payload for creating / updating a staff member (`/addstaff`). */
export interface StaffInput {
  /** Organisation id (the legacy field name on the wire is `user_id`). */
  orgId: string;
  name: string;
  empId: string;
  mobile: string;
  email: string;
  branchName?: string;
  departmentName?: string;
  /** Reporting manager's user id. */
  managerId?: string;
  isFieldStaff?: boolean;
  shiftId?: number;
  dob?: DateString;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  bankAccountNo?: string;
  ifsc?: string;
  bankName?: string;
  bankBranch?: string;
}

export interface StaffWriteResult {
  userId?: string;
  message: string;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface ManagerOption {
  userId: string;
  name: string;
  empId: string;
}
