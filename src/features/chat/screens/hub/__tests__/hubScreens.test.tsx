import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { routes } from '@/config/routes';
import { useAnnouncementUnreadStore } from '@/features/announcements/seenIds';
import { badges, resetBadges } from '@/store/badges';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider } from '@/theme';
import AdminChatHubScreen from '../AdminChatHubScreen';
import StaffChatHubScreen from '../StaffChatHubScreen';

const mockPush = jest.fn();
const mockPlan = { isLoading: false, blocked: false, message: '' };

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => false, dismissAll: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/hooks/useOrgPlan', () => ({
  useOrgPlan: () => ({
    isLoading: mockPlan.isLoading,
    isBlocked: () => mockPlan.blocked,
    message: () => (mockPlan.blocked ? mockPlan.message : ''),
  }),
}));
jest.mock('@/api/chat', () => ({ getChatUnreadTotal: jest.fn(async () => 5) }));
jest.mock('@/api/groupChat', () => ({ getGroupUnreadTotal: jest.fn(async () => 120) }));
jest.mock('@/api/company', () => ({ getCompanyDetails: jest.fn(async () => ({ logoUrl: undefined })) }));
const mockOrgLogo = jest.fn<Promise<string | null>, [string]>(async () => null);
jest.mock('@/api/auth', () => ({ getOrgLogoUrl: (orgId: string) => mockOrgLogo(orgId) }));
jest.mock('@/api/announcements', () => ({
  ...jest.requireActual('@/api/announcements'),
  listEmployeeAnnouncements: jest.fn(async () => [
    ...[1, 2].map((i) => ({ id: `b${i}`, target: 'all' })),
    ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: `t${i}`, target: 'branch' })),
  ]),
}));

function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetBadges();
  useAnnouncementUnreadStore.getState().reset();
  mockPlan.isLoading = false;
  mockPlan.blocked = false;
  mockPlan.message = '';
  mockOrgLogo.mockResolvedValue(null);
});

describe('AdminChatHubScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: { userId: 'admin1', orgId: 'org1', orgName: 'Acme Corp', roleId: 1, managerPermissions: [] }, hydrated: true });
  });

  it('shows the org name, four cards in order, unread badges (99+ capped) and navigates to the comms routes', async () => {
    await renderScreen(<AdminChatHubScreen />);
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    expect(screen.getByText('Team Communication')).toBeTruthy();
    expect(screen.getByText('Communicate')).toBeTruthy();
    for (const t of ['Individual Chat', 'Group Chat', 'Announcement', 'Branch & Dept']) expect(screen.getByText(t)).toBeTruthy();

    // badges come from the server unread totals: individual 5, group 120 -> "99+"; announcement cards never show one
    await waitFor(() => expect(screen.getByTestId('hub-badge-individual')).toBeTruthy());
    expect(screen.getByLabelText('5')).toBeTruthy();
    expect(await screen.findByLabelText('99+')).toBeTruthy();
    expect(screen.queryByTestId('hub-badge-announce')).toBeNull();
    expect(badges.get().chat).toBe(125);

    await fireEvent.press(screen.getByTestId('hub-card-individual'));
    await fireEvent.press(screen.getByTestId('hub-card-group'));
    await fireEvent.press(screen.getByTestId('hub-card-announce'));
    await fireEvent.press(screen.getByTestId('hub-card-targeted'));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
      routes.admin.comms.direct,
      routes.admin.comms.groups,
      routes.admin.comms.announcements,
      routes.admin.comms.announcementsTargeted,
    ]);
  });

  it('plan-blocked: Feature Unavailable panel with Renew Plan to billing, and no menu', async () => {
    mockPlan.blocked = true;
    mockPlan.message = 'Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.';
    await renderScreen(<AdminChatHubScreen />);
    expect(screen.getByText('Feature Unavailable')).toBeTruthy();
    expect(screen.getByText(mockPlan.message)).toBeTruthy();
    expect(screen.queryByTestId('hub-card-individual')).toBeNull();
    await fireEvent.press(screen.getByText(Platform.OS === 'ios' ? 'View Plan Status' : 'Renew Plan'));
    expect(mockPush).toHaveBeenCalledWith(routes.admin.billing.overview);
  });

  it('does not flash the menu while the plan status is loading', async () => {
    mockPlan.isLoading = true;
    await renderScreen(<AdminChatHubScreen />);
    expect(screen.getByTestId('hub-checking')).toBeTruthy();
    expect(screen.queryByTestId('hub-card-individual')).toBeNull();
  });
});

describe('StaffChatHubScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: { userId: 'staff1', orgId: 'org1', orgName: 'Acme Corp', roleId: 3, managerPermissions: [] }, hydrated: true });
  });

  it('shows the four channels with broadcast / targeted badges from the seen-ids counters and navigates', async () => {
    await renderScreen(<StaffChatHubScreen />);
    await waitFor(() => expect(useAnnouncementUnreadStore.getState()).toMatchObject({ broadcast: 2, targeted: 7 }));
    expect(screen.getByText('Chat')).toBeTruthy();
    expect(screen.getByText('Choose a channel')).toBeTruthy();
    for (const t of ['Individual Chat', 'Group Chat', 'Broadcast', 'Targeted Announcement']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByTestId('hub-badge-broadcast')).toBeTruthy();
    expect(screen.getByTestId('hub-badge-targeted')).toBeTruthy();
    expect(screen.getByLabelText('7')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('hub-card-broadcast'));
    await fireEvent.press(screen.getByTestId('hub-card-targeted'));
    await fireEvent.press(screen.getByTestId('hub-card-individual'));
    await fireEvent.press(screen.getByTestId('hub-card-group'));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
      routes.staff.comms.broadcast,
      routes.staff.comms.targeted,
      routes.staff.comms.direct,
      routes.staff.comms.groups,
    ]);
  });

  it('shows the chat icon in the header when the organisation has no logo', async () => {
    await renderScreen(<StaffChatHubScreen />);
    await waitFor(() => expect(mockOrgLogo).toHaveBeenCalledWith('org1'));
    expect(screen.queryByLabelText('Company logo')).toBeNull();
  });

  it('shows the company logo in the header when the organisation has one', async () => {
    mockOrgLogo.mockResolvedValue('https://cdn.example.com/logo.png');
    await renderScreen(<StaffChatHubScreen />);
    expect(await screen.findByLabelText('Company logo')).toBeTruthy();
  });

  it('plan-blocked: Chat Unavailable, contact-your-admin text and no action', async () => {
    mockPlan.blocked = true;
    mockPlan.message = 'Your plan has expired. Please contact your admin.';
    await renderScreen(<StaffChatHubScreen />);
    expect(screen.getByText('Chat Unavailable')).toBeTruthy();
    expect(screen.getByText('Your plan has expired. Please contact your admin.')).toBeTruthy();
    expect(screen.queryByTestId('chat-gate-cta')).toBeNull();
    expect(screen.queryByTestId('hub-card-individual')).toBeNull();
  });
});
