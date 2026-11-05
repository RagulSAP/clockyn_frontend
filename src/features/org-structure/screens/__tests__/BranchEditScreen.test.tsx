import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { branchesApi } from '@/api';
import { getCurrentPosition, requestLocationPermission } from '@/lib/platform/location';
import type { Branch } from '@/types/api/branches';

import BranchEditScreen from '../BranchEditScreen';
import { renderWithProviders, signInAs } from '../../testing/harness';

jest.mock('@/lib/platform/notifications', () => ({ registerForPush: jest.fn(), subscribePushEvents: jest.fn(), showLocalNotification: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: () => undefined,
}));
jest.mock('@/api', () => ({
  branchesApi: { listBranches: jest.fn(), addBranch: jest.fn(), updateBranch: jest.fn() },
}));
jest.mock('@/lib/platform/maps', () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories cannot use top-level imports */
  const R = require('react');
  const { Pressable } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    // Tapping the fake map reports a fixed coordinate through the real `onMapPress` contract.
    ClockynMap: (p: { testID?: string; onMapPress?: (lat: number, lng: number) => void }) =>
      R.createElement(Pressable, { testID: p.testID, onPress: () => p.onMapPress?.(10.5, 20.25) }),
  };
});
jest.mock('@/lib/platform/location', () => {
  class LocationError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { LocationError, getCurrentPosition: jest.fn(), requestLocationPermission: jest.fn() };
});
jest.mock('@/lib/platform/geocode', () => ({ reverseGeocode: jest.fn().mockResolvedValue('MG Road, Chennai') }));
jest.mock('@/lib/platform/permissions', () => ({ openAppSettings: jest.fn() }));

const api = branchesApi as jest.Mocked<typeof branchesApi>;
const permission = requestLocationPermission as jest.Mock;
const position = getCurrentPosition as jest.Mock;
const existing: Branch = { id: '7', name: 'Pune', address: 'FC Road', orgId: 'org-1', latitude: 18.52, longitude: 73.85, radius: 500, raw: {} };

beforeEach(() => {
  jest.clearAllMocks();
  signInAs();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  api.listBranches.mockResolvedValue([existing]);
  permission.mockResolvedValue(true);
});

