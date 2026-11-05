import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { PLAN_STALE_TIME_MS, queryClient } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { getSession } from '@/store/auth';
import { useAppForeground } from './useAppForeground';

/**
 * Re-reads the plan status when it is older than `PLAN_STALE_TIME_MS` (5 min, the v1 cache lifetime). Returns whether a
 * refresh was requested. `invalidateQueries` refetches the mounted observers (the tab bar / sidebar always has one), so
 * the tab gates, the chat / CRM / camera-punch gates and the block messages follow a renewal, upgrade or expiry that
 * happened while the app was open (v1 kept the status for the whole process; native has no window-focus refetch).
 */
export function refreshPlanStatusIfStale(client: QueryClient, orgId: string, now: number = Date.now()): boolean {
  if (!orgId) return false;
  const key = queryKeys.plans.status(orgId);
  const state = client.getQueryState(key);
  if (!state) return false; // never requested: nobody is gating on it yet
  if (state.dataUpdatedAt !== 0 && now - state.dataUpdatedAt < PLAN_STALE_TIME_MS) return false;
  void client.invalidateQueries({ queryKey: key });
  return true;
}

/** Plan-status freshness on every app foreground (mounted once by the bootstrap). */
export function usePlanStatusRefresh(): void {
  const onForeground = useCallback(() => {
    refreshPlanStatusIfStale(queryClient, getSession()?.orgId ?? '');
  }, []);
  useAppForeground(onForeground);
}
