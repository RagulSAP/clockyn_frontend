/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { companyApi } from '@/api';
import { ApiError, networkError, timeoutError } from '@/lib/api/errors';
import { openAppSettings, getPermissionDetail, requestPermission } from '@/lib/platform/permissions';
import { signOut } from '@/store/auth';

import AppPermissionsScreen from '../screens/AppPermissionsScreen';
import MoreOptionsScreen, { deleteFailureMessage } from '../screens/MoreOptionsScreen';
import StaffSettingsScreen from '../screens/StaffSettingsScreen';
import { managerSession, renderScreen, routerPush, signInAs, staffSession, mockOf as m } from './harness';

jest.mock('expo-router', () => require('./harness').routerMock());
jest.mock('@/components/layout', () => require('./harness').layoutMock());
jest.mock('@/api', () => ({ companyApi: { deleteAccount: jest.fn() } }));
jest.mock('@/lib/platform/permissions', () => ({
  getPermissionDetail: jest.fn(),
  requestPermission: jest.fn(),
  openAppSettings: jest.fn(),
}));
jest.mock('@/store/auth', () => ({
  ...jest.requireActual('@/store/auth'),
  signOut: jest.fn(async () => undefined),
}));


beforeEach(() => {
  jest.clearAllMocks();
});

describe('StaffSettingsScreen', () => {
  it('shows only General Settings, More Options and Logout to staff (no admin block)', async () => {
    signInAs({ ...staffSession, managerPermissions: ['Staff Management'] });
    await renderScreen(<StaffSettingsScreen />);
    expect(screen.getByText('General Settings')).toBeTruthy();
    expect(screen.getByText('Profile Settings')).toBeTruthy();
    expect(screen.getByText('App Permissions')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('More Options')).toBeTruthy();
    expect(screen.getByText('Logout')).toBeTruthy();
    expect(screen.queryByText('Admin Settings')).toBeNull();
  });

  it('shows a manager exactly the granted shortcuts and opens sub-menus before navigating', async () => {
    signInAs(managerSession);
    await renderScreen(<StaffSettingsScreen />);
    expect(screen.getByText('Admin Settings')).toBeTruthy();
    expect(screen.getByTestId('shortcut-Staff Management')).toBeTruthy();
    expect(screen.getByTestId('shortcut-Requests Management')).toBeTruthy();
    expect(screen.getByTestId('shortcut-Salary Management')).toBeTruthy();
    expect(screen.queryByTestId('shortcut-Branch Management')).toBeNull();

    await fireEvent.press(screen.getByTestId('shortcut-Requests Management'));
    expect(routerPush).toHaveBeenCalledWith('/admin/requests');

    await fireEvent.press(screen.getByTestId('shortcut-Staff Management'));
    await fireEvent.press(await screen.findByTestId('option-View Staff'));
    expect(routerPush).toHaveBeenCalledWith('/admin/staff');
  });

  it('navigates to the profile, permissions and more screens', async () => {
    signInAs(staffSession);
    await renderScreen(<StaffSettingsScreen />);
    await fireEvent.press(screen.getByTestId('row-profile'));
    expect(routerPush).toHaveBeenLastCalledWith('/staff/profile');
    await fireEvent.press(screen.getByTestId('row-permissions'));
    expect(routerPush).toHaveBeenLastCalledWith('/staff/permissions');
    await fireEvent.press(screen.getByTestId('row-more'));
    expect(routerPush).toHaveBeenLastCalledWith('/staff/more');
  });

  it('logs out only after confirming', async () => {
    signInAs(staffSession);
    await renderScreen(<StaffSettingsScreen />);
    await fireEvent.press(screen.getByTestId('logout'));
    expect(await screen.findByText('Confirm Logout')).toBeTruthy();
    expect(screen.getByText('Are you sure you want to logout?')).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(signOut).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('logout'));
    await screen.findByText('Confirm Logout');
    // the dialog's confirm button is the last "Logout" in the tree (the first is the screen button)
    await fireEvent.press(screen.getAllByText('Logout').slice(-1)[0]);
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});

describe('AppPermissionsScreen', () => {
  it('lists Location, Camera and Notifications with Enabled / Disabled and opens the OS settings', async () => {
    signInAs(staffSession);
    m(getPermissionDetail).mockImplementation(async (k: string) =>
      k === 'location' ? { status: 'granted', canAskAgain: true } : k === 'camera' ? { status: 'denied', canAskAgain: false } : { status: 'denied', canAskAgain: false },
    );
    await renderScreen(<AppPermissionsScreen />);
    await waitFor(() => expect(screen.getAllByText('Disabled')).toHaveLength(2));
    expect(screen.getAllByText('Enabled')).toHaveLength(1);
    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.getByText('Camera')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('permission-camera'));
    expect(openAppSettings).toHaveBeenCalledTimes(1);
  });

  it('shows the system prompt for a permission that was never asked', async () => {
    signInAs(staffSession);
    m(getPermissionDetail).mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    m(requestPermission).mockResolvedValue(true);
    await renderScreen(<AppPermissionsScreen />);
    await waitFor(() => expect(screen.getAllByText('Disabled')).toHaveLength(3));
    await fireEvent.press(screen.getByTestId('permission-notifications'));
    await waitFor(() => expect(requestPermission).toHaveBeenCalledWith('notifications'));
    expect(openAppSettings).not.toHaveBeenCalled();
  });
});

