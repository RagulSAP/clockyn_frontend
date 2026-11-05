import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { authApi } from '@/api';
import { renderThemed } from '@/components/ui/testing/testUtils';
import { useAuthStore } from '@/store/auth';

import AdminLoginScreen from '../screens/AdminLoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import StaffLoginScreen from '../screens/StaffLoginScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() };
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = {};
let mockAuthMode: 'otp' | 'email' = 'otp';

jest.mock('../hooks/useAuthMode', () => ({ useAuthMode: () => ({ mode: mockAuthMode, loading: false }) }));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => mockRouter,
    router: mockRouter,
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
    useLocalSearchParams: () => mockParams,
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return null;
    },
  };
});
jest.mock('@/api', () => ({
  authApi: {
    verifyDeviceToken: jest.fn(),
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    login: jest.fn(),
    registerCompany: jest.fn(),
    uploadOrgLogo: jest.fn(),
    checkMobileExists: jest.fn().mockResolvedValue(false),
    checkEmailExists: jest.fn().mockResolvedValue(false),
  },
  homeApi: {},
  companyApi: {},
  attendanceApi: {},
  faceApi: {},
}));
jest.mock('@/components/layout/bootstrap/pushToken', () => ({ refreshPushToken: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/platform/media', () => ({ pickImage: jest.fn(), MediaPermissionError: class MediaPermissionError extends Error {} }));
jest.mock('@/lib/platform/notifications', () => ({ registerForPush: jest.fn().mockResolvedValue(null) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockAuthMode = 'otp';
  useAuthStore.setState({ session: null, hydrated: true });
});

describe('WelcomeScreen', () => {
  it('shows the role chooser and opens the matching login', async () => {
    await renderThemed(<WelcomeScreen />);
    expect(screen.getByText('Get Started')).toBeTruthy();
    expect(screen.getByText('Admin Portal')).toBeTruthy();
    expect(screen.getByText('Employee Access')).toBeTruthy();
    expect(screen.getByText('GPS')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('portal-admin'));
    expect(mockRouter.push).toHaveBeenCalledWith('/admin-login');
    await fireEvent.press(screen.getByTestId('portal-staff'));
    expect(mockRouter.push).toHaveBeenCalledWith('/staff-login');
  });

  it('redirects a signed-in user to the role home instead of showing the chooser', async () => {
    useAuthStore.setState({ session: { userId: 'u1', orgId: 'o1', orgName: 'Alpha', roleId: 1, managerPermissions: [] } });
    await renderThemed(<WelcomeScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/admin/home');
    expect(screen.queryByText('Get Started')).toBeNull();
  });

  it('renders nothing until the session has been read', async () => {
    useAuthStore.setState({ hydrated: false });
    await renderThemed(<WelcomeScreen />);
    expect(screen.queryByText('Get Started')).toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe.each([
  ['admin', AdminLoginScreen, 'Admin Portal'],
  ['staff', StaffLoginScreen, 'Employee Access'],
] as const)('%s login screen', (_name, Screen, badge) => {
  it('renders the number step; the action enables at 10 digits; back returns to the welcome screen', async () => {
    await renderThemed(<Screen />);
    expect(screen.getByText(badge)).toBeTruthy();
    expect(screen.getByText('Welcome Back')).toBeTruthy();
    expect(screen.getByText('Sign in with your mobile number')).toBeTruthy();
    expect(screen.getByText('Mobile Number')).toBeTruthy();
    expect(screen.getByTestId('login-action')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('mobile-input'), '98765');
    expect(screen.getByTestId('login-action')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('mobile-input'), '9876543210');
    await waitFor(() => expect(screen.getByTestId('login-action')).toBeEnabled());
    expect(screen.getByText('Get OTP')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('auth-back'));
    expect(mockRouter.back).toHaveBeenCalled();
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await fireEvent.press(screen.getByTestId('auth-back'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});

describe.each([
  ['admin', AdminLoginScreen, 1],
  ['staff', StaffLoginScreen, 3],
] as const)('%s login screen in e-mail sign-in mode', (_name, Screen, roleId) => {
  beforeEach(() => {
    mockAuthMode = 'email';
  });

  it('asks for an email address (no mobile field) and sends the code to it', async () => {
    (authApi.requestOtp as jest.Mock).mockResolvedValue({ message: 'Login email OTP sent successfully!' });
    await renderThemed(<Screen />);
    expect(screen.getByText('Sign in with your email address')).toBeTruthy();
    expect(screen.getByText('Email Address')).toBeTruthy();
    expect(screen.queryByTestId('mobile-input')).toBeNull();
    expect(screen.getByTestId('login-action')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('email-input'), 'not-an-email');
    expect(screen.getByTestId('login-action')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('email-input'), 'Person@Example.com');
    expect(screen.getByTestId('email-input').props.value).toBe('person@example.com');
    await waitFor(() => expect(screen.getByTestId('login-action')).toBeEnabled());

    await fireEvent.press(screen.getByTestId('login-action'));
    await waitFor(() => expect(authApi.requestOtp).toHaveBeenCalledWith({ contact: 'person@example.com', purpose: 'login', roleId }));
    await waitFor(() => expect(screen.getByTestId('otp-input')).toBeTruthy());
    expect(screen.getByText('We emailed a code to person@example.com')).toBeTruthy();
    expect(screen.getByText('Change email')).toBeTruthy();
  });
});

describe('RegisterScreen', () => {
  it('renders the form with the Register button disabled', async () => {
    await renderThemed(<RegisterScreen />);
    expect(screen.getAllByText('Register Company').length).toBeGreaterThanOrEqual(2); // header + button
    expect(screen.getByText('Fill in your company details to get started')).toBeTruthy();
    expect(screen.getByText('Company Logo')).toBeTruthy();
    expect(screen.getByTestId('register-submit')).toBeDisabled();
    expect(screen.getByTestId('reg-mobile-get-otp')).toBeDisabled();
    expect(screen.getByTestId('reg-email-get-otp')).toBeDisabled();
  });

  it('locks a number that was verified on the login screen', async () => {
    mockParams = { mobileNumber: '9876543210', verifiedContact: '9876543210' };
    await renderThemed(<RegisterScreen />);
    expect(screen.getByTestId('reg-mobile-verified')).toBeTruthy();
    expect(screen.queryByTestId('reg-mobile-get-otp')).toBeNull();
    expect(screen.getByTestId('reg-email-get-otp')).toBeDisabled();
  });

  it('e-mail sign-in: the mobile number is a plain field and only the e-mail gets an OTP', async () => {
    mockAuthMode = 'email';
    await renderThemed(<RegisterScreen />);
    expect(screen.getByText('We verify your e-mail with a one-time code. You will sign in with it.')).toBeTruthy();
    expect(screen.getByTestId('reg-mobile-input')).toBeTruthy();
    expect(screen.queryByTestId('reg-mobile-get-otp')).toBeNull();
    expect(screen.getByTestId('reg-email-get-otp')).toBeDisabled();
  });

  it('e-mail sign-in: an e-mail verified on the login screen arrives locked', async () => {
    mockAuthMode = 'email';
    mockParams = { emailAddress: 'Boss@Example.com', verifiedContact: 'boss@example.com' };
    await renderThemed(<RegisterScreen />);
    expect(screen.getByTestId('reg-email-verified')).toBeTruthy();
    expect(screen.queryByTestId('reg-email-get-otp')).toBeNull();
  });

  it('adds and removes branch rows; shows statutory format errors without blocking', async () => {
    await renderThemed(<RegisterScreen />);
    expect(screen.queryByTestId('reg-branches-remove-0')).toBeNull();
    await fireEvent.press(screen.getByTestId('reg-branches-add'));
    expect(screen.getByTestId('reg-branches-1')).toBeTruthy();
    expect(screen.getByTestId('reg-branches-remove-0')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reg-branches-remove-1'));
    expect(screen.queryByTestId('reg-branches-1')).toBeNull();

    expect(screen.queryByTestId('reg-pan')).toBeNull();
    await fireEvent.press(screen.getByTestId('reg-toggle-more'));
    await fireEvent.changeText(screen.getByTestId('reg-pan'), 'abcde123');
    expect(screen.getByTestId('reg-pan').props.value).toBe('ABCDE123');
    expect(screen.getByText('Invalid PAN format (e.g., ABCDE1234F)')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reg-pan'), 'ABCDE1234F');
    expect(screen.queryByText('Invalid PAN format (e.g., ABCDE1234F)')).toBeNull();
    expect(screen.getByText('Hide Additional Details')).toBeTruthy();
  });

  it('only digits are kept in the pincode and an invalid one shows an inline message after leaving the field', async () => {
    await renderThemed(<RegisterScreen />);
    const pin = screen.getByTestId('reg-pincode');
    await fireEvent.changeText(pin, '56a00');
    expect(pin.props.value).toBe('5600');
    await fireEvent(pin, 'blur');
    expect(screen.getByText('Enter a valid 6-digit pincode')).toBeTruthy();
  });
});
