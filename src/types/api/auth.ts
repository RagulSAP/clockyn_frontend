import type { DateString, RawRecord, RoleId } from './common';

export type LoginPortal = 'admin' | 'employee';

/** How this deployment signs users in (backend `USER_AUTH`): mobile number + SMS code, or e-mail address + emailed code. */
export type UserAuthMode = 'otp' | 'email';

export type OtpPurpose = 'registration' | 'login' | 'delete_account' | 'update_email';

/** Result of the mobile-number lookup that starts a login (`/auth/login`, `/auth/employee-login`). */
export interface LoginResult {
  userId: string;
  email?: string;
  /** Organisation id (the server aliases it as `current_org_id`). */
  orgId: string;
  orgName: string;
  roleId: RoleId;
  orgLogo?: string;
  /** `null` = free trial or no plan. */
  planId: number | null;
  isFreeTrial: boolean;
  freeTrialEnd: DateString | null;
  /** Enabled permission names (managers only). */
  managerPermissions: string[];
  message: string;
  raw: RawRecord;
}

export interface VerifyOtpResult {
  message: string;
  /** Server-issued trusted-device token (90 days). Persist it. */
  deviceToken: string;
  userExists: boolean;
  roleId: RoleId | null;
  /** Opaque bearer token for the session (absent when the server does not issue one). */
  accessToken?: string;
  /** Lifetime of `accessToken` in seconds. */
  expiresIn?: number;
}

/** Outcome of the trusted-device check. All flags are false on success. */
export interface DeviceVerifyResult {
  success: boolean;
  /** True when the OTP step can be skipped (trusted device). */
  skipOtp: boolean;
  deleted: boolean;
  inactive: boolean;
  deviceChangeApproved: boolean;
  sessionExpired: boolean;
  deviceMismatch: boolean;
  /** Device-mismatch only: a device-change request is already waiting for the admin. */
  requestPending: boolean;
  message: string;
  userId?: string;
  orgId?: string;
  /** Session data, present when `success` is true. */
  session?: LoginResult;
  /** Bearer token issued with a successful trusted-device check (`success` and `skipOtp`). */
  accessToken?: string;
  /** Lifetime of `accessToken` in seconds. */
  expiresIn?: number;
}

export interface RegisterCompanyInput {
  name: string;
  empId: string;
  mobile: string;
  email: string;
  orgName: string;
  orgAddress: string;
  gst: string;
  departments: string[];
  branches: string[];
  pan?: string;
  website?: string;
  cin?: string;
  tan?: string;
  msme?: string;
  businessCategory?: string;
  deviceToken?: string;
  state?: string;
  district?: string;
  pincode?: number;
  /** Optional 6-character code of the organisation that referred this one (omitted when empty). */
  referralCode?: string;
}

export interface RegisterCompanyResult {
  userId: string;
  orgId: string;
  orgName: string;
  roleId: RoleId;
  orgLogo?: string;
  message: string;
  /** Bearer token for the new admin's session. */
  accessToken?: string;
  /** Lifetime of `accessToken` in seconds. */
  expiresIn?: number;
}

/** Body of `POST /auth/logout` (best-effort server-side session end). */
export interface LogoutInput {
  userId: string;
  deviceToken?: string;
  pushToken?: string;
}
