import React from 'react';
import { waitFor } from '@testing-library/react-native';

import { liveChatSession } from '@/lib/realtime/liveChatSession';
import { badges, resetBadges } from '@/store/badges';

import { renderScreen, signInTestAdmin } from '../../settings/__tests__/testHelpers';
import { useLiveChatBadgeSeed } from '../hooks/useLiveChatBadgeSeed';

const mockGetUnread = jest.fn();
jest.mock('@/api', () => ({
  ...jest.requireActual('@/api'),
  liveChatApi: { getUnread: (...a: unknown[]) => mockGetUnread(...a) },
}));

function Seed() {
  useLiveChatBadgeSeed();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  liveChatSession.setOpen(false);
  resetBadges();
  signInTestAdmin();
});

describe('useLiveChatBadgeSeed', () => {
  it('seeds the Support badge from the unread count for an admin', async () => {
    mockGetUnread.mockResolvedValue(4);
    await renderScreen(<Seed />);
    await waitFor(() => expect(badges.get().liveChat).toBe(4));
    expect(mockGetUnread).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it.each([2, 3])('never asks for role %i', async (roleId) => {
    signInTestAdmin({ roleId: roleId as 2 | 3 });
    mockGetUnread.mockResolvedValue(4);
    await renderScreen(<Seed />);
    expect(mockGetUnread).not.toHaveBeenCalled();
    expect(badges.get().liveChat).toBe(0);
  });

  it('leaves the badge alone while the conversation is open', async () => {
    liveChatSession.setOpen(true);
    mockGetUnread.mockResolvedValue(4);
    await renderScreen(<Seed />);
    await waitFor(() => expect(mockGetUnread).toHaveBeenCalled());
    expect(badges.get().liveChat).toBe(0);
  });

  it('keeps the badge as it was when the load fails', async () => {
    badges.set('liveChat', 2);
    mockGetUnread.mockRejectedValue(new Error('offline'));
    await renderScreen(<Seed />);
    await waitFor(() => expect(mockGetUnread).toHaveBeenCalled());
    expect(badges.get().liveChat).toBe(2);
  });
});
