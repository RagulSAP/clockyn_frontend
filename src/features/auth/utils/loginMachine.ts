/**
 * Pure state machine of the mobile + OTP login screens (admin and staff share it).
 *
 * v1 fixes encoded here:
 *  - editing / invalidating the number clears EVERY derived state (trusted flag, device-mismatch ids, pending flag, notice),
 *  - trust results that belong to another number than the one now typed are ignored (stale checks),
 *  - `loading` always clears (the hook ends every run in `loginEnded`),
 *  - the OTP phase can go back to the number (`changeNumber`).
 */
import { ApiError, getErrorMessage } from '@/lib/api/errors';
import type { DeviceVerifyResult, UserAuthMode } from '@/types/api/auth';

import { OTP_LENGTH, isValidLoginId } from './validation';

export type LoginPortalKind = 'admin' | 'staff';

export type TrustStatus = 'idle' | 'checking' | 'trusted' | 'untrusted' | 'mismatch';

export type LoginNotice = { tone: 'info' | 'warning'; message: string };

export interface LoginState {
  /** Sign-in mode of the deployment: `mobile` below holds a mobile number (`otp`) or an e-mail address (`email`). */
  mode: UserAuthMode;
  /** The login id typed by the user: a mobile number, or an e-mail address in `email` mode (the name predates e-mail sign-in). */
  mobile: string;
  otpSent: boolean;
  otp: string;
  trust: TrustStatus;
  /** Staff only: a device-change request is already waiting for the admin. */
  requestPending: boolean;
  mismatchUserId: string;
  mismatchOrgId: string;
  notice: LoginNotice | null;
  otpLoading: boolean;
  loading: boolean;
  /** Bumped to force a fresh trusted-device check for the same number. */
  checkKey: number;
}

export const initialLoginState: LoginState = {
  mode: 'otp',
  mobile: '',
  otpSent: false,
  otp: '',
  trust: 'idle',
  requestPending: false,
  mismatchUserId: '',
  mismatchOrgId: '',
  notice: null,
  otpLoading: false,
  loading: false,
  checkKey: 0,
};

// ─── trusted-device outcome ──────────────────────────────────────────────────────────────────

export interface TrustOutcome {
  trust: 'trusted' | 'untrusted' | 'mismatch';
  requestPending: boolean;
  userId: string;
  orgId: string;
  /** The server invalidated the stored token (admin approved a device change): delete it locally. */
  removeToken: boolean;
  notice: LoginNotice | null;
}

const NO_NOTICE = null;

/**
 * Interpret the `verify-device-token` answer (spec emp_login F1, priority order kept).
 * Admins only ever distinguish "trusted" from "needs OTP"; staff additionally handle the device-change flow.
 */
export function interpretDeviceVerify(portal: LoginPortalKind, res: DeviceVerifyResult): TrustOutcome {
  const base: TrustOutcome = { trust: 'untrusted', requestPending: false, userId: '', orgId: '', removeToken: false, notice: NO_NOTICE };
  if (res.success && res.skipOtp) return { ...base, trust: 'trusted' };

  // Account state: tell the user instead of silently offering an OTP that cannot work.
  if (res.deleted || res.inactive) {
    return { ...base, notice: res.message ? { tone: 'warning', message: res.message } : NO_NOTICE };
  }
  if (portal === 'admin') return base;

  if (res.deviceChangeApproved) {
    return { ...base, removeToken: true, notice: res.message ? { tone: 'info', message: res.message } : NO_NOTICE };
  }
  if (res.deviceMismatch) {
    return { ...base, trust: 'mismatch', requestPending: res.requestPending, userId: res.userId ?? '', orgId: res.orgId ?? '' };
  }
  if (res.sessionExpired && res.message) return { ...base, notice: { tone: 'info', message: res.message } };
  return base;
}

// ─── reducer ─────────────────────────────────────────────────────────────────────────────────

export type LoginAction =
  | { type: 'mobileChanged'; value: string }
  | { type: 'trustChecking'; mobile: string }
  | { type: 'trustResolved'; mobile: string; outcome: TrustOutcome }
  | { type: 'trustFailed'; mobile: string }
  | { type: 'otpRequestStarted' }
  | { type: 'otpRequested' }
  | { type: 'otpRequestFailed' }
  | { type: 'otpChanged'; value: string }
  | { type: 'loginStarted' }
  /** End of a login run. `otpRejected`: the OTP was wrong (clear the boxes, stay in the OTP phase). `backToNumber`: restart from the number. */
  | { type: 'loginEnded'; otpRejected?: boolean; backToNumber?: boolean }
  | { type: 'changeNumber' };

const clearedTrust = {
  trust: 'idle' as TrustStatus,
  requestPending: false,
  mismatchUserId: '',
  mismatchOrgId: '',
  notice: null,
};

