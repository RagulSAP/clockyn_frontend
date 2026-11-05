import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui';
import { useOrgPlan } from '@/hooks/useOrgPlan';
import { useOrgId } from '@/store/auth';

/** True when a plan status moved to an active PAID plan from something else (purchase / renewal completed). */
export function isPlanActivation(
  prev: { planId: number | null; isExpired: boolean; isFreeTrial: boolean } | null,
  next: { planId: number | null; isExpired: boolean; isFreeTrial: boolean },
): boolean {
  if (!prev) return false;
  const active = next.planId !== null && !next.isExpired && !next.isFreeTrial;
  const changed = prev.planId !== next.planId || prev.isExpired !== next.isExpired || prev.isFreeTrial !== next.isFreeTrial;
  return active && changed;
}

/**
 * Replaces v1's `payment_completed` storage flag: the payment flow invalidates the plan queries, and when the
 * freshly loaded status turns into an active paid plan the dashboard confirms it. (Company switches do not toast:
 * the baseline is per organisation.)
 */
export function usePlanActivatedToast(): void {
  const orgId = useOrgId();
  const plan = useOrgPlan();
  const toast = useToast();
  const baseline = useRef<{ orgId: string; planId: number | null; isExpired: boolean; isFreeTrial: boolean } | null>(null);

  useEffect(() => {
    if (!plan.status) return;
    const next = { planId: plan.planId, isExpired: plan.isExpired, isFreeTrial: plan.isFreeTrial };
    const prev = baseline.current && baseline.current.orgId === orgId ? baseline.current : null;
    if (isPlanActivation(prev, next)) toast.success('Plan activated! Dashboard refreshed.');
    baseline.current = { orgId, ...next };
  }, [plan.status, plan.planId, plan.isExpired, plan.isFreeTrial, orgId, toast]);
}