describe('BranchEditScreen (add)', () => {
  it('shows the three v1 validation messages and sends nothing', async () => {
    await renderWithProviders(<BranchEditScreen />);
    await fireEvent.press(screen.getByTestId('branch-submit'));
    expect(await screen.findByText('Branch name is required')).toBeTruthy();
    expect(screen.getByText('Branch address is required')).toBeTruthy();
    expect(screen.getByText('Please select GPS location')).toBeTruthy();
    expect(api.addBranch).not.toHaveBeenCalled();
    // typing clears the matching error immediately
    await fireEvent.changeText(screen.getByTestId('branch-name'), 'Chennai HQ');
    await waitFor(() => expect(screen.queryByText('Branch name is required')).toBeNull());
  });

  it('opens the picker at the current GPS fix and saves the branch with the chosen radius', async () => {
    position.mockResolvedValue({ latitude: 13.0827, longitude: 80.2707 });
    api.addBranch.mockResolvedValue({ branchId: '9', branchName: 'Chennai HQ', message: 'ok' });
    await renderWithProviders(<BranchEditScreen />);
    await fireEvent.changeText(screen.getByTestId('branch-name'), '  Chennai HQ ');
    await fireEvent.changeText(screen.getByTestId('branch-address'), '12 MG Road');
    await fireEvent.press(screen.getByTestId('branch-gps'));

    // The confirm button is available as soon as a pin exists (no extra tap needed).
    const confirm = await screen.findByTestId('location-picker-confirm');
    expect(screen.getByText('Save Location')).toBeTruthy();
    expect(await screen.findByText('13.082700, 80.270700')).toBeTruthy();
    await fireEvent.press(confirm);
    expect(await screen.findByText('13.082700, 80.270700')).toBeTruthy();

    await fireEvent.press(screen.getByText('750m'));
    await fireEvent.press(screen.getByTestId('branch-submit'));
    await waitFor(() =>
      expect(api.addBranch).toHaveBeenCalledWith({ orgId: 'org-1', name: '  Chennai HQ ', address: '12 MG Road', latitude: 13.0827, longitude: 80.2707, radius: 750 }),
    );
    expect(await screen.findByText('Branch added successfully')).toBeTruthy();
  });

  it('lets the pin be set by tapping the map when the GPS fix fails, and fills an empty address', async () => {
    position.mockRejectedValue(new Error('timeout'));
    await renderWithProviders(<BranchEditScreen />);
    await fireEvent.press(screen.getByTestId('branch-gps'));
    expect(await screen.findByText('Failed to get location')).toBeTruthy();
    // No pin yet: confirm is disabled until the map is tapped.
    expect(screen.getByText('Tap on the map to set the exact location')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('location-picker-map'));
    expect(await screen.findByText('10.500000, 20.250000')).toBeTruthy();
    expect(await screen.findByText('MG Road, Chennai')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('location-picker-confirm'));
    await waitFor(() => expect(screen.getByTestId('branch-address').props.value).toBe('MG Road, Chennai'));
  });

  it('asks to open settings and does not open the map when permission is denied (native)', async () => {
    permission.mockResolvedValue(false);
    await renderWithProviders(<BranchEditScreen />);
    await fireEvent.press(screen.getByTestId('branch-gps'));
    expect(await screen.findByText('Location Permission Required')).toBeTruthy();
    expect(screen.queryByTestId('location-picker-confirm')).toBeNull();
  });

  it('shows the server message when saving fails and keeps the form', async () => {
    position.mockResolvedValue({ latitude: 1, longitude: 2 });
    api.addBranch.mockRejectedValue(new Error('Branch name already exists'));
    await renderWithProviders(<BranchEditScreen />);
    await fireEvent.changeText(screen.getByTestId('branch-name'), 'Dup');
    await fireEvent.changeText(screen.getByTestId('branch-address'), 'Somewhere');
    await fireEvent.press(screen.getByTestId('branch-gps'));
    await fireEvent.press(await screen.findByTestId('location-picker-confirm'));
    await fireEvent.press(screen.getByTestId('branch-submit'));
    expect(await screen.findByText('Branch name already exists')).toBeTruthy();
    expect(screen.getByTestId('branch-name').props.value).toBe('Dup');
  });
});

describe('BranchEditScreen (edit)', () => {
  beforeEach(() => (useLocalSearchParams as jest.Mock).mockReturnValue({ branchId: '7' }));

  it('prefills the stored values, starts the map at the stored coordinates and updates through PUT', async () => {
    api.updateBranch.mockResolvedValue({ branchId: '7', branchName: 'Pune', message: 'ok' });
    await renderWithProviders(<BranchEditScreen />);
    await waitFor(() => expect(screen.getByTestId('branch-name').props.value).toBe('Pune'));
    expect(screen.getByTestId('branch-address').props.value).toBe('FC Road');
    expect(screen.getByText('18.520000, 73.850000')).toBeTruthy();
    expect(screen.getByText('Update Branch')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('branch-gps'));
    expect(await screen.findByText('Update Location')).toBeTruthy();
    expect(position).not.toHaveBeenCalled(); // no fresh fix in edit mode
    await fireEvent.press(screen.getByTestId('location-picker-confirm'));

    await fireEvent.changeText(screen.getByTestId('branch-name'), 'Pune East');
    await fireEvent.press(screen.getByTestId('branch-submit'));
    await waitFor(() =>
      expect(api.updateBranch).toHaveBeenCalledWith('7', { orgId: 'org-1', name: 'Pune East', address: 'FC Road', latitude: 18.52, longitude: 73.85, radius: 500 }),
    );
    expect(await screen.findByText('Branch updated successfully')).toBeTruthy();
  });

  it('reports a branch that no longer exists', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ branchId: 'gone' });
    await renderWithProviders(<BranchEditScreen />);
    expect(await screen.findByText('Branch not found')).toBeTruthy();
  });
});
