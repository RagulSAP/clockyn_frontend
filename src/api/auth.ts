/**
 * Authentication & identity: login lookup, OTP, trusted-device check, registration, push token,
 * company logo and employee photo. Every function throws `ApiError` on failure (including
 * `{success:false}` bodies), except where noted.
 */
import { ApiError, api, isApiError } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult, UploadFileInput } from '@/types/api/common';
import type {
  DeviceVerifyResult,
  LoginPortal,
  LoginResult,
  LogoutInput,
  OtpPurpose,
  RegisterCompanyInput,
  RegisterCompanyResult,
  UserAuthMode,
  VerifyOtpResult,
} from '@/types/api/auth';
import {
  mapDeviceVerifyResult,
  mapLoginResult,
  mapRegisterResult,
  mapVerifyOtpResult,
  toRegisterBody,
} from './mappers/auth';
import { bool, messageOf, optStr, rec } from './mappers/common';
import { toUploadFile } from './params';
import { seg } from './sharedHelpers';

/** Sign-out must not wait on the server: give `POST /auth/logout` this long, then move on. */
export const LOGOUT_TIMEOUT_MS = 2500;

/**
 * How this deployment signs users in. `GET /auth/config` -> `{ user_auth: 'otp' | 'email' }`.
 * Never throws: an older server without the route (or any failure) means the original mobile + SMS OTP sign-in.
 */
export async function getAuthMode(): Promise<UserAuthMode> {
  try {
    const body = await api.get<unknown>('/auth/config');
    return rec(body).user_auth === 'email' ? 'email' : 'otp';
  } catch {
    return 'otp';
  }
}

/**
 * Looks the user up by mobile number — or by e-mail address when the deployment uses e-mail sign-in (starts the login).
 * `POST /auth/login` (admin portal) or `POST /auth/employee-login` (employee / manager portal).
 */
export async function login(mobile: string, portal: LoginPortal = 'admin'): Promise<LoginResult> {
  const path = portal === 'employee' ? '/auth/employee-login' : '/auth/login';
  const body = await api.post<unknown>(path, { login_id: mobile.trim() });
  return mapLoginResult(assertSuccess(body, 'Login failed'));
}

/** Sends a 6-digit OTP by SMS (10-digit mobile) or e-mail. `POST /auth/generate-otp`. */
export async function requestOtp(input: { contact: string; purpose: OtpPurpose; roleId?: number }): Promise<ActionResult> {
  const body = await api.post<unknown>('/auth/generate-otp', {
    contact: input.contact.trim(),
    purpose: input.purpose,
    role_id: input.roleId,
  });
  assertSuccess(body, 'Failed to send OTP');
  return { message: messageOf(body) };
}

/** Shown when the server refuses a login from a second device (HTTP 409 `device_mismatch`) and has asked the admin. */
export const DEVICE_MISMATCH_MESSAGE =
  'This account is active on another device. A device change request was sent to your admin; sign in again once it is approved.';

/**
 * Validates an OTP and returns the trusted-device token to persist. `POST /auth/validate-otp`.
 * A `{success:false}` answer throws (v1 ignored it).
 */
export async function verifyOtp(input: {
  contact: string;
  otp: string;
  purpose: OtpPurpose;
  deviceToken?: string;
  pushToken?: string;
}): Promise<VerifyOtpResult> {
  let body: unknown;
  try {
    body = await api.post<unknown>('/auth/validate-otp', {
      contact: input.contact.trim(),
      otp_code: input.otp,
      purpose: input.purpose,
      device_token: input.deviceToken,
      push_token: input.pushToken,
    });
  } catch (e) {
    // ENFORCE_SINGLE_DEVICE: managers / staff on a second device get HTTP 409 with the machine code as `detail`.
    if (isApiError(e) && e.status === 409 && e.detail === 'device_mismatch') {
      throw new ApiError({ status: 409, message: DEVICE_MISMATCH_MESSAGE, detail: DEVICE_MISMATCH_MESSAGE, raw: e.raw });
    }
    throw e;
  }
  return mapVerifyOtpResult(assertSuccess(body, 'OTP validation failed'));
}

/**
 * Trusted-device check that lets a returning user skip the OTP. `POST /auth/verify-device-token`.
 * Never throws for `{success:false}`: the flags (`deleted`, `inactive`, `deviceMismatch`, ...) tell the
 * screen what to do. HTTP errors still throw.
 */
export async function verifyDeviceToken(input: {
  contact: string;
  deviceToken: string;
  roleId?: number;
  pushToken?: string;
}): Promise<DeviceVerifyResult> {
  const body = await api.post<unknown>('/auth/verify-device-token', {
    contact: input.contact.trim(),
    device_token: input.deviceToken,
    role_id: input.roleId,
    push_token: input.pushToken,
  });
  return mapDeviceVerifyResult(body);
}

