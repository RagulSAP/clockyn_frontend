import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Linking, Platform } from 'react-native';

import { referralApi } from '@/api';
import { ToastProvider } from '@/components/ui';
import { copyToClipboard } from '@/lib/platform/clipboard';
import { shareText } from '@/lib/platform/share';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider } from '@/theme';
import type { ReferralInfo } from '@/types/api/referral';

import ReferralScreen from '../screens/ReferralScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/api', () => ({ referralApi: { getMyReferral: jest.fn() } }));
jest.mock('@/lib/platform/clipboard', () => ({ copyToClipboard: jest.fn(), readClipboardText: jest.fn() }));
jest.mock('@/lib/platform/share', () => ({ shareText: jest.fn() }));

const getMyReferral = referralApi.getMyReferral as jest.Mock;
const copy = copyToClipboard as jest.Mock;
const share = shareText as jest.Mock;

const reward = (status: 'pending' | 'available' | 'used' | 'void', over = {}) => ({ id: 1, status, percent: 10, usedAt: null, planName: null, discountAmount: null, ...over });

const INFO: ReferralInfo = {
  code: 'K7M2QX',
  percent: 10,
  eligiblePlans: ['Prime', 'Elite'],
  shareMessage: 'Join me on Clockyn. Use my referral code K7M2QX and we both get 10% off.',
  summary: { referredCount: 4, convertedCount: 2, rewardsAvailable: 1, rewardsPending: 1, rewardsUsed: 1 },
  referrals: [
    { id: 1, orgName: 'Greenfield Logistics', joinedAt: '2026-11-09T09:30:00+05:30', status: 'signed_up', reward: reward('pending') },
    { id: 2, orgName: 'Blue Orchid Retail', joinedAt: '2026-11-02T09:30:00+05:30', status: 'paid', reward: reward('available') },
    {
      id: 3,
      orgName: 'Sunrise Traders',
      joinedAt: '2026-10-08T09:30:00+05:30',
      status: 'paid',
      reward: reward('used', { usedAt: '2026-10-30T10:00:00+05:30', planName: 'Prime', discountAmount: 200 }),
    },
    { id: 4, orgName: 'Old Co', joinedAt: null, status: 'signed_up', reward: reward('void') },
  ],
  myReward: { ...reward('available'), id: 9, referredByOrgName: 'Zed Corp' },
};

async function renderReferral() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ReferralScreen />
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

let open: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    session: { userId: 'u1', orgId: 'org-1', orgName: 'Acme Traders', roleId: 1, email: 'o@x.io', name: 'Owner', managerPermissions: [] },
    hydrated: true,
  });
  getMyReferral.mockResolvedValue(INFO);
  copy.mockResolvedValue(true);
  share.mockResolvedValue('shared');
  open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
});
afterEach(() => open.mockRestore());

