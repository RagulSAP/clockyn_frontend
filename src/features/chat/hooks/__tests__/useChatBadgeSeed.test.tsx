import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth';
import { badges, resetBadges, useBadgeStore } from '@/store/badges';
import { useChatBadgeSeed } from '../useChatBadgeSeed';

const mockChatUnread = jest.fn();
const mockGroupUnread = jest.fn();
jest.mock('@/api/chat', () => ({ getChatUnreadTotal: (...a: unknown[]) => mockChatUnread(...a) }));
jest.mock('@/api/groupChat', () => ({ getGroupUnreadTotal: (...a: unknown[]) => mockGroupUnread(...a) }));

const mockPlan = { isLoading: false, blocked: false };
jest.mock('@/hooks/useOrgPlan', () => ({ useOrgPlan: () => ({ isLoading: mockPlan.isLoading, isBlocked: () => mockPlan.blocked }) }));

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.clearAllMocks();
  mockPlan.isLoading = false;
  mockPlan.blocked = false;
  resetBadges();
  useAuthStore.setState({ session: { userId: 'u1', orgId: 'org1', orgName: 'Acme', roleId: 3, managerPermissions: [] }, hydrated: true });
  mockChatUnread.mockResolvedValue(4);
  mockGroupUnread.mockResolvedValue(3);
});

describe('useChatBadgeSeed', () => {
  it('seeds the individual + group chat badge from the server totals (org_id scoped) without opening the hub', async () => {
    await renderHook(() => useChatBadgeSeed(), { wrapper });
    await waitFor(() => expect(badges.get().chat).toBe(7));
    expect(mockChatUnread).toHaveBeenCalledWith('u1', 'org1');
    expect(mockGroupUnread).toHaveBeenCalledWith('u1', 'org1');
    expect(useBadgeStore.getState().chatIndividual).toBe(4);
    expect(useBadgeStore.getState().chatGroup).toBe(3);
  });

  it('keeps the previous counts when a load fails (plan-blocked organisation / offline)', async () => {
    badges.setChatSection('individual', 2);
    mockChatUnread.mockRejectedValue(new Error('403: Your plan has expired. Please contact your admin.'));
    await renderHook(() => useChatBadgeSeed(), { wrapper });
    await waitFor(() => expect(mockGroupUnread).toHaveBeenCalled());
    await waitFor(() => expect(useBadgeStore.getState().chatGroup).toBe(3));
    expect(useBadgeStore.getState().chatIndividual).toBe(2);
  });

  it('does nothing without a session', async () => {
    useAuthStore.setState({ session: null, hydrated: true });
    await renderHook(() => useChatBadgeSeed(), { wrapper });
    expect(mockChatUnread).not.toHaveBeenCalled();
    expect(mockGroupUnread).not.toHaveBeenCalled();
  });

  it('does not ask a plan-blocked organisation (the lists would only answer 403 / 500) and waits for the plan', async () => {
    mockPlan.blocked = true;
    await renderHook(() => useChatBadgeSeed(), { wrapper });
    mockPlan.blocked = false;
    mockPlan.isLoading = true;
    await renderHook(() => useChatBadgeSeed(), { wrapper });
    expect(mockChatUnread).not.toHaveBeenCalled();
    expect(mockGroupUnread).not.toHaveBeenCalled();
  });
});
