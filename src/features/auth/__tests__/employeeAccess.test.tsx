import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderThemed } from '@/components/ui/testing/testUtils';
import { useAuthStore } from '@/store/auth';

import StaffLoginScreen from '../screens/StaffLoginScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import { EMPLOYEE_MOBILE_ONLY_TITLE, isEmployeeAccessBlocked } from '../utils/employeeAccess';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() };
let mockBlocked = false;

jest.mock('../hooks/useAuthMode', () => ({ useAuthMode: () => ({ mode: 'otp', loading: false }) }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => mockRouter,
    router: mockRouter,
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
    useLocalSearchParams: () => ({}),
    Redirect: () => null,
  };
});
jest.mock('../utils/employeeAccess', () => ({
  ...jest.requireActual('../utils/employeeAccess'),
  isEmployeeAccessBlocked: (...a: unknown[]) =>
    a.length > 0 ? jest.requireActual('../utils/employeeAccess').isEmployeeAccessBlocked(...a) : mockBlocked,
}));
jest.mock('@/api', () => ({
  authApi: { verifyDeviceToken: jest.fn(), requestOtp: jest.fn(), verifyOtp: jest.fn(), login: jest.fn() },
  homeApi: {},
  companyApi: {},
  attendanceApi: {},
  faceApi: {},
}));
jest.mock('@/components/layout/bootstrap/pushToken', () => ({ refreshPushToken: jest.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockBlocked = false;
  useAuthStore.setState({ session: null, hydrated: true });
});

describe('isEmployeeAccessBlocked', () => {
  it('blocks only the browser, unless the browser test build lifts it', () => {
    expect(isEmployeeAccessBlocked('web', false)).toBe(true);
    expect(isEmployeeAccessBlocked('android', false)).toBe(false);
    expect(isEmployeeAccessBlocked('ios', false)).toBe(false);
    expect(isEmployeeAccessBlocked('web', true)).toBe(false);
  });
});

describe('Employee Access in a browser', () => {
  it('opens a dialog instead of the login, and closing it stays on the welcome screen', async () => {
    mockBlocked = true;
    await renderThemed(<WelcomeScreen />);
    expect(screen.queryByTestId('employee-mobile-only-modal')).toBeNull();

    await fireEvent.press(screen.getByTestId('portal-staff'));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(await screen.findByTestId('employee-mobile-only-modal')).toBeTruthy();
    expect(screen.getByText(EMPLOYEE_MOBILE_ONLY_TITLE)).toBeTruthy();
    expect(screen.getByTestId('employee-mobile-only-message').props.children).toMatch(/Android and iOS/);

    await fireEvent.press(screen.getByTestId('employee-mobile-only-ok'));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('welcome-card')).toBeTruthy();
  });

  it('the Admin Portal still opens in a browser', async () => {
    mockBlocked = true;
    await renderThemed(<WelcomeScreen />);
    await fireEvent.press(screen.getByTestId('portal-admin'));
    expect(mockRouter.push).toHaveBeenCalledWith('/admin-login');
    expect(screen.queryByTestId('employee-mobile-only-modal')).toBeNull();
  });

  it('typing /staff-login in a browser shows the same dialog, no login form, and closing it returns to the welcome screen', async () => {
    mockBlocked = true;
    await renderThemed(<StaffLoginScreen />);
    expect(await screen.findByTestId('employee-mobile-only-modal')).toBeTruthy();
    expect(screen.queryByTestId('login-card')).toBeNull();
    expect(screen.queryByTestId('mobile-input')).toBeNull();
    await fireEvent.press(screen.getByTestId('employee-mobile-only-ok'));
    expect(mockRouter.replace.mock.calls.length + mockRouter.back.mock.calls.length).toBeGreaterThan(0);
  });
});

describe('Employee Access on a phone', () => {
  it('opens the staff login as before and shows no dialog', async () => {
    await renderThemed(<WelcomeScreen />);
    await fireEvent.press(screen.getByTestId('portal-staff'));
    expect(mockRouter.push).toHaveBeenCalledWith('/staff-login');
    expect(screen.queryByTestId('employee-mobile-only-modal')).toBeNull();
  });

  it('the staff login screen renders its form', async () => {
    await renderThemed(<StaffLoginScreen />);
    expect(screen.getByTestId('login-card')).toBeTruthy();
    expect(screen.queryByTestId('employee-mobile-only-modal')).toBeNull();
  });
});