export function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case 'mobileChanged': {
      if (state.otpSent) return state; // the number is locked while the OTP is being entered
      if (action.value === state.mobile) return state;
      return { ...state, mobile: action.value, ...clearedTrust };
    }
    case 'trustChecking':
      if (action.mobile !== state.mobile) return state;
      return { ...state, trust: 'checking', requestPending: false, mismatchUserId: '', mismatchOrgId: '', notice: null };
    case 'trustResolved': {
      if (action.mobile !== state.mobile) return state; // stale answer for a number that is no longer typed
      const o = action.outcome;
      return {
        ...state,
        trust: o.trust,
        requestPending: o.trust === 'mismatch' ? o.requestPending : false,
        mismatchUserId: o.trust === 'mismatch' ? o.userId : '',
        mismatchOrgId: o.trust === 'mismatch' ? o.orgId : '',
        notice: o.notice,
      };
    }
    case 'trustFailed':
      if (action.mobile !== state.mobile) return state;
      return { ...state, ...clearedTrust, trust: 'untrusted' };
    case 'otpRequestStarted':
      return { ...state, otpLoading: true };
    case 'otpRequested':
      return { ...state, otpLoading: false, otpSent: true, otp: '' };
    case 'otpRequestFailed':
      return { ...state, otpLoading: false };
    case 'otpChanged':
      return { ...state, otp: action.value.replace(/\D/g, '').slice(0, OTP_LENGTH) };
    case 'loginStarted':
      return { ...state, loading: true };
    case 'loginEnded': {
      if (action.backToNumber) return { ...state, loading: false, otpSent: false, otp: '', ...clearedTrust, checkKey: state.checkKey + 1 };
      return { ...state, loading: false, otp: action.otpRejected ? '' : state.otp };
    }
    case 'changeNumber':
      return { ...initialLoginState, mode: state.mode, mobile: state.mobile, checkKey: state.checkKey + 1 };
    default:
      return state;
  }
}

// ─── derived view state ──────────────────────────────────────────────────────────────────────

export type PrimaryAction = 'verifying' | 'request-access' | 'pending' | 'continue' | 'get-otp' | 'verify-otp';

/** Which single action button the number/OTP card shows (priority order of the v1 screens). */
export function primaryAction(state: LoginState, portal: LoginPortalKind): PrimaryAction {
  if (state.otpSent) return 'verify-otp';
  if (state.trust === 'checking') return 'verifying';
  if (portal === 'staff' && state.trust === 'mismatch' && isValidLoginId(state.mode, state.mobile)) return state.requestPending ? 'pending' : 'request-access';
  if (state.trust === 'trusted') return 'continue';
  return 'get-otp';
}

export function isPrimaryDisabled(state: LoginState, portal: LoginPortalKind): boolean {
  const action = primaryAction(state, portal);
  switch (action) {
    case 'verifying':
    case 'pending':
      return true;
    case 'request-access':
      return !isValidLoginId(state.mode, state.mobile);
    case 'continue':
      return !isValidLoginId(state.mode, state.mobile) || state.loading;
    case 'get-otp':
      return !isValidLoginId(state.mode, state.mobile) || state.otpLoading;
    case 'verify-otp':
      return state.otp.length !== OTP_LENGTH || state.loading;
  }
}

// ─── error copy ──────────────────────────────────────────────────────────────────────────────

export const OTP_REJECTED_MESSAGE = 'The OTP you entered is incorrect. Please try again.';
export const STAFF_NOT_FOUND_MESSAGE = 'Employee not found or not authorized. Contact your admin.';
export const LOGIN_FAILED_MESSAGE = 'Login failed. Please try again.';
export const NETWORK_FALLBACK_MESSAGE = 'Network error. Please try again.';

/** Error of the OTP-validation step: the server `detail` when there is one, otherwise the v1 "incorrect" copy. */
export function otpErrorMessage(e: unknown): string {
  return getErrorMessage(e, OTP_REJECTED_MESSAGE);
}

/**
 * Error of the login lookup step. Server `detail` first (v1 hid it on the admin screen). A `success:false` answer
 * without a message means "no such employee" on the staff portal.
 */
export function loginErrorMessage(portal: LoginPortalKind, e: unknown): string {
  if (e instanceof ApiError && e.status === 200 && (!e.detail || e.detail === 'Login failed')) {
    return portal === 'staff' ? STAFF_NOT_FOUND_MESSAGE : LOGIN_FAILED_MESSAGE;
  }
  return getErrorMessage(e, LOGIN_FAILED_MESSAGE);
}

/** Error of sending the OTP. */
export function sendOtpErrorMessage(e: unknown): string {
  return getErrorMessage(e, NETWORK_FALLBACK_MESSAGE);
}
