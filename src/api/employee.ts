/**
 * Employee self-service: personal details (read / update), profile photo and today's birthdays.
 * Mirrors `shared/api/employee.md`; every function throws `ApiError` on failure (incl. `{success:false}`).
 */
import { api } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult, UploadFileInput } from '@/types/api/common';
import type { EmployeePersonalDetails, UpdatePersonalDetailsInput } from '@/types/api/employee';
import { uploadEmployeePhoto } from './auth';
import { arr, dateOnly, messageOf, objectOf, optNum, optStr, pick, rec, str } from './mappers/common';
import { seg } from './sharedHelpers';

/** v1 stored "no date of birth" as this value; it is treated as empty. */
export const UNSET_DOB = '1990-01-01';

/** Maps the personal-details body (a bare object or `{data:{…}}`), tolerating the legacy alternate field names. */
export function mapPersonalDetails(body: unknown): EmployeePersonalDetails {
  const r = objectOf(body);
  const dob = dateOnly(r.dob);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    mobile: str(r.mobile_number),
    email: str(r.email),
    branchName: str(r.branch_name),
    deptName: str(r.dept_name),
    roleName: str(r.role_name),
    dob: dob === UNSET_DOB ? undefined : dob,
    doj: dateOnly(r.doj),
    gender: optStr(r.gender),
    bloodGroup: optStr(r.blood_group),
    maritalStatus: optStr(pick(r, 'marital_status', 'maritalStatus')),
    fatherName: optStr(pick(r, 'father_name', 'fatherName')),
    address: optStr(r.address),
    emergencyContact: optStr(r.emergency_contact_no),
    aadhaarNo: optStr(pick(r, 'aadhaar_no', 'aadhaar')),
    panNo: optStr(pick(r, 'pan_no', 'pan')),
    uanNo: optStr(pick(r, 'uan_no', 'uan')),
    pfNo: optStr(pick(r, 'pf_no', 'pf')),
    esiNo: optStr(pick(r, 'esi_no', 'esi')),
    bankName: optStr(r.bank_name),
    bankBranch: optStr(r.bank_branch),
    accountNumber: optStr(r.acc_no),
    ifscCode: optStr(r.ifsc_code),
    shiftId: optNum(r.shift_id),
    photoUrl: optStr(r.profile_photo_url),
    raw: rec(r),
  };
}

/** Wire body of the personal-details update (legacy field names). Empty dates are sent as `null`. */
export function toPersonalDetailsBody(input: UpdatePersonalDetailsInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    mobile_number: input.mobile.trim(),
    email: input.email.trim(),
    dob: input.dob || null,
    gender: input.gender.trim(),
    blood_group: input.bloodGroup.trim(),
    address: input.address.trim(),
    emergency_contact_no: input.emergencyContact.trim(),
    acc_no: input.accountNumber.trim(),
    ifsc_code: input.ifscCode.trim(),
    bank_name: input.bankName.trim(),
    bank_branch: input.bankBranch.trim(),
    father_name: input.fatherName.trim(),
    marital_status: input.maritalStatus.trim(),
    aadhaar_no: input.aadhaarNo.trim(),
    pan_no: input.panNo.trim(),
    uan_no: input.uanNo.trim(),
    pf_no: input.pfNo.trim(),
    esi_no: input.esiNo.trim(),
    doj: input.doj || null,
  };
}

/** The employee's personal details. `GET /employee/personal-details/{userId}`. */
export async function getPersonalDetails(userId: string): Promise<EmployeePersonalDetails> {
  return mapPersonalDetails(await api.get<unknown>(`/employee/personal-details/${seg(userId)}`));
}

/** Saves the editable personal details. `PUT /employee/personal-details/{userId}`. */
export async function updatePersonalDetails(userId: string, input: UpdatePersonalDetailsInput): Promise<ActionResult> {
  const body = assertSuccess(
    await api.put<unknown>(`/employee/personal-details/${seg(userId)}`, toPersonalDetailsBody(input)),
    'Failed to save',
  );
  return { message: messageOf(body, 'Personal details updated successfully') };
}

/**
 * Uploads a new profile photo (multipart field `photo`, no hand-set Content-Type) and returns its URL when the
 * server provides one. `POST /auth/upload-employee-profile/{userId}`.
 */
export async function uploadProfilePhoto(userId: string, file: UploadFileInput): Promise<string | undefined> {
  return uploadEmployeePhoto(userId, file);
}

/**
 * Names of the colleagues whose birthday is today (the caller is excluded server-side).
 * `GET /employee/today-birthdays/{orgId}?exclude_user_id=`.
 */
export async function getTodayBirthdays(orgId: string, excludeUserId?: string): Promise<string[]> {
  const body = await api.get<unknown>(`/employee/today-birthdays/${seg(orgId)}`, { exclude_user_id: excludeUserId });
  return arr(rec(body).birthdays)
    .map((n) => str(n))
    .filter((n) => n !== '');
}
