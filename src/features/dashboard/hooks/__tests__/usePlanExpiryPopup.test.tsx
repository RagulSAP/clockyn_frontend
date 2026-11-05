import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';

import { plansApi } from '@/api';
import { todayIST } from '@/lib/datetime';
import { signIn, useAuthStore, type Session } from '@/store/auth';
import type { Subscription } from '@/types/api/plans';

import { planPopupShownKey } from '../../utils/planPopup';
import { usePlanExpiryPopup } from '../usePlanExpiryPopup';

jest.mock('@/api', () => ({ plansApi: { getSubscription: jest.fn() } }));
const getSubscription = plansApi.getSubscription as jest.Mock;

notifyManager.setScheduler((cb) => cb());

const admin: Session = { userId: 'admin-1', orgId: 'org-1', orgName: 'Acme', roleId: 1, managerPermissions: [] };

function subscription(over: Partial<Subscription> = {}): Subscription {
  return {
    planId: 2,
    planName: 'Prime',
    planAmount: 4999,
    planMonths: 12,
    startDate: null,
    endDate: null,
    staffLimit: 25,
    status: 'ACTIVE',
    isExpired: false,
    isFreeTrial: false,
    freeTrialEnd: null,
    billingDate: null,
    raw: {},
    ...over,
  };
}

const inDays = (n: number): string => {
  const [y, m, d] = todayIST().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  getSubscription.mockReset();
  await AsyncStorage.clear();
  useAuthStore.setState({ session: null });
  signIn(admin);
});
afterEach(() => client.clear());

describe('usePlanExpiryPopup', () => {
  it('shows an expiring plan once, then not again the same day (per organisation)', async () => {
    getSubscription.mockResolvedValue(subscription({ endDate: inDays(3) }));
    const first = await renderHook(() => usePlanExpiryPopup('android'), { wrapper });
    await waitFor(() => expect(first.result.current.popup?.type).toBe('plan_expiring'));
    expect(await AsyncStorage.getItem(planPopupShownKey('org-1', todayIST()))).toBe('true');
    await first.unmount();

    const second = await renderHook(() => usePlanExpiryPopup('android'), { wrapper });
    await waitFor(() => expect(getSubscription).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(second.result.current.popup).toBeNull();
  });

  it('shows an expired plan and it stays until dismissed by the caller', async () => {
    getSubscription.mockResolvedValue(subscription({ endDate: inDays(-2) }));
    const { result } = await renderHook(() => usePlanExpiryPopup('android'), { wrapper });
    await waitFor(() => expect(result.current.popup?.type).toBe('plan_expired'));
    await act(async () => {
      result.current.dismiss();
    });
    expect(result.current.popup).toBeNull();
  });

  it('shows the trial popup when the trial ends within 7 days', async () => {
    getSubscription.mockResolvedValue(subscription({ planId: null, isFreeTrial: true, freeTrialEnd: inDays(5) }));
    const { result } = await renderHook(() => usePlanExpiryPopup('web'), { wrapper });
    await waitFor(() => expect(result.current.popup?.type).toBe('trial_expiring'));
  });

  it('never shows on iOS and does not even request the subscription or write the flag', async () => {
    getSubscription.mockResolvedValue(subscription({ endDate: inDays(-2) }));
    const { result } = await renderHook(() => usePlanExpiryPopup('ios'), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.popup).toBeNull();
    expect(getSubscription).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(planPopupShownKey('org-1', todayIST()))).toBeNull();
  });

  it('shows nothing when the plan is far from expiring or the request fails', async () => {
    getSubscription.mockResolvedValue(subscription({ endDate: inDays(60) }));
    const ok = await renderHook(() => usePlanExpiryPopup('android'), { wrapper });
    await waitFor(() => expect(getSubscription).toHaveBeenCalled());
    expect(ok.result.current.popup).toBeNull();
    await ok.unmount();

    client.clear();
    getSubscription.mockRejectedValue(new Error('boom'));
    const failing = await renderHook(() => usePlanExpiryPopup('android'), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(failing.result.current.popup).toBeNull();
  });
});