describe('MoreOptionsScreen', () => {
  it('does nothing when the deletion is cancelled', async () => {
    signInAs(staffSession);
    await renderScreen(<MoreOptionsScreen />);
    expect(screen.getByText('Delete My Account')).toBeTruthy();
    expect(screen.getByText('Permanently remove your account & data')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(await screen.findByText('Delete Account?')).toBeTruthy();
    expect(screen.getByText('This will permanently delete your account and all associated data. This action cannot be undone.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(companyApi.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account after confirming, then signs out', async () => {
    signInAs(staffSession);
    m(companyApi.deleteAccount).mockResolvedValue({ message: 'ok' });
    await renderScreen(<MoreOptionsScreen />);
    await fireEvent.press(screen.getByTestId('delete-account'));
    await fireEvent.press(await screen.findByText('Delete'));
    await waitFor(() => expect(companyApi.deleteAccount).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Account deleted successfully')).toBeTruthy();
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ reason: 'deleted' }), { timeout: 4000 });
  });

  it('shows the server message and stays signed in when the deletion is refused', async () => {
    signInAs(staffSession);
    m(companyApi.deleteAccount).mockRejectedValue(new ApiError({ status: 400, message: 'Cannot delete right now', detail: 'Cannot delete right now' }));
    await renderScreen(<MoreOptionsScreen />);
    await fireEvent.press(screen.getByTestId('delete-account'));
    await fireEvent.press(await screen.findByText('Delete'));
    expect(await screen.findByText('Cannot delete right now')).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('uses the v1 copy when the refusal carries no message or the request fails outright', async () => {
    expect(deleteFailureMessage(new ApiError({ status: 500 }))).toBe('Failed to delete account');
    expect(deleteFailureMessage(networkError())).toBe('Error deleting account');
    expect(deleteFailureMessage(timeoutError())).toBe('Error deleting account');
    expect(deleteFailureMessage(new Error('boom'))).toBe('Error deleting account');
  });

  it('shows "Error deleting account" on a network failure and stays on the page', async () => {
    signInAs(staffSession);
    m(companyApi.deleteAccount).mockRejectedValue(networkError());
    await renderScreen(<MoreOptionsScreen />);
    await fireEvent.press(screen.getByTestId('delete-account'));
    await fireEvent.press(await screen.findByText('Delete'));
    expect(await screen.findByText('Error deleting account')).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
  });
});
