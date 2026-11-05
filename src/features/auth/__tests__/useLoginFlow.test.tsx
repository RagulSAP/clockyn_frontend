import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { authApi } from '@/api';
import { toast } from '@/components/ui';
import { ApiError } from '@/lib/api/errors';
import { queryClient } from '@/lib/query/queryClient';
import { STORAGE_KEYS, getString, setString, storageKeyFor } from '@/lib/storage';
import { getSession, useAuthStore } from '@/store/auth';
import type { DeviceVerifyResult, LoginResult } from '@/types/api/auth';

import { useLoginFlow } from '../hooks/useLoginFlow';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: mockRouter,
}));
jest.mock('@/api', () => ({
  authApi: { verifyDeviceToken: jest.fn(), requestOtp: jest.fn(), verifyOtp: jest.fn(), login: jest.fn() },
  homeApi: { getDashboardStats: jest.fn().mockResolvedValue({}), getBranches: jest.fn().mockResolvedValue([]) },
  companyApi: { getCompanyDetails: jest.fn().mockRejectedValue(new Error('none')) },
  attendanceApi: { getToday: jest.fn().mockResolvedValue({}) },
  faceApi: { isFaceRegistered: jest.fn().mockResolvedValue(true) },
}));
jest.mock('@/components/layout/bootstrap/pushToken', () => ({ refreshPushToken: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/platform/notifications', () => ({ registerForPush: jest.fn().mockResolvedValue(null) }));

const api = authApi as jest.Mocked<typeof authApi>;
const MOBILE = '9876543210';
const tokenKey = storageKeyFor(STORAGE_KEYS.deviceToken, MOBILE);

const verifyResult = (over: Partial<DeviceVerifyResult> = {}): DeviceVerifyResult => ({
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
const lookup = (raw: Record<string, unknown>) => ({ raw: { success: true, ...raw } }) as unknown as LoginResult;
const adminRaw = { user_id: 'u1', org_id: 'orgA', org_name: 'Alpha', role_id: 1 };
const staffRaw = { user_id: 's1', org_id: 'orgA', org_name: 'Alpha', role_id: 3 };

let errorToast: jest.SpyInstance;
let successToast: jest.SpyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: null });
  await AsyncStorage.clear();
  errorToast = jest.spyOn(toast, 'error').mockImplementation(() => undefined as never);
  successToast = jest.spyOn(toast, 'success').mockImplementation(() => undefined as never);
});

afterEach(() => {
  queryClient.clear();
});

async function typeMobile(result: { current: ReturnType<typeof useLoginFlow> }, value = MOBILE) {
  await act(async () => {
    result.current.setMobile(value);
  });
}

describe('admin portal', () => {
  it('no stored token: Get OTP sends the login OTP for role 1 and switches to the OTP phase', async () => {
    api.requestOtp.mockResolvedValue({ message: 'OTP sent successfully' });
    const { result } = await renderHook(() => useLoginFlow('admin'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    expect(result.current.action).toBe('get-otp');

    await act(async () => result.current.submit());
    expect(api.requestOtp).toHaveBeenCalledWith({ contact: MOBILE, purpose: 'login', roleId: 1 });
    await waitFor(() => expect(result.current.state.otpSent).toBe(true));
    expect(result.current.action).toBe('verify-otp');
    expect(successToast).toHaveBeenCalledWith('OTP sent successfully');
  });

  it('shows the server error when the OTP cannot be sent', async () => {
    api.requestOtp.mockRejectedValue(new ApiError({ status: 429, detail: 'Too many incorrect OTP attempts.' }));
    const { result } = await renderHook(() => useLoginFlow('admin'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Too many incorrect OTP attempts.'));
    expect(result.current.state).toMatchObject({ otpSent: false, otpLoading: false });
  });

  it('trusted device: Continue signs in without an OTP and opens the admin home', async () => {
    await setString(tokenKey, 'dev-1');
    api.verifyDeviceToken.mockResolvedValue(verifyResult({ success: true, skipOtp: true }));
    api.login.mockResolvedValue(lookup(adminRaw));
    const { result } = await renderHook(() => useLoginFlow('admin'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.action).toBe('continue'));
    expect(api.verifyDeviceToken).toHaveBeenCalledWith(expect.objectContaining({ contact: MOBILE, deviceToken: 'dev-1', roleId: 1 }));

    await act(async () => result.current.submit());
    await waitFor(() => expect(getSession()?.userId).toBe('u1'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/home');
    expect(api.requestOtp).not.toHaveBeenCalled();
    expect(await getString(STORAGE_KEYS.lastLoginAt)).toMatch(/^\d+$/);
    await waitFor(() => expect(result.current.state.loading).toBe(false));
  });

  it('a staff number is rejected BEFORE a session is persisted', async () => {
    await setString(tokenKey, 'dev-1');
    api.verifyDeviceToken.mockResolvedValue(verifyResult({ success: true, skipOtp: true }));
    api.login.mockResolvedValue(lookup(staffRaw));
    const { result } = await renderHook(() => useLoginFlow('admin'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.action).toBe('continue'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Access denied. Admin credentials required.'));
    expect(getSession()).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(result.current.state.loading).toBe(false);
  });

  it('OTP verify: stores the device token, keeps going to the home screen', async () => {
    api.requestOtp.mockResolvedValue({ message: 'sent' });
    api.verifyOtp.mockResolvedValue({ message: 'ok', deviceToken: 'new-token', userExists: true, roleId: 1 });
    api.login.mockResolvedValue(lookup(adminRaw));
    const { result } = await renderHook(() => useLoginFlow('admin'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.state.otpSent).toBe(true));
    await act(async () => result.current.setOtp('123456'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(getSession()?.userId).toBe('u1'));
    expect(api.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ contact: MOBILE, otp: '123456', purpose: 'login' }));
    expect(await getString(tokenKey)).toBe('new-token');
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/home');
  });

  it('wrong OTP: shows the server detail, clears the boxes and stays in the OTP phase', async () => {
    api.requestOtp.mockResolvedValue({ message: 'sent' });
    api.verifyOtp.mockRejectedValue(new ApiError({ status: 400, detail: 'Invalid or expired login mobile OTP' }));
    const { result } = await renderHook(() => useLoginFlow('admin'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.state.otpSent).toBe(true));
    await act(async () => result.current.setOtp('111111'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Invalid or expired login mobile OTP'));
    expect(result.current.state).toMatchObject({ otp: '', otpSent: true, loading: false });
    expect(api.login).not.toHaveBeenCalled();
  });

  it('success:false after a valid OTP does not leave a spinner and returns to the number', async () => {
    api.requestOtp.mockResolvedValue({ message: 'sent' });
    api.verifyOtp.mockResolvedValue({ message: 'ok', deviceToken: 't', userExists: true, roleId: 1 });
    api.login.mockRejectedValue(new ApiError({ status: 200, message: 'Login failed', detail: 'Login failed' }));
    const { result } = await renderHook(() => useLoginFlow('admin'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.state.otpSent).toBe(true));
    await act(async () => result.current.setOtp('123456'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Login failed. Please try again.'));
    expect(result.current.state).toMatchObject({ loading: false, otpSent: false });
    expect(getSession()).toBeNull();
  });

  it('an OTP for an unregistered number continues with the registration (no session)', async () => {
    api.requestOtp.mockResolvedValue({ message: 'sent' });
    api.verifyOtp.mockResolvedValue({ message: 'ok', deviceToken: 't', userExists: false, roleId: null });
    const { result } = await renderHook(() => useLoginFlow('admin'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.state.otpSent).toBe(true));
    await act(async () => result.current.setOtp('123456'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/register', params: { mobileNumber: MOBILE, verifiedContact: MOBILE } }));
    expect(getSession()).toBeNull();
    expect(result.current.state.loading).toBe(false);
  });
});

describe('staff portal', () => {
  it('uses role 3 for the OTP and stores the device token in the session', async () => {
    await setString(tokenKey, 'dev-1');
    api.verifyDeviceToken.mockResolvedValue(verifyResult({ success: true, skipOtp: true }));
    api.login.mockResolvedValue(lookup(staffRaw));
    const { result } = await renderHook(() => useLoginFlow('staff'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.action).toBe('continue'));
    expect(api.verifyDeviceToken).toHaveBeenCalledWith(expect.objectContaining({ roleId: undefined }));
    await act(async () => result.current.submit());
    await waitFor(() => expect(getSession()?.deviceToken).toBe('dev-1'));
    expect(api.login).toHaveBeenCalledWith(MOBILE, 'employee');
    expect(mockRouter.replace).toHaveBeenCalledWith('/staff/home');
  });

  it('an admin number is rejected before a session is persisted', async () => {
    await setString(tokenKey, 'dev-1');
    api.verifyDeviceToken.mockResolvedValue(verifyResult({ success: true, skipOtp: true }));
    api.login.mockResolvedValue(lookup(adminRaw));
    const { result } = await renderHook(() => useLoginFlow('staff'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.action).toBe('continue'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Access denied. Employee credentials required.'));
    expect(getSession()).toBeNull();
  });

  it('device mismatch: Request Access opens the device-change screen; editing the number clears the state', async () => {
    await setString(tokenKey, 'dev-1');
    api.verifyDeviceToken.mockResolvedValue(verifyResult({ deviceMismatch: true, userId: 'u9', orgId: 'o9' }));
    const { result } = await renderHook(() => useLoginFlow('staff'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.action).toBe('request-access'));

    await act(async () => result.current.submit());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/device-change-request', params: { userId: 'u9', orgId: 'o9', mobile: MOBILE } });

    await act(async () => result.current.setMobile('987654321'));
    expect(result.current.state).toMatchObject({ trust: 'idle', mismatchUserId: '', mismatchOrgId: '', requestPending: false });
    expect(result.current.action).toBe('get-otp');
    expect(result.current.actionDisabled).toBe(true);
  });

  it('a pending device-change request disables the button', async () => {
    await setString(tokenKey, 'dev-1');
    api.verifyDeviceToken.mockResolvedValue(verifyResult({ deviceMismatch: true, requestPending: true, userId: 'u9', orgId: 'o9' }));
    const { result } = await renderHook(() => useLoginFlow('staff'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.action).toBe('pending'));
    expect(result.current.actionDisabled).toBe(true);
  });

  it('an approved device change wipes the stored token and offers the OTP', async () => {
    await setString(tokenKey, 'dev-1');
    api.verifyDeviceToken.mockResolvedValue(verifyResult({ deviceChangeApproved: true, message: 'Approved' }));
    const { result } = await renderHook(() => useLoginFlow('staff'));
    await typeMobile(result);
    await waitFor(() => expect(result.current.action).toBe('get-otp'));
    expect(await getString(tokenKey)).toBeNull();
  });

  it('ignores a stale device check that resolves after the number changed', async () => {
    await setString(tokenKey, 'dev-1');
    let resolveFirst: (v: DeviceVerifyResult) => void = () => undefined;
    api.verifyDeviceToken.mockImplementationOnce(() => new Promise<DeviceVerifyResult>((r) => (resolveFirst = r)));
    const { result } = await renderHook(() => useLoginFlow('staff'));
    await typeMobile(result);
    await waitFor(() => expect(api.verifyDeviceToken).toHaveBeenCalledTimes(1));
    await act(async () => result.current.setMobile('9876543211'));
    await act(async () => resolveFirst(verifyResult({ deviceMismatch: true, userId: 'old', orgId: 'old' })));
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    expect(result.current.state.mismatchUserId).toBe('');
    expect(result.current.action).toBe('get-otp');
  });
});

describe('e-mail sign-in mode (backend USER_AUTH=email)', () => {
  const EMAIL = 'boss@example.com';
  const emailTokenKey = storageKeyFor(STORAGE_KEYS.deviceToken, EMAIL);

  it('a phone number is not a valid id: the action stays disabled until a real e-mail is typed', async () => {
    const { result } = await renderHook(() => useLoginFlow('admin', 'email'));
    await act(async () => result.current.setMobile(MOBILE));
    expect(result.current.actionDisabled).toBe(true);
    await act(async () => result.current.setMobile('  Boss@Example.COM '));
    expect(result.current.state.mobile).toBe(EMAIL);
    await waitFor(() => expect(result.current.actionDisabled).toBe(false));
  });

  it('sends the code to the e-mail, verifies it, logs in by e-mail and keys the device token by e-mail', async () => {
    api.requestOtp.mockResolvedValue({ message: 'sent' });
    api.verifyOtp.mockResolvedValue({ message: 'ok', deviceToken: 'mail-token', userExists: true, roleId: 1 });
    api.login.mockResolvedValue(lookup(adminRaw));
    const { result } = await renderHook(() => useLoginFlow('admin', 'email'));
    await act(async () => result.current.setMobile(EMAIL));
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    await act(async () => result.current.submit());
    expect(api.requestOtp).toHaveBeenCalledWith({ contact: EMAIL, purpose: 'login', roleId: 1 });
    await waitFor(() => expect(result.current.state.otpSent).toBe(true));
    await act(async () => result.current.setOtp('123456'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(getSession()?.userId).toBe('u1'));
    expect(api.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ contact: EMAIL, otp: '123456', purpose: 'login' }));
    expect(api.login).toHaveBeenCalledWith(EMAIL, 'admin');
    expect(await getString(emailTokenKey)).toBe('mail-token');
  });

  it('a trusted device skips the code for the e-mail it was issued to', async () => {
    await setString(emailTokenKey, 'dev-1');
    api.verifyDeviceToken.mockResolvedValue(verifyResult({ success: true, skipOtp: true }));
    const { result } = await renderHook(() => useLoginFlow('staff', 'email'));
    await act(async () => result.current.setMobile(EMAIL));
    await waitFor(() => expect(result.current.action).toBe('continue'));
    expect(api.verifyDeviceToken).toHaveBeenCalledWith(expect.objectContaining({ contact: EMAIL, deviceToken: 'dev-1' }));
  });

  it('an unregistered admin e-mail continues with the registration, e-mail already verified', async () => {
    api.requestOtp.mockResolvedValue({ message: 'sent' });
    api.verifyOtp.mockResolvedValue({ message: 'ok', deviceToken: 't', userExists: false, roleId: null });
    const { result } = await renderHook(() => useLoginFlow('admin', 'email'));
    await act(async () => result.current.setMobile(EMAIL));
    await waitFor(() => expect(result.current.state.trust).toBe('untrusted'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.state.otpSent).toBe(true));
    await act(async () => result.current.setOtp('123456'));
    await act(async () => result.current.submit());
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/register', params: { emailAddress: EMAIL, verifiedContact: EMAIL } }));
    expect(getSession()).toBeNull();
  });
});