describe('ReferralScreen', () => {
  it('shows a loading skeleton, then the hero with the code and the offer', async () => {
    let resolve!: (v: ReferralInfo) => void;
    getMyReferral.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderReferral();
    expect(screen.getByTestId('referral-loading')).toBeTruthy();
    resolve(INFO);
    expect(await screen.findByTestId('referral-hero')).toBeTruthy();
    expect(screen.queryByTestId('referral-loading')).toBeNull();
    expect(screen.getByTestId('referral-code').props.children).toBe('K7M2QX');
    expect(screen.getByText('10% off for you and your friend')).toBeTruthy();
    expect(screen.getByText(/Prime and Elite plans only/)).toBeTruthy();
    expect(getMyReferral).toHaveBeenCalledWith('org-1');
  });

  it('shows how it works, reward counts, the redeem hint and the referred list with status chips', async () => {
    await renderReferral();
    await screen.findByTestId('referral-hero');
    expect(screen.getByText('How it works')).toBeTruthy();
    for (const n of [1, 2, 3]) expect(screen.getByTestId(`referral-step-${n}`)).toBeTruthy();

    expect(screen.getByTestId('rewards-available-count').props.children).toBe('1');
    expect(screen.getByTestId('rewards-pending-count').props.children).toBe('1');
    expect(screen.getByTestId('rewards-used-count').props.children).toBe('1');
    expect(screen.getByTestId('referral-redeem-hint')).toBeTruthy();

    expect(screen.getByText('Organisations you referred')).toBeTruthy();
    expect(screen.getByTestId('referral-row-0-name').props.children).toBe('Greenfield Logistics');
    expect(screen.getByText('Joined 09 Nov 2026')).toBeTruthy();
    expect(screen.getByTestId('referral-row-0-status').props.accessibilityLabel).toBe('Signed up');
    expect(screen.getByTestId('referral-row-0-reward').props.accessibilityLabel).toBe('Reward: Pending');
    expect(screen.getByTestId('referral-row-0-reward-caption').props.children).toBe('Unlocks when they pay');
    expect(screen.getByTestId('referral-row-1-status').props.accessibilityLabel).toBe('Paid');
    expect(screen.getByTestId('referral-row-1-reward').props.accessibilityLabel).toBe('Reward: Available');
    expect(screen.getByTestId('referral-row-2-reward').props.accessibilityLabel).toBe('Reward: Used');
    expect(screen.getByTestId('referral-row-2-reward-caption').props.children).toBe('Prime - ₹200 off on 30 Oct 2026');
    expect(screen.getByTestId('referral-row-3-reward').props.accessibilityLabel).toBe('Reward: Void');
  });

  it.each([
    ['android', 'Open Your plan & validity > Renew or choose a plan and tap Apply next to the coupon box.'],
    ['ios', 'Plans can be bought on Android or the web. Open Your plan & validity there and tap Apply next to the coupon box.'],
  ] as const)('tells the user where to redeem on %s', async (os, hint) => {
    const replaced = jest.replaceProperty(Platform, 'OS', os);
    try {
      await renderReferral();
      expect(await screen.findByText(hint)).toBeTruthy();
    } finally {
      replaced.restore();
    }
  });

  it("shows this organisation's own reward when it was referred", async () => {
    await renderReferral();
    expect(await screen.findByTestId('referral-my-reward-title')).toHaveTextContent('Referral reward from Zed Corp: 10% off your first plan');
    expect(screen.getByTestId('referral-my-reward-status').props.accessibilityLabel).toBe('Available');
  });

  it('hides the own-reward card when the organisation was not referred', async () => {
    getMyReferral.mockResolvedValue({ ...INFO, myReward: null });
    await renderReferral();
    await screen.findByTestId('referral-hero');
    expect(screen.queryByTestId('referral-my-reward')).toBeNull();
  });

  it('empty state encourages sharing', async () => {
    getMyReferral.mockResolvedValue({ ...INFO, referrals: [], myReward: null, summary: { referredCount: 0, convertedCount: 0, rewardsAvailable: 0, rewardsPending: 0, rewardsUsed: 0 } });
    await renderReferral();
    expect(await screen.findByTestId('referral-empty')).toBeTruthy();
    expect(screen.getByText('No referrals yet')).toBeTruthy();
    expect(screen.queryByTestId('referral-list')).toBeNull();
    expect(screen.getByTestId('referral-code')).toBeTruthy(); // the code is still the hero
  });

  it('error state shows the message and retries', async () => {
    getMyReferral.mockRejectedValueOnce(new Error('Boom, server down'));
    await renderReferral();
    expect(await screen.findByTestId('referral-error')).toBeTruthy();
    expect(screen.getByText('Boom, server down')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByTestId('referral-hero')).toBeTruthy();
    expect(getMyReferral).toHaveBeenCalledTimes(2);
  });

  it('managers see an admins-only message and nothing is fetched', async () => {
    useAuthStore.setState({ session: { ...useAuthStore.getState().session!, roleId: 2 } });
    await renderReferral();
    expect(screen.getByTestId('referral-admin-only')).toBeTruthy();
    expect(getMyReferral).not.toHaveBeenCalled();
  });

  describe('actions', () => {
    it('Share opens the system share sheet with the server share_message', async () => {
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-share'));
      await waitFor(() => expect(share).toHaveBeenCalledWith({ message: INFO.shareMessage, title: 'Join me on Clockyn' }));
    });

    it('Copy code copies only the code and confirms with "Copied"', async () => {
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-copy-code'));
      await waitFor(() => expect(copy).toHaveBeenCalledWith('K7M2QX'));
      expect(await screen.findByText('Copied')).toBeTruthy();
      expect(await screen.findByText('Referral code copied')).toBeTruthy();
    });

    it('tapping the code box also copies the code', async () => {
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-code-box'));
      await waitFor(() => expect(copy).toHaveBeenCalledWith('K7M2QX'));
    });

    it('Copy message copies the whole share_message', async () => {
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-copy-message'));
      await waitFor(() => expect(copy).toHaveBeenCalledWith(INFO.shareMessage));
      expect(await screen.findByText('Share message copied')).toBeTruthy();
      expect(screen.getByText('Message copied')).toBeTruthy();
    });

    it('a refused copy shows an error instead of "Copied"', async () => {
      copy.mockResolvedValue(false);
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-copy-code'));
      expect(await screen.findByText('Could not copy. Please copy it manually.')).toBeTruthy();
      expect(screen.queryByText('Copied')).toBeNull();
    });

    it('WhatsApp opens the whatsapp:// deep link with the encoded message', async () => {
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-whatsapp'));
      await waitFor(() => expect(open).toHaveBeenCalledWith(`whatsapp://send?text=${encodeURIComponent(INFO.shareMessage)}`));
    });

    it('WhatsApp falls back to wa.me, then to the share sheet', async () => {
      open.mockRejectedValueOnce(new Error('not installed'));
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-whatsapp'));
      await waitFor(() => expect(open).toHaveBeenLastCalledWith(`https://wa.me/?text=${encodeURIComponent(INFO.shareMessage)}`));

      open.mockReset().mockRejectedValue(new Error('nothing opens'));
      await fireEvent.press(screen.getByTestId('referral-whatsapp'));
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    });

    it('SMS opens the sms: link with the platform separator', async () => {
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-sms'));
      const sep = Platform.OS === 'ios' ? '&' : '?';
      await waitFor(() => expect(open).toHaveBeenCalledWith(`sms:${sep}body=${encodeURIComponent(INFO.shareMessage)}`));
    });

    it('a share that fell back to the clipboard says so', async () => {
      share.mockResolvedValue('copied');
      await renderReferral();
      await fireEvent.press(await screen.findByTestId('referral-share'));
      expect(await screen.findByText('Message copied. Paste it into any app to share.')).toBeTruthy();
    });
  });
});
