import type { DateString, RawRecord } from './common';

/** The signed-in employee's own personal, identity and bank details (`GET /employee/personal-details/{userId}`). */
export interface EmployeePersonalDetails {
  userId: string;
  name: string;
  empId: string;
  mobile: string;
  email: string;
  branchName: string;
  deptName: string;
  roleName: string;
  /** `YYYY-MM-DD`. The legacy sentinel `1990-01-01` ("not set") is mapped to `undefined`. */
  dob?: DateString;
  doj?: DateString;
  gender?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  fatherName?: string;
  address?: string;
  emergencyContact?: string;
  aadhaarNo?: string;
  panNo?: string;
  uanNo?: string;
  pfNo?: string;
  esiNo?: string;
  bankName?: string;
  bankBranch?: string;
  accountNumber?: string;
  ifscCode?: string;
  shiftId?: number;
  photoUrl?: string;
  raw: RawRecord;
}

/**
 * Editable subset of the personal details (`PUT /employee/personal-details/{userId}`).
 * Empty strings are allowed (cleared fields); `dob` / `doj` are `YYYY-MM-DD` or `''` (sent as `null`).
 */
export interface UpdatePersonalDetailsInput {
  name: string;
  mobile: string;
  email: string;
  dob: DateString | '';
  gender: string;
  bloodGroup: string;
  address: string;
  emergencyContact: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  bankBranch: string;
  fatherName: string;
  maritalStatus: string;
  aadhaarNo: string;
  panNo: string;
  uanNo: string;
  pfNo: string;
  esiNo: string;
  doj: DateString | '';
}
