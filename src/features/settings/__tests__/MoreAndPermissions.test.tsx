import React from 'react';
import { BackHandler, Platform } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth';

import MoreOptionsScreen from '../screens/MoreOptionsScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import { renderScreen, signInTestAdmin } from './testHelpers';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/config/env', () => ({
  env: { apiBaseUrl: 'https://api.test', supportEmail: '', salesEmail: '', privacyPolicyUrl: '', webPortalUrl: '', androidStoreUrl: '', iosStoreUrl: '' },
  wsBaseUrl: 'wss://api.test',
}));

jest.mock('@/lib/platform/WebPage', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { WebPage: ({ url, testID }: { url: string; testID?: string }) => <View testID={testID} accessibilityLabel={url} /> };
});

const mockRequestDeletion = jest.fn();
jest.mock('@/api', () => ({ systemApi: { requestAccountDeletion: (...a: unknown[]) => mockRequestDeletion(...a) } }));

const mockSignOut = jest.fn();
jest.mock('@/store/auth', () => ({ ...jest.requireActual('@/store/auth'), signOut: (...a: unknown[]) => mockSignOut(...a) }));

const mockPerm = { getPermissionDetail: jest.fn(), requestPermission: jest.fn(), openAppSettings: jest.fn() };
jest.mock('@/lib/platform/permissions', () => ({
  getPermissionDetail: (...a: unknown[]) => mockPerm.getPermissionDetail(...a),
  requestPermission: (...a: unknown[]) => mockPerm.requestPermission(...a),
  openAppSettings: (...a: unknown[]) => mockPerm.openAppSettings(...a),
}));
const mockRequestLocation = jest.fn();
jest.mock('@/lib/platform/location', () => ({ requestLocationPermission: (...a: unknown[]) => mockRequestLocation(...a) }));

const mutableEnv = env as { privacyPolicyUrl: string };
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  signInTestAdmin();
  mutableEnv.privacyPolicyUrl = '';
  mockSignOut.mockResolvedValue(undefined);
  jest.replaceProperty(Platform, 'OS', 'android');
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

// The deletion flow schedules its sign-out (1.5 s) outside the component on purpose; let it fire before the worker exits.
afterAll(() => new Promise<void>((resolve) => setTimeout(resolve, 1700)));

describe('MoreOptionsScreen', () => {
  it('opens the privacy policy view with a graceful "not configured" state and the deletion button', async () => {
    await renderScreen(<MoreOptionsScreen />);
    expect(screen.getByText('More Options')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-privacy'));
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByTestId('privacy-not-configured')).toBeTruthy();
    expect(screen.getByText('Request Account Deletion')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('privacy-back'));
    expect(screen.getByText('More Options')).toBeTruthy();
  });

  it('Android hardware back on the privacy page returns to the menu first (settings F9)', async () => {
    const add = jest.spyOn(BackHandler, 'addEventListener');
    await renderScreen(<MoreOptionsScreen />);
    await fireEvent.press(screen.getByTestId('open-privacy'));
    expect(screen.getByTestId('privacy-screen')).toBeTruthy();
    const handler = add.mock.calls[add.mock.calls.length - 1][1] as () => boolean;
    await act(async () => {
      expect(handler()).toBe(true); // handled: switches back to the menu instead of leaving the route
    });
    expect(screen.getByTestId('more-screen')).toBeTruthy();
    expect(screen.queryByTestId('privacy-screen')).toBeNull();
  });

  it('embeds the configured privacy policy page', async () => {
    mutableEnv.privacyPolicyUrl = 'https://example.com/privacy';
    await renderScreen(<MoreOptionsScreen />);
    await fireEvent.press(screen.getByTestId('open-privacy'));
    expect(screen.getByTestId('privacy-webpage').props.accessibilityLabel).toBe('https://example.com/privacy');
    expect(screen.queryByTestId('privacy-not-configured')).toBeNull();
  });

  it('deletion request: confirm → POST → success toast, session marked inactive; cancel sends nothing', async () => {
    mockRequestDeletion.mockResolvedValue({ message: 'Request received' });
    await renderScreen(<MoreOptionsScreen />);
    await fireEvent.press(screen.getByTestId('open-privacy'));

    await fireEvent.press(screen.getByTestId('request-deletion'));
    expect(await screen.findByText('Your deletion request will be sent to the admin. Once reviewed, all your data will be permanently deleted.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockRequestDeletion).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('request-deletion'));
    await fireEvent.press(await screen.findByText('Submit Request'));
    expect(await screen.findByText('Request received')).toBeTruthy();
    expect(mockRequestDeletion).toHaveBeenCalledWith('user-1');
    expect(useAuthStore.getState().session?.isActive).toBe(0);
    expect(screen.getByTestId('request-deletion')).toBeDisabled();
  });

  it('a failed deletion request keeps the user signed in and shows the error', async () => {
    mockRequestDeletion.mockRejectedValue(new Error('Request already pending'));
    await renderScreen(<MoreOptionsScreen />);
    await fireEvent.press(screen.getByTestId('open-privacy'));
    await fireEvent.press(screen.getByTestId('request-deletion'));
    await fireEvent.press(await screen.findByText('Submit Request'));
    expect(await screen.findByText('Request already pending')).toBeTruthy();
    expect(useAuthStore.getState().session?.isActive).not.toBe(0);
    expect(mockSignOut).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('request-deletion')).toBeEnabled());
  });
});

