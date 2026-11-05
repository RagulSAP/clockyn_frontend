/** Pure logic of the add / edit staff form: values, validation, dirty check, payload mapping, staff-limit banner. */
import { isValidEmail } from '@/lib/format';
import type { StaffInput, StaffRecord } from '@/types/api/staff';

export interface StaffFormValues {
  name: string;
  empId: string;
  phone: string;
  email: string;
  /** Sent to the server by NAME (v1 contract). */
  branchName: string;
  deptName: string;
  gender: string;
  /** 0 = no shift. */
  shiftId: number;
  isFieldStaff: boolean;
  dob: string;
  address: string;
  emergencyContact: string;
  bloodGroup: string;
  bankName: string;
  bankBranch: string;
  accNo: string;
  ifsc: string;
}

export const EMPTY_STAFF_FORM: StaffFormValues = {
  name: '',
  empId: '',
  phone: '',
  email: '',
  branchName: '',
  deptName: '',
  gender: '',
  shiftId: 0,
  isFieldStaff: false,
  dob: '',
  address: '',
  emergencyContact: '',
  bloodGroup: '',
  bankName: '',
  bankBranch: '',
  accNo: '',
  ifsc: '',
};

export type StaffRequiredField = 'name' | 'empId' | 'phone' | 'branchName' | 'deptName' | 'gender';
export type StaffFormErrors = Partial<Record<StaffRequiredField | 'email', string>>;

/** Evaluation order and verbatim messages of the v1 form. */
export const STAFF_REQUIRED: readonly { field: StaffRequiredField; message: string }[] = [
  { field: 'name', message: 'Please input full name' },
  { field: 'empId', message: 'Please input employee ID' },
  { field: 'phone', message: 'Please input phone number' },
  { field: 'branchName', message: 'Please input branch name' },
  { field: 'deptName', message: 'Please input department name' },
  { field: 'gender', message: 'Please select gender' },
];

export const DUPLICATE_EMPLOYEE_ID_MESSAGE = 'Employee ID already exists';
export const GENDER_CHOICES = ['Male', 'Female'] as const;

export const EMAIL_REQUIRED_MESSAGE = 'Please input email address';
export const EMAIL_INVALID_MESSAGE = 'Enter a valid email address';

/**
 * Required-field validation (v1 has no phone format rule; its e-mail was optional).
 * `emailRequired`: the deployment signs in by e-mail (backend `USER_AUTH=email`), so a staff member without a valid e-mail
 * could never sign in.
 */
export function validateStaffForm(values: StaffFormValues, opts: { emailRequired?: boolean } = {}): StaffFormErrors {
  const errors: StaffFormErrors = {};
  for (const { field, message } of STAFF_REQUIRED) {
    if (values[field].trim() === '') errors[field] = message;
  }
  if (opts.emailRequired) {
    if (values.email.trim() === '') errors.email = EMAIL_REQUIRED_MESSAGE;
    else if (!isValidEmail(values.email)) errors.email = EMAIL_INVALID_MESSAGE;
  }
  return errors;
}

export function hasErrors(errors: StaffFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Keep digits only (numeric-keyboard fields), optionally capped. */
export function digitsOnly(text: string, maxLength?: number): string {
  const digits = text.replace(/\D+/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

/** True when the form (or the photo) differs from the snapshot taken after loading. */
export function isStaffFormDirty(
  current: StaffFormValues,
  initial: StaffFormValues | null,
  photo: string | null,
  initialPhoto: string | null,
): boolean {
  if (!initial) return false;
  return JSON.stringify(current) !== JSON.stringify(initial) || photo !== initialPhoto;
}

/** Whether the "More Details" block holds any data (it opens automatically in edit mode then). */
export function hasMoreDetails(v: StaffFormValues): boolean {
  return Boolean(v.dob || v.address || v.emergencyContact || v.bloodGroup || v.bankName);
}

/** Prefill values for edit mode from the server record. */
export function formFromRecord(record: StaffRecord): StaffFormValues {
  return {
    name: record.name,
    empId: record.empId,
    phone: record.mobile,
    email: record.email,
    branchName: record.branch,
    deptName: record.department,
    gender: record.gender ?? '',
    shiftId: record.shiftId ?? 0,
    isFieldStaff: record.isFieldStaff,
    dob: record.dob ?? '',
    address: record.address ?? '',
    emergencyContact: record.emergencyContact ?? '',
    bloodGroup: record.bloodGroup ?? '',
    bankName: record.bankName ?? '',
    bankBranch: record.bankBranch ?? '',
    accNo: record.bankAccountNo ?? '',
    ifsc: record.ifsc ?? '',
  };
}

/** Payload for `POST/PUT /addstaff` (role 3 is fixed by the API layer; the manager id is not sent, as in v1). */
export function toStaffInput(values: StaffFormValues, scopeId: string): StaffInput {
  return {
    orgId: scopeId,
    name: values.name,
    empId: values.empId,
    mobile: values.phone,
    email: values.email,
    branchName: values.branchName,
    departmentName: values.deptName,
    gender: values.gender,
    shiftId: values.shiftId !== 0 ? values.shiftId : 0,
    isFieldStaff: values.isFieldStaff,
    dob: values.dob,
    address: values.address,
    emergencyContact: values.emergencyContact,
    bloodGroup: values.bloodGroup,
    bankName: values.bankName,
    bankBranch: values.bankBranch,
    bankAccountNo: values.accNo,
    ifsc: values.ifsc,
  };
}

// ── staff limit banner ───────────────────────────────────────────────────────────────────────

export interface StaffLimitInfo {
  current: number;
  limit: number;
}

/** `staff_limit` from the subscription payload exactly like v1: missing / 0 means "no limit info" (no banner, no gate). */
export function parseStaffLimit(raw: Record<string, unknown> | undefined): number {
  const value = raw?.staff_limit;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function staffLimitReached(info: StaffLimitInfo | null | undefined): boolean {
  return Boolean(info && info.limit > 0 && info.current >= info.limit);
}

export function staffLimitTitle(info: StaffLimitInfo): string {
  return `Staff: ${info.current} / ${info.limit}`;
}

export function staffLimitSubtitle(info: StaffLimitInfo): string {
  if (staffLimitReached(info)) return 'Staff limit reached. Please upgrade your plan to add more.';
  const slots = info.limit - info.current;
  return `${slots} ${slots === 1 ? 'slot' : 'slots'} remaining`;
}

/** Shift choices: label = name (closed field shows it), subtitle = `start - end` when both exist. */
export function shiftSubtitle(startLabel: string, endLabel: string): string | undefined {
  return startLabel && endLabel ? `${startLabel} - ${endLabel}` : undefined;
}
