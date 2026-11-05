import React from 'react';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getOrgPlanStatus } from '@/api/plans';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { signIn, useAuthStore, type Session } from '@/store/auth';

import { useOrgPlan, usePlanFeature } from '../useOrgPlan';

jest.mock('@/api/plans', () => ({ getOrgPlanStatus: jest.fn() }));
const mockGetStatus = getOrgPlanStatus as jest.Mock;

notifyManager.setScheduler((cb) => cb());

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const admin: Session = { userId: 'admin-1', orgId: 'org-1', orgName: 'Acme', roleId: 1, managerPermissions: [] };
const staff: Session = { userId: 'staff-1', orgId: 'org-1', orgName: 'Acme', roleId: 3, managerPermissions: [] };

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGetStatus.mockReset();
  useAuthStore.setState({ session: null });
});

afterEach(() => client.clear());

describe('useOrgPlan', () => {
  it('does not fetch while signed out', async () => {
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    expect(mockGetStatus).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isBlocked('crm')).toBe(false);
  });

  it('fetches the plan status of the session org for any role (incl. staff)', async () => {
    mockGetStatus.mockResolvedValue({ plan_id: 1, is_free_trial: false, is_expired: false });
    signIn(staff);
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(mockGetStatus).toHaveBeenCalledWith('org-1');
    expect(result.current).toMatchObject({ planId: 1, isFreeTrial: false, isExpired: false, isLoading: false, audience: 'staff' });
  });

  it('applies the gating matrix', async () => {
    mockGetStatus.mockResolvedValue({ plan_id: 1, is_free_trial: false, is_expired: false });
    signIn(admin);
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.isBlocked('crm')).toBe(true);
    expect(result.current.isBlocked('staff_location')).toBe(true);
    expect(result.current.isBlocked('chat')).toBe(false);
    expect(result.current.isBlocked('camera_punch')).toBe(false);
    expect(result.current.isBlocked('salary_structure')).toBe(false);
  });

  it('free trial unlocks everything and has no message', async () => {
    mockGetStatus.mockResolvedValue({ plan_id: null, is_free_trial: true, is_expired: false });
    signIn(admin);
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.isBlocked('crm')).toBe(false);
    expect(result.current.message('crm')).toBe('');
    expect(result.current.isFreeTrial).toBe(true);
  });

  it('admin messages are upgrade hints; staff are told to contact the admin', async () => {
    mockGetStatus.mockResolvedValue({ plan_id: 1, is_free_trial: false, is_expired: false });
    signIn(admin);
    const a = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(a.result.current.status).not.toBeNull());
    expect(a.result.current.message('crm')).toBe('This feature is available only in the Prime plan. Please upgrade your plan to access it.');
    expect(a.result.current.message('chat')).toBe('');
    expect(a.result.current.panelMessage).toBe('Your plan has expired. Please renew your plan to continue using this feature.');

    await act(async () => {
      useAuthStore.setState({ session: staff });
    });
    expect(a.result.current.audience).toBe('staff');
    expect(a.result.current.message('crm')).toMatch(/contact your admin/);
    expect(a.result.current.panelMessage).toBe('Your plan has expired. Please contact your admin.');
  });

  it('expired plan blocks every feature', async () => {
    mockGetStatus.mockResolvedValue({ plan_id: 3, is_free_trial: false, is_expired: true });
    signIn(admin);
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).not.toBeNull());
    for (const f of ['chat', 'salary_structure', 'camera_punch', 'staff_location', 'crm'] as const) {
      expect(result.current.isBlocked(f)).toBe(true);
    }
    expect(result.current.isExpired).toBe(true);
  });

  it('fails open while loading', async () => {
    mockGetStatus.mockReturnValue(new Promise(() => undefined)); // never settles
    signIn(admin);
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isBlocked('crm')).toBe(false);
    expect(result.current.message('crm')).toBe('');
  });

  it('fails open when the status request fails', async () => {
    mockGetStatus.mockRejectedValue(new ApiError({ status: 500, message: 'down' }));
    signIn(admin);
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isBlocked('crm')).toBe(false);
    expect(result.current.message('crm')).toBe('');
  });

  it('caches for 5 minutes under the plans.status key', async () => {
    mockGetStatus.mockResolvedValue({ plan_id: 2, is_free_trial: false, is_expired: false });
    signIn(admin);
    const first = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(first.result.current.status).not.toBeNull());
    expect(client.getQueryData(queryKeys.plans.status('org-1'))).toEqual({ plan_id: 2, is_free_trial: false, is_expired: false });
    expect(client.getQueryCache().find({ queryKey: queryKeys.plans.status('org-1') })?.isStale()).toBe(false);
    const second = await renderHook(() => useOrgPlan(), { wrapper });
    expect(second.result.current.planId).toBe(2); // instantly from cache
    expect(mockGetStatus).toHaveBeenCalledTimes(1);
  });

  it('re-fetches for another organisation (cache is org-scoped)', async () => {
    mockGetStatus.mockResolvedValueOnce({ plan_id: 1, is_free_trial: false, is_expired: false });
    mockGetStatus.mockResolvedValueOnce({ plan_id: 3, is_free_trial: false, is_expired: false });
    signIn(admin);
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(result.current.planId).toBe(1));
    await act(async () => {
      useAuthStore.setState({ session: { ...admin, orgId: 'org-2' } });
    });
    await waitFor(() => expect(result.current.planId).toBe(3));
    expect(mockGetStatus).toHaveBeenLastCalledWith('org-2');
  });

  it('refetch() works', async () => {
    mockGetStatus.mockResolvedValue({ plan_id: 1, is_free_trial: false, is_expired: false });
    signIn(admin);
    const { result } = await renderHook(() => useOrgPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).not.toBeNull());
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
  });
});

describe('usePlanFeature', () => {
  it('summarises one feature', async () => {
    mockGetStatus.mockResolvedValue({ plan_id: 2, is_free_trial: false, is_expired: false });
    signIn(admin);
    const { result } = await renderHook(() => usePlanFeature('crm'), { wrapper });
    await waitFor(() => expect(result.current.blocked).toBe(true));
    expect(result.current.message).toMatch(/Elite/);
    expect(result.current.isLoading).toBe(false);
  });
});
