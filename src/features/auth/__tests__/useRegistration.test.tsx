import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { authApi, referralApi } from '@/api';
import { saveAttribution } from '@/api/attribution';
import { toast } from '@/components/ui';
import { ApiError } from '@/lib/api/errors';
import { queryClient } from '@/lib/query/queryClient';
import { STORAGE_KEYS, setString, storageKeyFor } from '@/lib/storage';
import { pickImage } from '@/lib/platform/media';
import { getSession, useAuthStore } from '@/store/auth';

import { useRegistration } from '../hooks/useRegistration';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, router: mockRouter }));
jest.mock('@/api', () => ({
  authApi: {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    registerCompany: jest.fn(),
    uploadOrgLogo: jest.fn(),
    checkMobileExists: jest.fn().mockResolvedValue(false),
    checkEmailExists: jest.fn().mockResolvedValue(false),
  },
  referralApi: { validateCode: jest.fn() },
  homeApi: {
    getDashboardStats: jest.fn().mockResolvedValue({}),
    getBranches: jest.fn().mockResolvedValue([]),
    getDepartments: jest.fn().mockResolvedValue([]),
    getAllStaff: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('@/api/attribution', () => ({ saveAttribution: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/components/layout/bootstrap/pushToken', () => ({ refreshPushToken: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/platform/notifications', () => ({ registerForPush: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/platform/media', () => ({ pickImage: jest.fn(), MediaPermissionError: class MediaPermissionError extends Error {} }));

const api = authApi as jest.Mocked<typeof authApi>;
const validateCode = referralApi.validateCode as jest.Mock;
const MOBILE = '9876543210';
let errorToast: jest.SpyInstance;
let successToast: jest.SpyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  api.checkMobileExists.mockResolvedValue(false);
  api.checkEmailExists.mockResolvedValue(false);
  useAuthStore.setState({ session: null });
  await AsyncStorage.clear();
  errorToast = jest.spyOn(toast, 'error').mockImplementation(() => undefined as never);
  successToast = jest.spyOn(toast, 'success').mockImplementation(() => undefined as never);
});
afterEach(() => queryClient.clear());

type Hook = { current: ReturnType<typeof useRegistration> };

async function fillAndVerify(result: Hook) {
  await act(async () => {
    result.current.setField('orgName', 'Acme');
    result.current.setField('address', '12 MG Road');
    result.current.setField('state', 'Karnataka');
    result.current.setField('district', 'Bengaluru');
    result.current.setField('pincode', '560001');
    result.current.updateInList('branches', 0, 'HQ');
  });
  api.requestOtp.mockResolvedValue({ message: 'Email OTP sent' });
  api.verifyOtp.mockResolvedValue({ message: 'Email verified', deviceToken: 'x', userExists: false, roleId: null });
  await act(async () => result.current.email.setValue('Owner@Acme.IO'));
  await waitFor(() => expect(result.current.email.canSend).toBe(true));
  await act(async () => result.current.email.sendOtp());
  await waitFor(() => expect(result.current.email.otpSent).toBe(true));
  await act(async () => result.current.email.setOtp('123456'));
  await act(async () => result.current.email.verify());
  await waitFor(() => expect(result.current.email.verified).toBe(true));
}

describe('contact verification', () => {
  it('a number verified on the login screen arrives locked; the e-mail is verified in the form', async () => {
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    expect(result.current.mobile).toMatchObject({ value: MOBILE, verified: true });
    expect(result.current.ready).toBe(false);
    await fillAndVerify(result);
    expect(api.requestOtp).toHaveBeenCalledWith({ contact: 'owner@acme.io', purpose: 'registration' });
    expect(api.verifyOtp).toHaveBeenCalledWith({ contact: 'owner@acme.io', otp: '123456', purpose: 'registration' });
    expect(result.current.ready).toBe(true);
  });

  it('a duplicate e-mail disables Get OTP with an inline message', async () => {
    api.checkEmailExists.mockResolvedValue(true);
    const { result } = await renderHook(() => useRegistration({}));
    await act(async () => result.current.email.setValue('taken@acme.io'));
    await waitFor(() => expect(result.current.email.error).toBe('Email already registered'));
    expect(result.current.email.canSend).toBe(false);
  });

  it('a failing duplicate pre-check is treated as unknown (Get OTP stays available)', async () => {
    api.checkMobileExists.mockRejectedValue(new ApiError({ status: 403, detail: 'Authentication required' }));
    const { result } = await renderHook(() => useRegistration({}));
    await act(async () => result.current.mobile.setValue(MOBILE));
    await waitFor(() => expect(result.current.mobile.checking).toBe(false));
    expect(result.current.mobile.error).toBe('');
    expect(result.current.mobile.canSend).toBe(true);
  });

  it('wrong OTP: shows the server detail and clears the boxes', async () => {
    api.requestOtp.mockResolvedValue({ message: 'sent' });
    api.verifyOtp.mockRejectedValue(new ApiError({ status: 400, detail: 'Invalid or expired registration email OTP' }));
    const { result } = await renderHook(() => useRegistration({}));
    await act(async () => result.current.email.setValue('a@b.co'));
    await waitFor(() => expect(result.current.email.canSend).toBe(true));
    await act(async () => result.current.email.sendOtp());
    await waitFor(() => expect(result.current.email.otpSent).toBe(true));
    await act(async () => result.current.email.setOtp('000000'));
    await act(async () => result.current.email.verify());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Invalid or expired registration email OTP'));
    expect(result.current.email).toMatchObject({ otp: '', otpSent: true, verified: false, verifying: false });
  });

  it('"already registered" at OTP time becomes an inline error', async () => {
    api.requestOtp.mockRejectedValue(new ApiError({ status: 400, detail: 'Mobile number already registered' }));
    const { result } = await renderHook(() => useRegistration({}));
    await act(async () => result.current.mobile.setValue(MOBILE));
    await waitFor(() => expect(result.current.mobile.canSend).toBe(true));
    await act(async () => result.current.mobile.sendOtp());
    await waitFor(() => expect(result.current.mobile.error).toBe('Mobile number already registered'));
  });
});

describe('submit', () => {
  it('registers, uploads the logo, signs in as admin and opens the dashboard', async () => {
    await setString(storageKeyFor(STORAGE_KEYS.deviceToken, MOBILE), 'dev-7');
    api.registerCompany.mockResolvedValue({ userId: 'u1', orgId: 'o1', orgName: 'Acme', roleId: 1, message: 'ok' });
    api.uploadOrgLogo.mockResolvedValue(undefined);
    (pickImage as jest.Mock).mockResolvedValue({ uri: 'file:///logo.jpg', mimeType: 'image/jpeg', fileName: 'logo.jpg' });
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await act(async () => result.current.pickLogo());
    await waitFor(() => expect(result.current.logo).not.toBeNull());

    await act(async () => result.current.submit());
    await waitFor(() => expect(getSession()?.userId).toBe('u1'));

    expect(api.registerCompany).toHaveBeenCalledWith(
      expect.objectContaining({ orgName: 'Acme', mobile: MOBILE, email: 'owner@acme.io', deviceToken: 'dev-7', branches: ['HQ'], departments: ['General'], pincode: 560001 }),
    );
    expect(api.uploadOrgLogo).toHaveBeenCalledWith('o1', { uri: 'file:///logo.jpg', fileName: 'logo.jpg', mimeType: 'image/jpeg' });
    expect(getSession()).toMatchObject({ roleId: 1, orgId: 'o1', orgName: 'Acme', email: 'owner@acme.io' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/home');
    expect(successToast).toHaveBeenCalledWith('Awesome! Welcome to Acme');
    expect(saveAttribution).toHaveBeenCalledWith({ userId: 'u1', source: 'organic' });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('a logo upload failure is reported but does not undo the registration', async () => {
    api.registerCompany.mockResolvedValue({ userId: 'u1', orgId: 'o1', orgName: 'Acme', roleId: 1, message: 'ok' });
    api.uploadOrgLogo.mockRejectedValue(new ApiError({ status: 500, detail: 'boom' }));
    (pickImage as jest.Mock).mockResolvedValue({ uri: 'file:///logo.jpg', mimeType: 'image/jpeg', fileName: 'logo.jpg' });
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await act(async () => result.current.pickLogo());
    await waitFor(() => expect(result.current.logo).not.toBeNull());
    await act(async () => result.current.submit());
    await waitFor(() => expect(getSession()?.userId).toBe('u1'));
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining('logo could not be uploaded'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/home');
  });

  it('server rejection: shows the message, keeps the form, no session', async () => {
    api.registerCompany.mockRejectedValue(new ApiError({ status: 200, message: 'User already registered', detail: 'User already registered' }));
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await act(async () => result.current.submit());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('User already registered'));
    expect(getSession()).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values.orgName).toBe('Acme');
  });

  it('network failure uses the v1 message', async () => {
    api.registerCompany.mockRejectedValue(new ApiError({ status: 0, isNetwork: true, message: 'Network connection failed.' }));
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await act(async () => result.current.submit());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Failed to save data - Server not reachable'));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('while required fields are missing the submit only shows the guard message', async () => {
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await act(async () => result.current.submit());
    expect(errorToast).toHaveBeenCalledWith('Please fill all required fields and verify mobile & email');
    expect(api.registerCompany).not.toHaveBeenCalled();
  });
});

describe('referral code', () => {
  const fillCode = async (result: Hook, text: string) => act(async () => result.current.referral.setCode(text));

  it('is optional: omitted from the request when empty', async () => {
    api.registerCompany.mockResolvedValue({ userId: 'u1', orgId: 'o1', orgName: 'Acme', roleId: 1, message: 'ok' });
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await act(async () => result.current.submit());
    await waitFor(() => expect(api.registerCompany).toHaveBeenCalled());
    expect(api.registerCompany.mock.calls[0][0].referralCode).toBeUndefined();
    expect(validateCode).not.toHaveBeenCalled();
  });

  it('normalises typing: upper-case, alphanumeric only, at most 6', async () => {
    const { result } = await renderHook(() => useRegistration({}));
    await fillCode(result, 'k7m-2qx9!');
    expect(result.current.referral.code).toBe('K7M2QX');
  });

  it('a complete code is checked and shows the referrer; the code is sent with the register request', async () => {
    validateCode.mockResolvedValue({ valid: true, referrerOrgName: 'Zed Corp', message: '' });
    api.registerCompany.mockResolvedValue({ userId: 'u1', orgId: 'o1', orgName: 'Acme', roleId: 1, message: 'ok' });
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await fillCode(result, 'k7m2qx');
    await waitFor(() => expect(result.current.referral.status).toBe('valid'));
    expect(result.current.referral.referrerOrgName).toBe('Zed Corp');
    expect(validateCode).toHaveBeenCalledWith('K7M2QX');
    expect(result.current.ready).toBe(true);
    await act(async () => result.current.submit());
    await waitFor(() => expect(api.registerCompany).toHaveBeenCalledWith(expect.objectContaining({ referralCode: 'K7M2QX' })));
  });

  it('a rejected code shows the server message, blocks Register and keeps every other field', async () => {
    validateCode.mockResolvedValue({ valid: false, referrerOrgName: '', message: 'This referral code is not valid' });
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await fillCode(result, 'ZZZ999');
    await waitFor(() => expect(result.current.referral.status).toBe('invalid'));
    expect(result.current.referral.error).toBe('This referral code is not valid');
    expect(result.current.ready).toBe(false);

    await act(async () => result.current.submit());
    expect(api.registerCompany).not.toHaveBeenCalled();
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining('This referral code is not valid'));
    expect(result.current.values).toMatchObject({ orgName: 'Acme', address: '12 MG Road', pincode: '560001', branches: ['HQ'] });
    expect(result.current.email.verified).toBe(true);

    // clearing the field unblocks the form
    await fillCode(result, '');
    expect(result.current.referral.error).toBe('');
    expect(result.current.ready).toBe(true);
  });

  it('an unfinished code blocks until it is fixed or cleared, with a message once the field was left', async () => {
    const { result } = await renderHook(() => useRegistration({}));
    await fillCode(result, 'AB1');
    expect(result.current.referral.blocking).toBe(true);
    expect(result.current.referral.error).toBe('');
    await act(async () => result.current.referral.blur());
    expect(result.current.referral.error).toBe('A referral code has 6 letters or digits');
    expect(validateCode).not.toHaveBeenCalled();
  });

  it('a newer code wins over a slow answer for an older one', async () => {
    let slow!: (v: unknown) => void;
    validateCode.mockImplementationOnce(() => new Promise((r) => (slow = r)));
    validateCode.mockResolvedValueOnce({ valid: true, referrerOrgName: 'Second Co', message: '' });
    const { result } = await renderHook(() => useRegistration({}));
    await fillCode(result, 'AAAAA2');
    await fillCode(result, 'BBBBB3');
    await waitFor(() => expect(result.current.referral.referrerOrgName).toBe('Second Co'));
    await act(async () => slow({ valid: false, referrerOrgName: '', message: 'stale' }));
    expect(result.current.referral.status).toBe('valid');
    expect(result.current.referral.error).toBe('');
  });

  it('a check that cannot run (offline) does not block; the register call decides and its refusal shows under the field', async () => {
    validateCode.mockRejectedValue(new ApiError({ status: 0, isNetwork: true, message: 'offline' }));
    api.registerCompany.mockRejectedValue(new ApiError({ status: 400, detail: 'This referral code is not valid' }));
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await fillCode(result, 'K7M2QX');
    await waitFor(() => expect(result.current.referral.status).toBe('unchecked'));
    expect(result.current.ready).toBe(true);
    await act(async () => result.current.submit());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('This referral code is not valid'));
    expect(result.current.referral.error).toBe('This referral code is not valid');
    expect(result.current.values.orgName).toBe('Acme');
  });

  it('submitting right after typing a code waits for its check', async () => {
    validateCode.mockResolvedValue({ valid: false, referrerOrgName: '', message: 'This referral code is not valid' });
    const { result } = await renderHook(() => useRegistration({ mobileNumber: MOBILE, verifiedContact: MOBILE }));
    await fillAndVerify(result);
    await act(async () => {
      result.current.referral.setCode('ZZZ999');
      result.current.submit();
    });
    await waitFor(() => expect(errorToast).toHaveBeenCalled());
    expect(api.registerCompany).not.toHaveBeenCalled();
  });
});
