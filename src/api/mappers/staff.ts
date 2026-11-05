import type {
  BranchOption,
  DailyAttendanceRow,
  DepartmentOption,
  ManagerOption,
  StaffDetail,
  StaffInput,
  StaffLiveStatus,
  StaffMember,
  StaffProfile,
  StaffRecord,
} from '@/types/api/staff';
import { bool, dateOnly, hours, num, optNum, optStr, parseLatLng, pick, rec, roleId, str, toHHmm } from './common';

/** Maps the server's live-status label ("Punched In", "Late Punched-In", ...) to a stable key. */
export function mapLiveStatus(label: unknown): StaffLiveStatus {
  const s = str(label).toLowerCase().replace(/[\s_-]+/g, ' ');
  switch (s) {
    case 'working':
      return 'working';
    case 'punched in':
      return 'punched_in';
    case 'punched out':
      return 'punched_out';
    case 'absent':
      return 'absent';
    case 'late punched in':
      return 'late_punched_in';
    case 'inactive':
      return 'inactive';
    default:
      return 'unknown';
  }
}

/** Row of any staff list. Accepts the legacy `dept_name` / `department` / `branch_name` variants. */
export function mapStaffMember(input: unknown): StaffMember {
  const r = rec(input);
  const statusLabel = str(r.status);
  // `is_active` is only present on the full lists; when absent infer from the status label.
  const status = mapLiveStatus(statusLabel);
  const isActive = r.is_active !== undefined && r.is_active !== null ? bool(r.is_active) : status !== 'inactive';
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    mobile: str(r.mobile_number),
    email: str(r.email),
    department: str(pick(r, 'dept_name', 'department', 'department_name')),
    branch: str(pick(r, 'branch_name', 'branch')),
    status,
    statusLabel,
    isActive,
    roleId: roleId(r.role_id),
    roleName: optStr(r.role_name),
    photoUrl: optStr(r.profile_photo_url),
    raw: r,
  };
}

/** Row of the daily attendance report: staff row + punch times (24h) + hours + first punch-in location. */
export function mapDailyAttendanceRow(input: unknown): DailyAttendanceRow {
  const r = rec(input);
  return {
    ...mapStaffMember(r),
    punchIn: toHHmm(r.punch_in),
    punchOut: toHHmm(r.punch_out),
    totalHours: hours(r.total_hours),
    location: parseLatLng(r.location),
  };
}

export function mapStaffDetail(input: unknown): StaffDetail {
  const r = rec(input);
  const statusLabel = str(r.status);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    mobile: str(r.mobile_number),
    email: str(r.email),
    department: str(r.dept_name),
    branch: str(r.branch_name),
    branchAddress: str(r.branch_address),
    status: mapLiveStatus(statusLabel),
    statusLabel,
    orgId: optStr(r.org_id),
    photoUrl: optStr(r.profile_photo_url),
    raw: r,
  };
}

/** Personal details; used for `/home/staff-profile`, `/employee/personal-details` and `/addstaff/{id}`. */
export function mapStaffProfile(input: unknown): StaffProfile {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    mobile: str(r.mobile_number),
    email: str(r.email),
    department: str(r.dept_name),
    branch: str(r.branch_name),
    roleName: optStr(r.role_name),
    dob: dateOnly(r.dob),
    doj: dateOnly(r.doj),
    gender: optStr(r.gender),
    bloodGroup: optStr(r.blood_group),
    address: optStr(r.address),
    emergencyContact: optStr(r.emergency_contact_no),
    fatherName: optStr(r.father_name),
    maritalStatus: optStr(r.marital_status),
    bankAccountNo: optStr(r.acc_no),
    ifsc: optStr(r.ifsc_code),
    bankName: optStr(r.bank_name),
    bankBranch: optStr(r.bank_branch),
    aadhaarNo: optStr(r.aadhaar_no),
    panNo: optStr(r.pan_no),
    uanNo: optStr(r.uan_no),
    pfNo: optStr(r.pf_no),
    esiNo: optStr(r.esi_no),
    shiftId: optNum(r.shift_id),
    photoUrl: optStr(r.profile_photo_url),
    raw: r,
  };
}

/** `/addstaff/{id}`: profile + `status` (1 active / 0 inactive) + `is_field_staff` (0|1). */
export function mapStaffRecord(input: unknown): StaffRecord {
  const r = rec(input);
  return {
    ...mapStaffProfile(r),
    isActive: num(r.status, 1) === 1,
    isFieldStaff: bool(r.is_field_staff),
  };
}

/** Builds the `/addstaff` POST/PUT body from the camelCase input (legacy field names preserved). */
export function toStaffBody(input: StaffInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    emp_id: input.empId.trim(),
    mobile_number: input.mobile.trim(),
    email: input.email.trim(),
    user_id: input.orgId,
    // v1 sends 0 when no shift is selected.
    shift_id: input.shiftId ?? 0,
    is_field_staff: input.isFieldStaff ? 1 : 0,
  };
  const optional: Record<string, string | undefined> = {
    branch_name: input.branchName,
    dept_name: input.departmentName,
    parent_id: input.managerId,
    gender: input.gender,
    dob: input.dob,
    address: input.address,
    emergency_contact_no: input.emergencyContact,
    blood_group: input.bloodGroup,
    bank_name: input.bankName,
    bank_branch: input.bankBranch,
    acc_no: input.bankAccountNo,
    ifsc_code: input.ifsc,
  };
  for (const [k, v] of Object.entries(optional)) {
    if (v !== undefined && v !== '') body[k] = v;
  }
  return body;
}

export function mapBranchOption(input: unknown): BranchOption {
  const r = rec(input);
  return { id: str(r.branch_id), name: str(r.branch_name) };
}

export function mapDepartmentOption(input: unknown): DepartmentOption {
  const r = rec(input);
  return { id: str(r.dept_id), name: str(r.dept_name) };
}

export function mapManagerOption(input: unknown): ManagerOption {
  const r = rec(input);
  return { userId: str(r.user_id), name: str(r.name), empId: str(r.emp_id) };
}
