import React from 'react';
import { configure, fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as branchesModule from '@/api/branches';
import * as locationModule from '@/api/location';
import * as plansModule from '@/api/plans';
import type { StaffLocation } from '@/types/api/location';

import StaffLocationScreen from '../screens/StaffLocationScreen';
import { renderScreen, signInAs } from '../testing/renderScreen';

configure({ asyncUtilTimeout: 5000 });

const mockPush = jest.fn();
const mockMap = jest.fn();

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(cb, []);
  },
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/api/location');
jest.mock('@/api/branches');
jest.mock('@/api/plans');
jest.mock('@/lib/platform/location', () => ({ getCurrentPosition: jest.fn().mockRejectedValue(new Error('denied')) }));
jest.mock('@/lib/platform/maps', () => ({
  ClockynMap: (props: unknown) => {
    mockMap(props);
    return null;
  },
}));

const location = locationModule as jest.Mocked<typeof locationModule>;
const branches = branchesModule as jest.Mocked<typeof branchesModule>;
const plans = plansModule as jest.Mocked<typeof plansModule>;

const ago = (min: number): string => new Date(Date.now() - min * 60_000).toISOString();
const staff = (over: Partial<StaffLocation>): StaffLocation => ({
  userId: 'u1',
  name: 'Asha Verma',
  empId: 'E1',
  branch: 'Chennai',
  department: 'Sales',
  latitude: 13.08,
  longitude: 80.27,
  updatedAt: ago(3),
  punchIn: '09:00',
  raw: {},
  ...over,
});

const lastMarkers = (): { id: string; color?: string }[] => (mockMap.mock.calls.at(-1)?.[0] as { markers: { id: string; color?: string }[] }).markers;

beforeEach(() => {
  jest.clearAllMocks();
  signInAs(1);
  plans.getOrgPlanStatus.mockResolvedValue({ plan_id: 3, is_free_trial: false, is_expired: false });
  branches.listBranches.mockResolvedValue([]);
  location.getLocationHistory.mockResolvedValue([]);
  location.listStaffLocations.mockResolvedValue([
    staff({ userId: 'a', name: 'Asha Verma', branch: 'Chennai', updatedAt: ago(3) }),
    staff({ userId: 'b', name: 'Ravi Kumar', branch: 'Pune', updatedAt: ago(40) }),
    staff({ userId: 'c', name: 'Meera Iyer', branch: 'Pune', updatedAt: ago(2) }),
  ]);
});

describe('StaffLocationScreen', () => {
  it('shows counters and a marker per staff, coloured by freshness', async () => {
    await renderScreen(<StaffLocationScreen />);
    await waitFor(() => expect(lastMarkers()).toHaveLength(3));
    expect(screen.getByText('UPDATED WITHIN 15 MINS')).toBeTruthy();
    expect(screen.getByText('UPDATED BEFORE 15 MINS')).toBeTruthy();
    expect(screen.getByTestId('location-stat-recent')).toBeTruthy();
    expect(screen.getByText('View All Staff (3)')).toBeTruthy();
    const colours = Object.fromEntries(lastMarkers().map((m) => [m.id, m.color]));
    expect(colours.a).toBe(colours.c);
    expect(colours.a).not.toBe(colours.b);
  });

  it('opens the recent list from the counter and the all-staff panel', async () => {
    await renderScreen(<StaffLocationScreen />);
    await waitFor(() => expect(lastMarkers()).toHaveLength(3));
    await fireEvent.press(screen.getByTestId('location-stat-recent'));
    expect(await screen.findByText('Recently Updated Staff (2)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('location-view-all'));
    expect(await screen.findByText('All Field Staff (3)')).toBeTruthy();
  });

  it('selecting a staff member loads their route and draws Start / End', async () => {
    location.getLocationHistory.mockResolvedValue([
      { latitude: 13.0, longitude: 80.0, timestamp: ago(30) },
      { latitude: 13.01, longitude: 80.01, timestamp: ago(10) },
    ]);
    await renderScreen(<StaffLocationScreen />);
    await waitFor(() => expect(lastMarkers()).toHaveLength(3));
    await fireEvent.press(screen.getByTestId('location-view-all'));
    await fireEvent.press(await screen.findByTestId('location-row-a'));
    await waitFor(() => expect(lastMarkers().map((m) => m.id)).toEqual(expect.arrayContaining(['route-start', 'route-end'])));
    expect(location.getLocationHistory).toHaveBeenCalledWith('a', expect.any(String), expect.any(String));
  });

  it('the Branch filter filters markers, counters and lists', async () => {
    await renderScreen(<StaffLocationScreen />);
    await waitFor(() => expect(lastMarkers()).toHaveLength(3));
    await fireEvent.press(screen.getByTestId('location-branch'));
    await fireEvent.press(await screen.findByText('Pune'));
    await waitFor(() => expect(lastMarkers().map((m) => m.id).sort()).toEqual(['b', 'c']));
    expect(screen.getByText('View All Staff (2)')).toBeTruthy();
  });

  it('blocked plan: shows the right message, does not fetch and offers renew', async () => {
    plans.getOrgPlanStatus.mockResolvedValue({ plan_id: 1, is_free_trial: false, is_expired: false });
    await renderScreen(<StaffLocationScreen />);
    expect(await screen.findByText('Page Unavailable')).toBeTruthy();
    // Core plan is not "expired": the message asks to upgrade
    expect(screen.getByText('This feature is available only in the Prime plan. Please upgrade your plan to access it.')).toBeTruthy();
    expect(location.listStaffLocations).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText(/Renew Plan|View Plan Status/));
    expect(mockPush).toHaveBeenCalledWith('/admin/billing');
  });

  it('expired plan keeps the expiry wording', async () => {
    plans.getOrgPlanStatus.mockResolvedValue({ plan_id: 3, is_free_trial: false, is_expired: true });
    await renderScreen(<StaffLocationScreen />);
    expect(await screen.findByText('Your plan has expired. Please renew your plan to continue using this feature.')).toBeTruthy();
  });

  it('requests the IST date', async () => {
    await renderScreen(<StaffLocationScreen />);
    await waitFor(() => expect(location.listStaffLocations).toHaveBeenCalled());
    expect(location.listStaffLocations).toHaveBeenCalledWith('org1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
