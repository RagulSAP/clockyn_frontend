import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { mapAnnouncement } from '@/api/announcements';
import { badges, resetBadges } from '@/store/badges';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider } from '@/theme';
import BroadcastFeedScreen from '../screens/BroadcastFeedScreen';
import TargetedFeedScreen from '../screens/TargetedFeedScreen';
import { loadSeenIds, resetUnread, useAnnouncementUnreadStore } from '../seenIds';

const mockListMine = jest.fn();

jest.mock('@/api/announcements', () => ({
  ...jest.requireActual('@/api/announcements'),
  listEmployeeAnnouncements: (...a: unknown[]) => mockListMine(...a),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

const LIST = [
  mapAnnouncement({ id: '1', title: 'Payroll update', message: 'Salaries on the 5th', target: 'all', sent_by: 'Admin', created_at: '2026-10-17T05:00:00Z' }),
  mapAnnouncement({ id: '2', title: 'Training', message: 'Room 2', target: 'selected', created_at: '2026-10-17T05:00:00Z' }),
  mapAnnouncement({ id: '3', title: 'Diwali', message: 'Sweets', target: 'branch', branch_name: 'Chennai', created_at: '2026-10-17T05:00:00Z' }),
  mapAnnouncement({ id: '4', title: 'Offsite', message: 'Trip', target: 'dept', dept_name: 'Sales', created_at: '2026-10-17T05:00:00Z' }),
];

beforeEach(async () => {
  jest.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await require('@react-native-async-storage/async-storage').clear();
  resetBadges();
  resetUnread();
  mockListMine.mockResolvedValue(LIST);
  useAuthStore.setState({ session: { userId: 'staff1', orgId: 'org1', orgName: 'Acme', roleId: 3, managerPermissions: [] }, hydrated: true });
});

describe('BroadcastFeedScreen (staff)', () => {
  it('shows only all / selected announcements, with the audience pills, and marks them seen (per user)', async () => {
    await renderScreen(<BroadcastFeedScreen />);
    expect(await screen.findByText('Payroll update')).toBeTruthy();
    expect(screen.getByText('Training')).toBeTruthy();
    expect(screen.queryByText('Diwali')).toBeNull();
    expect(screen.queryByText('Offsite')).toBeNull();
    expect(screen.getByText('All Staff')).toBeTruthy();
    expect(screen.getByText('Selected Staff')).toBeTruthy();
    expect(screen.getByText('by Admin')).toBeTruthy();
    expect(mockListMine).toHaveBeenCalledWith('staff1');

    // opening the feed marks exactly the displayed broadcast ids as seen (merge) and leaves targeted unread
    await waitFor(async () => expect((await loadSeenIds('broadcast', 'staff1')).sort()).toEqual(['1', '2']));
    expect(await loadSeenIds('targeted', 'staff1')).toEqual([]);
    expect(await loadSeenIds('broadcast', 'someone-else')).toEqual([]);
    await waitFor(() => expect(useAnnouncementUnreadStore.getState()).toMatchObject({ broadcast: 0, targeted: 2 }));
    expect(badges.get().announcements).toBe(2);
  });

  it('searches title and message and shows the empty states', async () => {
    await renderScreen(<BroadcastFeedScreen />);
    await screen.findByText('Payroll update');
    await fireEvent.changeText(screen.getByTestId('announcement-search'), 'room');
    expect(screen.queryByText('Payroll update')).toBeNull();
    expect(screen.getByText('Training')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('announcement-search'), 'zzz');
    expect(await screen.findByText('No results')).toBeTruthy();
    expect(screen.getByText('Try a different search term')).toBeTruthy();
  });

  it('empty feed copy', async () => {
    mockListMine.mockResolvedValue([]);
    await renderScreen(<BroadcastFeedScreen />);
    expect(await screen.findByText('No announcements yet')).toBeTruthy();
    expect(screen.getByText('Announcements from your admin will appear here')).toBeTruthy();
  });

  it('a failed load shows an error with retry, never marks anything seen and keeps the badge', async () => {
    badges.set('announcements', 3);
    mockListMine.mockRejectedValue(new Error('Network down'));
    await renderScreen(<BroadcastFeedScreen />);
    expect(await screen.findByText('Network down')).toBeTruthy();
    expect(await loadSeenIds('broadcast', 'staff1')).toEqual([]);
    expect(badges.get().announcements).toBe(3);
  });
});

describe('TargetedFeedScreen (staff)', () => {
  it('shows only branch / department announcements with their names and marks the targeted ids', async () => {
    await renderScreen(<TargetedFeedScreen />);
    expect(await screen.findByText('Diwali')).toBeTruthy();
    expect(screen.getByText('Offsite')).toBeTruthy();
    expect(screen.queryByText('Payroll update')).toBeNull();
    expect(screen.getByText('Chennai')).toBeTruthy();
    expect(screen.getByText('Sales')).toBeTruthy();
    await waitFor(async () => expect((await loadSeenIds('targeted', 'staff1')).sort()).toEqual(['3', '4']));
    await waitFor(() => expect(useAnnouncementUnreadStore.getState()).toMatchObject({ broadcast: 2, targeted: 0 }));
  });

  it('search also matches the branch / department name', async () => {
    await renderScreen(<TargetedFeedScreen />);
    await screen.findByText('Diwali');
    await fireEvent.changeText(screen.getByTestId('announcement-search'), 'chennai');
    expect(screen.getByText('Diwali')).toBeTruthy();
    expect(screen.queryByText('Offsite')).toBeNull();
  });

  it('empty feed copy', async () => {
    mockListMine.mockResolvedValue([]);
    await renderScreen(<TargetedFeedScreen />);
    expect(await screen.findByText('Branch or department announcements will appear here')).toBeTruthy();
  });
});