describe('PermissionsScreen', () => {
  const detail = (status: 'granted' | 'denied' | 'undetermined', canAskAgain = true) => ({ status, canAskAgain });

  beforeEach(() => {
    mockPerm.getPermissionDetail.mockImplementation(async (kind: string) => {
      if (kind === 'camera') return detail('granted');
      if (kind === 'location') return detail('denied', false);
      return detail('undetermined');
    });
    mockPerm.requestPermission.mockResolvedValue(true);
    mockRequestLocation.mockResolvedValue(true);
  });

  it('shows the status of each permission, the summary count and pending pill', async () => {
    await renderScreen(<PermissionsScreen />);
    expect(await screen.findByText('1 of 4 permissions granted')).toBeTruthy();
    expect(screen.getByTestId('permissions-pill')).toHaveTextContent('3 Pending');
    expect(screen.getByTestId('permission-state-camera')).toHaveTextContent('ON');
    expect(screen.getByTestId('permission-state-location')).toHaveTextContent('OFF');
    expect(screen.queryByTestId('permission-action-camera')).toBeNull();
    expect(screen.getByText('Permissions are controlled by your device. Tap any card to open settings.')).toBeTruthy();
  });

  it('Allow requests the permission and re-reads the status', async () => {
    await renderScreen(<PermissionsScreen />);
    await fireEvent.press(await screen.findByTestId('permission-action-notifications'));
    expect(mockPerm.requestPermission).toHaveBeenCalledWith('notifications');
    await waitFor(() => expect(mockPerm.getPermissionDetail.mock.calls.length).toBeGreaterThan(4));
  });

  it('a permanently denied permission opens the device settings', async () => {
    await renderScreen(<PermissionsScreen />);
    await fireEvent.press(await screen.findByTestId('permission-action-location'));
    expect(mockPerm.openAppSettings).toHaveBeenCalledTimes(1);
    expect(mockPerm.requestPermission).not.toHaveBeenCalled();
  });

  it('Android also asks for background location after the foreground grant', async () => {
    mockPerm.getPermissionDetail.mockImplementation(async () => detail('undetermined'));
    await renderScreen(<PermissionsScreen />);
    await fireEvent.press(await screen.findByTestId('permission-action-location'));
    await waitFor(() => expect(mockRequestLocation).toHaveBeenCalledWith('background'));
  });

  it('Android opens the device settings when the background grant is refused, and not when it is given', async () => {
    mockPerm.getPermissionDetail.mockImplementation(async () => detail('undetermined'));
    mockRequestLocation.mockResolvedValueOnce(false);
    await renderScreen(<PermissionsScreen />);
    await fireEvent.press(await screen.findByTestId('permission-action-location'));
    await waitFor(() => expect(mockPerm.openAppSettings).toHaveBeenCalledTimes(1));

    mockPerm.openAppSettings.mockClear();
    mockRequestLocation.mockResolvedValueOnce(true);
    await fireEvent.press(await screen.findByTestId('permission-action-location'));
    await waitFor(() => expect(mockRequestLocation).toHaveBeenCalledTimes(2));
    expect(mockPerm.openAppSettings).not.toHaveBeenCalled();
  });

  it('iOS never asks for background location', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockPerm.getPermissionDetail.mockImplementation(async () => detail('undetermined'));
    await renderScreen(<PermissionsScreen />);
    await fireEvent.press(await screen.findByTestId('permission-action-location'));
    await waitFor(() => expect(mockPerm.requestPermission).toHaveBeenCalledWith('location'));
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it('a blocked permission in a browser explains how to change the site setting', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await renderScreen(<PermissionsScreen />);
    await fireEvent.press(await screen.findByTestId('permission-action-location'));
    expect(await screen.findByText(/browser's site settings/)).toBeTruthy();
    expect(mockPerm.openAppSettings).not.toHaveBeenCalled();
  });

  it('shows "All Active" when everything is granted', async () => {
    mockPerm.getPermissionDetail.mockImplementation(async () => detail('granted'));
    await renderScreen(<PermissionsScreen />);
    expect(await screen.findByText('4 of 4 permissions granted')).toBeTruthy();
    expect(screen.getByTestId('permissions-pill')).toHaveTextContent('All Active');
  });
});
