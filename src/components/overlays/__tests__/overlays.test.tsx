import React from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';

import { requestPermission } from '@/lib/platform/permissions';
import { STORAGE_KEYS } from '@/lib/storage';
import { useAuthStore, type Session } from '@/store/auth';
import { renderThemed } from '@/components/ui/testing/testUtils';
import { onboardingKeyFor, PermissionOnboarding, RateAppModal, rateCtaLabel, usePermissionOnboarding } from '..';

const mockEnv = { androidStoreUrl: 'https://store.example/clockyn', iosStoreUrl: 'https://store.example/clockyn' };
// getter: the factory runs lazily, after the module-level const below is initialised
jest.mock('@/config/env', () => ({
  get env() {
    return mockEnv;
  },
}));
jest.mock('@/lib/platform/permissions', () => ({ requestPermission: jest.fn(async () => true) }));

const mockedRequest = requestPermission as jest.Mock;

const session = (userId: string): Session =>
  ({ userId, orgId: userId, orgName: 'Org', roleId: 1, managerPermissions: [] }) as Session;

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  await AsyncStorage.clear();
  mockEnv.androidStoreUrl = mockEnv.iosStoreUrl = 'https://store.example/clockyn';
  mockedRequest.mockClear();
  jest.restoreAllMocks();
});

describe('RateAppModal', () => {
  it('renders nothing when hidden', async () => {
    await renderThemed(<RateAppModal visible={false} onClose={() => {}} />);
    expect(screen.queryByText('Enjoying Clockyn?')).toBeNull();
  });

  it('labels the CTA by star count', () => {
    expect(rateCtaLabel(0)).toBe('Rate Us');
    expect(rateCtaLabel(2)).toBe('Submit Rating');
    expect(rateCtaLabel(4)).toBe('Love it — Rate on Store');
  });

  it('starts at 0 stars with a disabled "Rate Us" CTA and snoozes on "Maybe later"', async () => {
    const onClose = jest.fn();
    await renderThemed(<RateAppModal visible onClose={onClose} />);
    expect(screen.getByText('Enjoying Clockyn?')).toBeTruthy();
    expect(screen.getByText('Rate Us')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('rate-later'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppSnoozedAt)).not.toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppDone)).toBeNull();
  });

  it('opens the store, marks done and shows the thank-you view, then closes', async () => {
    jest.useFakeTimers();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const onClose = jest.fn();
    await renderThemed(<RateAppModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByTestId('rate-star-4'));
    expect(screen.getByText('Love it — Rate on Store')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('rate-cta'));
    await waitFor(() => expect(screen.getByText('Thank you!')).toBeTruthy());
    expect(open).toHaveBeenCalledWith('https://store.example/clockyn');
    expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppDone)).toBe('true');
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('hides the store button when no store URL is configured', async () => {
    mockEnv.androidStoreUrl = mockEnv.iosStoreUrl = '';
    await renderThemed(<RateAppModal visible onClose={() => {}} />);
    expect(screen.queryByTestId('rate-cta')).toBeNull();
    expect(screen.getByTestId('rate-later')).toBeTruthy();
  });
});

describe('PermissionOnboarding', () => {
  const renderFlow = async (role: 'admin' | 'staff' = 'staff') => {
    const onComplete = jest.fn();
    await renderThemed(<PermissionOnboarding visible role={role} onComplete={onComplete} />);
    return onComplete;
  };

  it('renders nothing when hidden', async () => {
    await renderThemed(<PermissionOnboarding visible={false} role="admin" onComplete={() => {}} />);
    expect(screen.queryByText('App Permissions')).toBeNull();
  });

  it('shows role-specific intro copy', async () => {
    await renderFlow('admin');
    expect(screen.getByText('Clockyn needs a few permissions to help you manage your organization smoothly.')).toBeTruthy();
  });

  it('walks the four steps, requests only notifications, and finishes once', async () => {
    const onComplete = await renderFlow('staff');
    expect(screen.getByText('Clockyn needs a few permissions to work properly for attendance tracking.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('onboarding-primary')); // Continue
    expect(screen.getByText('STEP 1 OF 4')).toBeTruthy();
    expect(screen.getByText('Location Access')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-primary')); // Next
    expect(screen.getByText('STEP 2 OF 4')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-primary')); // Next
    expect(screen.getByText('STEP 3 OF 4')).toBeTruthy();
    expect(mockedRequest).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Enable Notifications'));
    await waitFor(() => expect(screen.getByText('STEP 4 OF 4')).toBeTruthy());
    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(mockedRequest).toHaveBeenCalledWith('notifications');

    expect(screen.getByText('Finish')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('advances even when the notification request is denied or throws', async () => {
    mockedRequest.mockRejectedValueOnce(new Error('boom'));
    await renderFlow();
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    await waitFor(() => expect(screen.getByText('STEP 4 OF 4')).toBeTruthy());
  });

  it('"Not now" advances without a prompt; Back returns to the intro from step 1', async () => {
    await renderFlow();
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByText('App Permissions')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    await fireEvent.press(screen.getByTestId('onboarding-primary'));
    await fireEvent.press(screen.getByTestId('onboarding-not-now'));
    expect(screen.getByText('STEP 4 OF 4')).toBeTruthy();
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('skip buttons complete immediately with no OS prompt', async () => {
    const a = await renderFlow();
    await fireEvent.press(screen.getByTestId('onboarding-skip-now'));
    expect(a).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('onboarding-skip'));
    expect(a).toHaveBeenCalledTimes(1); // guarded: once per showing
    expect(mockedRequest).not.toHaveBeenCalled();
  });
});

describe('usePermissionOnboarding', () => {
  afterEach(() => {
    useAuthStore.setState({ session: null });
  });

  it('is hidden without a session', async () => {
    const { result } = await renderHook(() => usePermissionOnboarding({ delayMs: 0 }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.visible).toBe(false);
  });

  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

  it('shows for a new user and persists completion under a per-user key', async () => {
    useAuthStore.setState({ session: session('u1') });
    const { result } = await renderHook(() => usePermissionOnboarding({ delayMs: 0 }));
    await waitFor(() => expect(result.current.visible).toBe(true));
    await act(async () => result.current.complete());
    expect(result.current.visible).toBe(false);
    await waitFor(async () => expect(await AsyncStorage.getItem(onboardingKeyFor('u1'))).toBe('true'));
    expect(onboardingKeyFor('u1')).not.toBe(onboardingKeyFor('u2'));
  });

  it('stays hidden for a user who already completed it', async () => {
    await AsyncStorage.setItem(onboardingKeyFor('u1'), 'true');
    useAuthStore.setState({ session: session('u1') });
    const { result } = await renderHook(() => usePermissionOnboarding({ delayMs: 0 }));
    await settle();
    expect(result.current.visible).toBe(false);
  });

  it('still shows for another user on the same device (v1: a second admin never saw it)', async () => {
    await AsyncStorage.setItem(onboardingKeyFor('u1'), 'true');
    useAuthStore.setState({ session: session('u2') });
    const { result } = await renderHook(() => usePermissionOnboarding({ delayMs: 0 }));
    await waitFor(() => expect(result.current.visible).toBe(true));
  });
});
