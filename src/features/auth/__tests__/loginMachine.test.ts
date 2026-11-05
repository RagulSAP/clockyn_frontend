import { ApiError } from '@/lib/api/errors';
import type { DeviceVerifyResult } from '@/types/api/auth';

import {
  initialLoginState,
  interpretDeviceVerify,
  isPrimaryDisabled,
  loginErrorMessage,
  loginReducer,
  otpErrorMessage,
  primaryAction,
  sendOtpErrorMessage,
  type LoginAction,
  type LoginState,
  type TrustOutcome,
} from '../utils/loginMachine';

const verify = (over: Partial<DeviceVerifyResult> = {}): DeviceVerifyResult => ({
  success: false,
  skipOtp: false,
  deleted: false,
  inactive: false,
  deviceChangeApproved: false,
  sessionExpired: false,
  deviceMismatch: false,
  requestPending: false,
  message: '',
  ...over,
});

const reduce = (actions: LoginAction[], from: LoginState = initialLoginState) => actions.reduce(loginReducer, from);

const mismatchOutcome: TrustOutcome = { trust: 'mismatch', requestPending: true, userId: 'u1', orgId: 'o1', removeToken: false, notice: null };

describe('interpretDeviceVerify', () => {
  it('trusted device (both portals)', () => {
    expect(interpretDeviceVerify('admin', verify({ success: true, skipOtp: true })).trust).toBe('trusted');
    expect(interpretDeviceVerify('staff', verify({ success: true, skipOtp: true })).trust).toBe('trusted');
  });

  it('staff: approved device change removes the token and asks for the OTP', () => {
    const o = interpretDeviceVerify('staff', verify({ deviceChangeApproved: true, message: 'Approved. Log in again.' }));
    expect(o).toMatchObject({ trust: 'untrusted', removeToken: true });
    expect(o.notice?.message).toBe('Approved. Log in again.');
  });

  it('staff: mismatch carries ids and the pending flag', () => {
    expect(interpretDeviceVerify('staff', verify({ deviceMismatch: true, requestPending: true, userId: 'u', orgId: 'o' }))).toMatchObject({
      trust: 'mismatch',
      requestPending: true,
      userId: 'u',
      orgId: 'o',
    });
    expect(interpretDeviceVerify('staff', verify({ deviceMismatch: true })).requestPending).toBe(false);
  });

  it('admin: a mismatch is just "needs OTP"', () => {
    expect(interpretDeviceVerify('admin', verify({ deviceMismatch: true, userId: 'u' }))).toMatchObject({ trust: 'untrusted', userId: '' });
  });

  it('deleted / inactive accounts surface the server message', () => {
    expect(interpretDeviceVerify('staff', verify({ deleted: true, message: 'Account deleted' })).notice).toEqual({ tone: 'warning', message: 'Account deleted' });
    expect(interpretDeviceVerify('admin', verify({ inactive: true, message: 'Inactive' })).notice?.tone).toBe('warning');
  });

  it('unknown device falls back to the OTP', () => {
    expect(interpretDeviceVerify('staff', verify({ message: 'Device not recognized' }))).toMatchObject({ trust: 'untrusted', removeToken: false });
  });
});

describe('loginReducer', () => {
  it('clears every derived state when the number changes (stale device-mismatch fix)', () => {
    const mismatched = reduce([
      { type: 'mobileChanged', value: '9876543210' },
      { type: 'trustResolved', mobile: '9876543210', outcome: mismatchOutcome },
    ]);
    expect(mismatched).toMatchObject({ trust: 'mismatch', requestPending: true, mismatchUserId: 'u1', mismatchOrgId: 'o1' });

    const edited = loginReducer(mismatched, { type: 'mobileChanged', value: '987654321' });
    expect(edited).toMatchObject({ trust: 'idle', requestPending: false, mismatchUserId: '', mismatchOrgId: '', notice: null });
    expect(primaryAction(edited, 'staff')).toBe('get-otp');
    expect(isPrimaryDisabled(edited, 'staff')).toBe(true);
  });

  it('ignores a trust answer for a number that is no longer typed', () => {
    const s = reduce([
      { type: 'mobileChanged', value: '9876543210' },
      { type: 'trustChecking', mobile: '9876543210' },
      { type: 'mobileChanged', value: '9876543211' },
      { type: 'trustResolved', mobile: '9876543210', outcome: mismatchOutcome },
    ]);
    expect(s.mobile).toBe('9876543211');
    expect(s.trust).toBe('idle');
    expect(s.mismatchUserId).toBe('');
  });

  it('locks the number during the OTP phase and can go back', () => {
    const s = reduce([{ type: 'mobileChanged', value: '9876543210' }, { type: 'otpRequestStarted' }, { type: 'otpRequested' }]);
    expect(s).toMatchObject({ otpSent: true, otpLoading: false });
    expect(loginReducer(s, { type: 'mobileChanged', value: '1' }).mobile).toBe('9876543210');
    const back = loginReducer(s, { type: 'changeNumber' });
    expect(back).toMatchObject({ otpSent: false, otp: '', mobile: '9876543210', trust: 'idle' });
    expect(back.checkKey).toBe(s.checkKey + 1);
  });

  it('OTP input keeps digits only, max 6', () => {
    expect(loginReducer(initialLoginState, { type: 'otpChanged', value: '12a34-5678' }).otp).toBe('123456');
  });

  it('loading always clears at the end of a run (no stuck spinner)', () => {
    const base = reduce([{ type: 'mobileChanged', value: '9876543210' }, { type: 'otpRequested' }, { type: 'otpChanged', value: '123456' }, { type: 'loginStarted' }]);
    expect(base.loading).toBe(true);
    expect(loginReducer(base, { type: 'loginEnded' })).toMatchObject({ loading: false, otp: '123456' });
    expect(loginReducer(base, { type: 'loginEnded', otpRejected: true })).toMatchObject({ loading: false, otp: '', otpSent: true });
    expect(loginReducer(base, { type: 'loginEnded', backToNumber: true })).toMatchObject({ loading: false, otp: '', otpSent: false });
  });
});

