import React from 'react';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';

import { authApi, homeApi, plansApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';
import { getSession, signIn, useAuthStore, type Session } from '@/store/auth';
import type { Company } from '@/types/api/company';

import { removeOrgScopedQueries, useCompanySwitch } from '../useCompanySwitch';

jest.mock('@/api', () => ({
  authApi: { getOrgLogoUrl: jest.fn() },
  homeApi: { getBranches: jest.fn(), getDashboardStats: jest.fn() },
  plansApi: { getOrgPlanStatus: jest.fn(), getSubscription: jest.fn() },
}));
const mockToastError = jest.fn();
jest.mock('@/components/ui', () => ({
  useToast: () => ({ error: (...a: unknown[]) => mockToastError(...a), success: jest.fn(), info: jest.fn() }),
}));

notifyManager.setScheduler((cb) => cb());

const admin: Session = {
  userId: 'admin-1',
  orgId: 'org-1',
  orgName: 'Acme',
  roleId: 1,
  managerPermissions: [],
  planId: 3,
  isFreeTrial: false,
};
const other: Company = { orgId: 'org-2', name: 'Beta Corp', address: '', gst: '', raw: {} };

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.clearAllMocks();
  useAuthStore.setState({ session: null });
  signIn(admin);
  (plansApi.getOrgPlanStatus as jest.Mock).mockResolvedValue({ plan_id: 1, is_free_trial: false, is_expired: false });
  (plansApi.getSubscription as jest.Mock).mockResolvedValue({ freeTrialEnd: null });
  (homeApi.getBranches as jest.Mock).mockResolvedValue([]);
  (homeApi.getDashboardStats as jest.Mock).mockResolvedValue({ totalStaff: 1 });
  (authApi.getOrgLogoUrl as jest.Mock).mockResolvedValue(null);
});
afterEach(() => client.clear());

describe('removeOrgScopedQueries', () => {
  it('removes only the queries of that organisation', () => {
    client.setQueryData(queryKeys.home.branches('org-1'), [1]);
    client.setQueryData(queryKeys.plans.status('org-1'), { plan_id: 1 });
    client.setQueryData(queryKeys.home.branches('org-2'), [2]);
    removeOrgScopedQueries(client, 'org-1');
    expect(client.getQueryData(queryKeys.home.branches('org-1'))).toBeUndefined();
    expect(client.getQueryData(queryKeys.plans.status('org-1'))).toBeUndefined();
    expect(client.getQueryData(queryKeys.home.branches('org-2'))).toEqual([2]);
  });
});

describe('useCompanySwitch', () => {
  it('patches the session org AND plan fields, refreshes plan status and clears the old org queries', async () => {
    client.setQueryData(queryKeys.home.branches('org-1'), [{ id: 'old' }]);
    const { result } = await renderHook(() => useCompanySwitch(), { wrapper });

    let ok = false;
    await act(async () => {
      ok = await result.current.switchTo(other, '2026-10-18');
    });

    expect(ok).toBe(true);
    expect(plansApi.getOrgPlanStatus).toHaveBeenCalledWith('org-2');
    expect(getSession()).toMatchObject({ orgId: 'org-2', orgName: 'Beta Corp', planId: 1, isFreeTrial: false });
    expect(client.getQueryData(queryKeys.home.branches('org-1'))).toBeUndefined();
    expect(client.getQueryData(queryKeys.plans.status('org-2'))).toEqual({ plan_id: 1, is_free_trial: false, is_expired: false });
    expect(result.current.switchingTo).toBeNull();
  });

  it('keeps the current company and shows an error when the essentials fail', async () => {
    (homeApi.getBranches as jest.Mock).mockRejectedValue(new Error('down'));
    const { result } = await renderHook(() => useCompanySwitch(), { wrapper });

    let ok = true;
    await act(async () => {
      ok = await result.current.switchTo(other, '2026-10-18');
    });

    expect(ok).toBe(false);
    expect(getSession()?.orgId).toBe('org-1');
    expect(mockToastError).toHaveBeenCalled();
    expect(result.current.switchingTo).toBeNull();
  });

  it('tolerates a failing logo and subscription', async () => {
    (authApi.getOrgLogoUrl as jest.Mock).mockRejectedValue(new Error('no logo'));
    (plansApi.getSubscription as jest.Mock).mockRejectedValue(new Error('no sub'));
    const { result } = await renderHook(() => useCompanySwitch(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.switchTo(other, '2026-10-18');
    });
    expect(ok).toBe(true);
    expect(getSession()?.orgId).toBe('org-2');
    expect(getSession()?.freeTrialEnd).toBeNull();
  });
});
