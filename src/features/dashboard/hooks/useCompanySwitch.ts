import { useCallback, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { authApi, homeApi, plansApi } from '@/api';
import { useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { getSession, patchSession } from '@/store/auth';
import type { Company } from '@/types/api/company';

/** Drops every cached query scoped to `orgId` (second key element) and cancels the ones still in flight. */
export function removeOrgScopedQueries(client: QueryClient, orgId: string): void {
  if (!orgId) return;
  client.removeQueries({ predicate: (q) => q.queryKey[1] === orgId });
}

export type CompanySwitch = {
  /** Name of the company being switched to (drives the blocking "Switching to ..." overlay), or null. */
  switchingTo: string | null;
  /** Resolves true when the session now points at `company`. Never throws. */
  switchTo: (company: Company, date: string) => Promise<boolean>;
};

/**
 * Switch the organisation the admin is looking at (v1 F15, with the stale-plan bug fixed):
 *  1. load the target organisation's branches, today's stats, logo, plan status and subscription in parallel —
 *     if the essentials fail, nothing changes and an error toast is shown;
 *  2. patch the session (`orgId`, `orgName` AND the plan fields, which v1 left on the previous company);
 *  3. remove the previous organisation's cached queries so nothing of it can leak into the new view.
 * Branch / department filters reset because they are bound to the org id (`useDashboardFilters`).
 */
export function useCompanySwitch(): CompanySwitch {
  const client = useQueryClient();
  const toast = useToast();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const switchTo = useCallback(
    async (company: Company, date: string): Promise<boolean> => {
      const current = getSession();
      if (!current) {
        toast.error('Authentication data not found');
        return false;
      }
      const target = company.orgId;
      setSwitchingTo(company.name);
      try {
        const [status, subscription] = await Promise.all([
          client.fetchQuery({
            queryKey: queryKeys.plans.status(target),
            queryFn: () => plansApi.getOrgPlanStatus(target),
            staleTime: 0,
          }),
          client
            .fetchQuery({
              queryKey: queryKeys.plans.subscription(target),
              queryFn: () => plansApi.getSubscription(target),
              staleTime: 0,
            })
            .catch(() => null),
          client.fetchQuery({ queryKey: queryKeys.home.branches(target), queryFn: () => homeApi.getBranches(target) }),
          client.fetchQuery({
            queryKey: queryKeys.home.dashboard(target, { date, branchId: '' }),
            queryFn: () => homeApi.getDashboardStats(target, { date }),
          }),
          // The logo is cosmetic: a failure leaves the placeholder.
          client
            .fetchQuery({ queryKey: queryKeys.company.logo(target), queryFn: () => authApi.getOrgLogoUrl(target) })
            .catch(() => null),
        ]);
        patchSession({
          orgId: target,
          orgName: company.name,
          planId: status.plan_id,
          isFreeTrial: status.is_free_trial,
          freeTrialEnd: subscription?.freeTrialEnd ?? null,
        });
        if (current.orgId !== target) removeOrgScopedQueries(client, current.orgId);
        return true;
      } catch (e) {
        toast.error(getErrorMessage(e, 'Failed to switch company'));
        return false;
      } finally {
        setSwitchingTo(null);
      }
    },
    [client, toast],
  );

  return { switchingTo, switchTo };
}