describe('primaryAction / isPrimaryDisabled', () => {
  const typed = (extra: Partial<LoginState> = {}): LoginState => ({ ...initialLoginState, mobile: '9876543210', ...extra });

  it('follows the v1 priority', () => {
    expect(primaryAction(typed({ trust: 'checking' }), 'staff')).toBe('verifying');
    expect(primaryAction(typed({ trust: 'mismatch' }), 'staff')).toBe('request-access');
    expect(primaryAction(typed({ trust: 'mismatch', requestPending: true }), 'staff')).toBe('pending');
    expect(primaryAction(typed({ trust: 'trusted' }), 'staff')).toBe('continue');
    expect(primaryAction(typed({ trust: 'untrusted' }), 'staff')).toBe('get-otp');
    expect(primaryAction(typed({ otpSent: true }), 'staff')).toBe('verify-otp');
    // Admins have no device-mismatch flow.
    expect(primaryAction(typed({ trust: 'mismatch' }), 'admin')).toBe('get-otp');
  });

  it('disables per action', () => {
    expect(isPrimaryDisabled(typed({ trust: 'checking' }), 'admin')).toBe(true);
    expect(isPrimaryDisabled(typed({ trust: 'mismatch', requestPending: true }), 'staff')).toBe(true);
    expect(isPrimaryDisabled(typed({ trust: 'mismatch' }), 'staff')).toBe(false);
    expect(isPrimaryDisabled(typed({ trust: 'mismatch', mobile: '98765' }), 'staff')).toBe(true);
    expect(isPrimaryDisabled({ ...initialLoginState, mobile: '98765' }, 'admin')).toBe(true);
    expect(isPrimaryDisabled(typed(), 'admin')).toBe(false);
    expect(isPrimaryDisabled(typed({ otpLoading: true }), 'admin')).toBe(true);
    expect(isPrimaryDisabled(typed({ trust: 'trusted', loading: true }), 'admin')).toBe(true);
    expect(isPrimaryDisabled(typed({ otpSent: true, otp: '12345' }), 'admin')).toBe(true);
    expect(isPrimaryDisabled(typed({ otpSent: true, otp: '123456' }), 'admin')).toBe(false);
  });
});

describe('error copy', () => {
  it('shows the server detail for OTP errors, with the v1 fallback', () => {
    expect(otpErrorMessage(new ApiError({ status: 400, detail: 'Invalid or expired login mobile OTP' }))).toBe('Invalid or expired login mobile OTP');
    expect(otpErrorMessage(new ApiError({ status: 500 }))).toBe('The OTP you entered is incorrect. Please try again.');
  });

  it('staff success:false without a message means "not found"; admin keeps the generic copy', () => {
    const silent = new ApiError({ status: 200, message: 'Login failed', detail: 'Login failed' });
    expect(loginErrorMessage('staff', silent)).toBe('Employee not found or not authorized. Contact your admin.');
    expect(loginErrorMessage('admin', silent)).toBe('Login failed. Please try again.');
    expect(loginErrorMessage('staff', new ApiError({ status: 401, detail: 'Employee not found or not authorized' }))).toBe('Employee not found or not authorized');
    expect(loginErrorMessage('admin', new Error('boom'))).toBe('boom');
  });

  it('send-OTP errors fall back to the network copy', () => {
    expect(sendOtpErrorMessage(new ApiError({ status: 429, detail: 'Too many incorrect OTP attempts.' }))).toBe('Too many incorrect OTP attempts.');
    expect(sendOtpErrorMessage(new ApiError({ status: 500 }))).toBe('Network error. Please try again.');
  });
});
