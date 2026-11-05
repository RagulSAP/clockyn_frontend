import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getOrgPlanStatus } from '@/api/plans';
import {
  isFeatureBlocked,
  PLAN_PANEL_MESSAGES,
  planBlockMessageFor,
  type OrgPlanStatus,
  type PlanAudience,
  type PlanFeature,
} from '@/config/plans';
import { PLAN_STALE_TIME_MS } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useRole } from '@/store/auth';

export interface OrgPlan {
  planId: number | null;
  isFreeTrial: boolean;
  isExpired: boolean;
  /** Raw plan status, or null while loading / when it failed to load. */
  status: OrgPlanStatus | null;
  /** True while the status is loading for the first time. */
  isLoading: boolean;
  isError: boolean;
  /** Fails OPEN (false) while the status is unknown, like v1. Use `isLoading` to wait when that matters. */
  isBlocked: (feature: PlanFeature) => boolean;
  /** Block message for the feature ('' when not blocked): upgrade hints for admins, "contact your admin" for staff. */
  message: (feature: PlanFeature) => string;
  /** Text for the full-page "feature unavailable" panel (expired plan wording, per audience). */
  panelMessage: string;
  /** Whether the viewer can buy / renew (admins) or must ask their admin (managers & staff). */
  audience: PlanAudience;
  refetch: () => Promise<unknown>;
}

/**
 * Plan status of the current organisation (`current_org_id || user_id`) for ANY role — fixes v1's staff/manager CRM tab
 * being blocked because the stored `plan_id` was missing. Cached for 5 minutes via react-query; invalidate
 * `queryKeys.plans.all(orgId)` after a payment or plan change.
 */
export function useOrgPlan(): OrgPlan {
  const orgId = useOrgId();
  const role = useRole();
  const audience: PlanAudience = role === 1 ? 'admin' : 'staff';

  const query = useQuery({
    queryKey: queryKeys.plans.status(orgId),
    queryFn: () => getOrgPlanStatus(orgId),
    enabled: orgId !== '',
    staleTime: PLAN_STALE_TIME_MS,
  });

  const status = query.data ?? null;
  const refetchQuery = query.refetch;

  const isBlocked = useCallback((feature: PlanFeature) => isFeatureBlocked(status, feature), [status]);
  const message = useCallback(
    (feature: PlanFeature) => (isFeatureBlocked(status, feature) ? planBlockMessageFor(status, audience) : ''),
    [status, audience],
  );
  const refetch = useCallback(() => refetchQuery(), [refetchQuery]);

  return useMemo<OrgPlan>(
    () => ({
      planId: status?.plan_id ?? null,
      isFreeTrial: status?.is_free_trial ?? false,
      isExpired: status?.is_expired ?? false,
      status,
      isLoading: query.isLoading,
      isError: query.isError,
      isBlocked,
      message,
      panelMessage: PLAN_PANEL_MESSAGES[audience],
      audience,
      refetch,
    }),
    [status, query.isLoading, query.isError, isBlocked, message, audience, refetch],
  );
}

/** Access info for one feature: `const crm = usePlanFeature('crm'); if (crm.blocked) …`. */
export function usePlanFeature(feature: PlanFeature): { blocked: boolean; message: string; isLoading: boolean; panelMessage: string } {
  const plan = useOrgPlan();
  return {
    blocked: plan.isBlocked(feature),
    message: plan.message(feature),
    isLoading: plan.isLoading,
    panelMessage: plan.panelMessage,
  };
}
