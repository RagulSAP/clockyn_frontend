import type {
  DeviceVerifyResult,
  LoginResult,
  RegisterCompanyInput,
  RegisterCompanyResult,
  VerifyOtpResult,
} from '@/types/api/auth';
import type { RoleId } from '@/types/api/common';
import { arr, bool, dateOnly, messageOf, optNum, optStr, pick, rec, roleId, str } from './common';

/** Session data from a login / device-verification body. */
export function mapLoginResult(body: unknown): LoginResult {
  const r = rec(body);
  const userId = str(r.user_id);
  return {
    userId,
    email: optStr(r.email),
    orgId: str(pick(r, 'org_id', 'current_org_id'), userId),
    orgName: str(r.org_name),
    roleId: roleId(r.role_id) ?? 1,
    orgLogo: optStr(r.org_logo),
    planId: optNum(r.plan_id) ?? null,
    isFreeTrial: bool(r.is_free_trial),
    freeTrialEnd: dateOnly(r.free_trial_end) ?? null,
    managerPermissions: arr(r.manager_permissions).map((p) => str(p)).filter((p) => p !== ''),
    message: messageOf(r),
    raw: r,
  };
}

/** `{ access_token, expires_in }` of a login-type body; both optional (an older server issues none). */
function tokenFields(r: Record<string, unknown>): { accessToken?: string; expiresIn?: number } {
  const accessToken = optStr(r.access_token);
  if (!accessToken) return {};
  const expiresIn = optNum(r.expires_in);
  return expiresIn !== undefined && expiresIn > 0 ? { accessToken, expiresIn } : { accessToken };
}

export function mapVerifyOtpResult(body: unknown): VerifyOtpResult {
  const r = rec(body);
  return {
    message: messageOf(r),
    deviceToken: str(r.device_token),
    userExists: bool(r.user_exists),
    roleId: roleId(r.role_id) ?? null,
    ...tokenFields(r),
  };
}

export function mapDeviceVerifyResult(body: unknown): DeviceVerifyResult {
  const r = rec(body);
  const success = r.success === true;
  return {
    success,
    skipOtp: bool(r.skip_otp),
    deleted: bool(r.deleted),
    inactive: bool(r.inactive),
    deviceChangeApproved: bool(r.device_change_approved),
    sessionExpired: bool(r.session_expired),
    deviceMismatch: bool(r.device_mismatch),
    requestPending: bool(r.request_pending),
    message: messageOf(r),
    userId: optStr(r.user_id),
    orgId: optStr(pick(r, 'org_id', 'current_org_id')),
    session: success ? mapLoginResult(r) : undefined,
    ...(success ? tokenFields(r) : {}),
  };
}

export function mapRegisterResult(body: unknown): RegisterCompanyResult {
  const r = rec(body);
  const role: RoleId = roleId(r.role_id) ?? 1;
  return {
    userId: str(r.user_id),
    orgId: str(r.org_id),
    orgName: str(r.org_name),
    roleId: role,
    orgLogo: optStr(r.org_logo),
    message: messageOf(r),
    ...tokenFields(r),
  };
}

/**
 * Body of `POST /auth/register`. The typed GST number is sent as both `org_gst` and `gst_number`
 * (the server model requires `gst_number`).
 */
export function toRegisterBody(input: RegisterCompanyInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    emp_id: input.empId.trim(),
    mobile_number: input.mobile.trim(),
    email: input.email.trim(),
    org_name: input.orgName.trim(),
    org_address: input.orgAddress.trim(),
    org_gst: input.gst,
    gst_number: input.gst,
    departments: input.departments,
    branches: input.branches,
  };
  const optional: Record<string, string | number | undefined> = {
    pan_number: input.pan,
    company_website: input.website,
    cin_number: input.cin,
    tan_number: input.tan,
    msme_number: input.msme,
    business_category: input.businessCategory,
    device_token: input.deviceToken,
    state: input.state,
    district: input.district,
    pincode: input.pincode,
  };
  for (const [k, v] of Object.entries(optional)) {
    if (v !== undefined && v !== '') body[k] = v;
  }
  return body;
}