/** Registers a new company + its admin (1-month free trial is created server-side). `POST /auth/register`. */
export async function registerCompany(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
  const body = await api.post<unknown>('/auth/register', toRegisterBody(input));
  return mapRegisterResult(assertSuccess(body, 'Registration failed'));
}

/**
 * Ends the server-side session (revokes the bearer token, clears the push token for this device). `POST /auth/logout`.
 * Best-effort: never throws (the server always answers 200; a network failure, timeout or an already-expired token is ignored)
 * and uses a short timeout so a sign-out is never held up by it. Call it BEFORE the local session is cleared (it needs the token).
 */
export async function logout(input: LogoutInput): Promise<void> {
  try {
    await api.post<unknown>(
      '/auth/logout',
      { user_id: input.userId, device_token: input.deviceToken, push_token: input.pushToken },
      { timeoutMs: LOGOUT_TIMEOUT_MS },
    );
  } catch {
    // intentionally ignored
  }
}

/**
 * Duplicate-mobile pre-check. `GET /auth/check-mobile/{mobile}`.
 * Callers should treat a thrown error as "unknown" (the backend may reject this call).
 */
export async function checkMobileExists(mobile: string): Promise<boolean> {
  const body = await api.get<unknown>(`/auth/check-mobile/${seg(mobile)}`);
  return bool(rec(body).exists);
}

/** Duplicate-email pre-check. `GET /auth/check-email/{email}`; same caveat as `checkMobileExists`. */
export async function checkEmailExists(email: string): Promise<boolean> {
  const body = await api.get<unknown>(`/auth/check-email/${seg(email)}`);
  return bool(rec(body).exists);
}

/** Saves the device push token for the user. `POST /auth/update-push-token`. Failures must not block login. */
export async function updatePushToken(userId: string, pushToken: string): Promise<void> {
  const body = await api.post<unknown>('/auth/update-push-token', { user_id: userId, push_token: pushToken });
  assertSuccess(body, 'Failed to update push token');
}

/** Admin mobile number (used to send the account-deletion OTP). `GET /auth/user-mobile/{userId}`. */
export async function getUserMobile(userId: string): Promise<string> {
  const body = assertSuccess(await api.get<unknown>(`/auth/user-mobile/${seg(userId)}`), 'Failed to load mobile number');
  return optStr(rec(body).mobile_number) ?? '';
}

/**
 * Company logo URL, or `null` when the company has none. `GET /auth/org-logo/{orgId}`.
 * `bustCache` appends a timestamp so a just-uploaded logo is fetched fresh.
 */
export async function getOrgLogoUrl(orgId: string, opts: { bustCache?: boolean } = {}): Promise<string | null> {
  const body = await api.get<unknown>(`/auth/org-logo/${seg(orgId)}`, opts.bustCache ? { t: Date.now() } : undefined);
  const r = rec(body);
  return r.success === false ? null : (optStr(r.logo_url) ?? null);
}

/** Employee profile photo URL (or `null`). `GET /auth/employee-profile/{userId}`. */
export async function getEmployeePhotoUrl(userId: string): Promise<string | null> {
  const body = await api.get<unknown>(`/auth/employee-profile/${seg(userId)}`);
  const r = rec(body);
  return r.success === false ? null : (optStr(r.photo_url) ?? null);
}

/** Profile photo URL stored from the face enrolment (or `null`). `GET /profile-photo/{userId}`. */
export async function getProfilePhotoUrl(userId: string): Promise<string | null> {
  const body = await api.get<unknown>(`/profile-photo/${seg(userId)}`);
  const r = rec(body);
  return r.success === false ? null : (optStr(r.photo_url) ?? null);
}

/** Uploads the logo of a newly created company (PNG/JPEG). `POST /auth/upload-org-logo/{orgId}` (field `logo`). */
export async function uploadOrgLogo(orgId: string, file: UploadFileInput, opts: { accessToken?: string } = {}): Promise<void> {
  const body = await api.upload<unknown>(`/auth/upload-org-logo/${seg(orgId)}`, toUploadFile(file, 'logo', 'logo'), { accessToken: opts.accessToken });
  assertSuccess(body, 'Failed to upload logo');
}

/**
 * Uploads an employee's profile photo and returns its URL when the server provides one.
 * `POST /auth/upload-employee-profile/{userId}` (field `photo`).
 */
export async function uploadEmployeePhoto(userId: string, file: UploadFileInput): Promise<string | undefined> {
  const body = await api.upload<unknown>(`/auth/upload-employee-profile/${seg(userId)}`, toUploadFile(file, 'photo', 'profile'));
  assertSuccess(body, 'Failed to upload photo');
  return optStr(rec(body).photo_url);
}
