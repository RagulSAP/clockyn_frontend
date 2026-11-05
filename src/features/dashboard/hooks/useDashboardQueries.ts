import { useEffect } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';

import { authApi, companyApi, homeApi, requestsApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';
import { realtimeBus } from '@/lib/realtime/events';
import { patchSession, useSession } from '@/store/auth';

/**
 * While the filters change, keep showing the previous numbers of the SAME organisation instead of zeros / a
 * skeleton; never show another organisation's data (the org id is element 1 of every scoped query key).
 */
function keepWithinOrg(orgId: string) {
  return <T>(previous: T | undefined, previousQuery?: { queryKey: QueryKey }): T | undefined =>
    previousQuery && previousQuery.queryKey[1] === orgId ? previous : undefined;
}

/** Headline counters of the selected day / branch. */
export function useDashboardStats(orgId: string, date: string, branchId: string) {
  return useQuery({
    queryKey: queryKeys.home.dashboard(orgId, { date, branchId }),
    queryFn: () => homeApi.getDashboardStats(orgId, { date, branchId }),
    enabled: orgId !== '',
    placeholderData: keepWithinOrg(orgId),
  });
}

/** Active branches of the organisation (branch picker). */
export function useBranches(orgId: string) {
  return useQuery({
    queryKey: queryKeys.home.branches(orgId),
    queryFn: () => homeApi.getBranches(orgId),
    enabled: orgId !== '',
    staleTime: 60_000,
  });
}

/** Active departments (the Manage card count). */
export function useDepartments(orgId: string) {
  return useQuery({
    queryKey: queryKeys.home.departments(orgId),
    queryFn: () => homeApi.getDepartments(orgId),
    enabled: orgId !== '',
    staleTime: 60_000,
  });
}

/** Per-department counters (department mode only). Late / Punch-In counts come from the server. */
export function useDepartmentStats(orgId: string, date: string, branchId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.home.list(orgId, { kind: 'department-stats', date, branchId }),
    queryFn: () => homeApi.getDepartmentStats(orgId, { date, branchId }),
    enabled: enabled && orgId !== '',
    placeholderData: keepWithinOrg(orgId),
  });
}

/** Organisation logo URL (`null` when the company has none). */
export function useOrgLogo(orgId: string) {
  return useQuery({
    queryKey: queryKeys.company.logo(orgId),
    queryFn: () => authApi.getOrgLogoUrl(orgId),
    enabled: orgId !== '',
    staleTime: 5 * 60_000,
  });
}

/**
 * Live company name: the details endpoint is the source of truth; when it differs from the stored session name
 * the session is updated (v1 synced it on every focus).
 */
export function useCompanyName(orgId: string): string {
  const session = useSession();
  const query = useQuery({
    queryKey: queryKeys.company.details(orgId),
    queryFn: () => companyApi.getCompanyDetails(orgId),
    enabled: orgId !== '',
    staleTime: 60_000,
  });
  const fresh = query.data?.name.trim() ?? '';
  const stored = session?.orgName ?? '';
  useEffect(() => {
    if (fresh !== '' && fresh !== stored && session?.orgId === orgId) patchSession({ orgName: fresh });
  }, [fresh, stored, orgId, session?.orgId]);
  return fresh || stored;
}

/**
 * Pending-request total for the Requests badge. Refetched when a `request_submitted` event arrives (the global
 * socket) so the number is exact instead of a blind +1.
 */
export function usePendingRequests(orgId: string) {
  const query = useQuery({
    queryKey: queryKeys.requests.pendingCounts(orgId),
    queryFn: () => requestsApi.getPendingCounts(orgId),
    enabled: orgId !== '',
  });
  const refetch = query.refetch;
  useEffect(() => {
    return realtimeBus.subscribe((event) => {
      if (event.type === 'request_submitted') void refetch();
    });
  }, [refetch]);
  return query;
}
