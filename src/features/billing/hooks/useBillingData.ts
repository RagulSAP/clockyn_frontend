import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { homeApi, plansApi, billingApi } from '@/api';
import { todayIST } from '@/lib/datetime';
import { PLAN_STALE_TIME_MS } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';

import { deriveBillingState, type BillingState } from '../utils/planState';

/** Subscription of the current organisation (placeholder object for no-plan / trial orgs; see `deriveBillingState`). */
export function useSubscription() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.plans.subscription(orgId),
    queryFn: () => plansApi.getSubscription(orgId),
    enabled: orgId !== '',
    staleTime: 0,
  });
}

/** The purchasable plan tiers (one row per plan × duration). */
export function usePlanCatalogue() {
  return useQuery({
    queryKey: queryKeys.plans.catalogue(),
    queryFn: () => plansApi.listPlans(),
    staleTime: PLAN_STALE_TIME_MS,
  });
}

/** Number of staff accounts used (managers and staff, active or not — the v1 definition). */
export function useUsedStaff() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.home.allStaff(orgId),
    queryFn: () => homeApi.getAllStaff(orgId),
    select: (rows) => rows.length,
    enabled: orgId !== '',
  });
}

/** Explicit billing state for the current subscription (re-evaluated against the IST date). */
export function useBillingState(): { state: BillingState; today: string } {
  const sub = useSubscription();
  const today = todayIST();
  return useMemo(() => ({ state: deriveBillingState(sub.data, today), today }), [sub.data, today]);
}

/** Invoices paid by the signed-in admin for the organisation (newest first). */
export function useInvoices() {
  const orgId = useOrgId();
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.billing.invoices(orgId, userId),
    queryFn: () => billingApi.listInvoices(userId, orgId),
    enabled: orgId !== '' && userId !== '',
  });
}
