import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { branchesApi, locationApi } from '@/api';
import { useOrgPlan, usePolling } from '@/hooks';
import { isApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';

import { isTodayIST } from '../utils/freshness';

export const LOCATION_POLL_MS = 10_000;

function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

/**
 * Live staff positions of a date, the selected staff member's route and the branch list.
 *
 *  - The plan gate comes first: nothing is fetched while the plan blocks `staff_location` (v1 fetched behind the lock).
 *  - Today only: positions (and the open route) refresh every 10 s while the screen is focused; past dates are static.
 *  - `date` is an IST calendar date; "today" is compared in IST too (v1 mixed device-local and UTC dates).
 */
export function useStaffLocation(date: string, selectedId: string | null) {
  const orgId = useOrgId();
  const plan = useOrgPlan();
  const focused = useScreenFocused();

  const planBlocked = plan.isBlocked('staff_location');
  const enabled = orgId !== '' && !plan.isLoading && !planBlocked;

  const live = useQuery({
    queryKey: queryKeys.location.live(orgId, date),
    queryFn: () => locationApi.listStaffLocations(orgId, date),
    enabled,
    retry: (count, error) => !(isApiError(error) && error.status === 403) && count < 2,
  });

  const history = useQuery({
    queryKey: queryKeys.location.history(orgId, selectedId ?? '', date),
    queryFn: () => locationApi.getLocationHistory(selectedId ?? '', date, date),
    enabled: enabled && !!selectedId,
  });

  const branches = useQuery({
    queryKey: queryKeys.branches.list(orgId),
    queryFn: () => branchesApi.listBranches(orgId),
    enabled,
    staleTime: 5 * 60_000,
  });

  const today = isTodayIST(date);
  const [tick, setTick] = useState(() => Date.now());
  const refetchLive = live.refetch;
  const refetchHistory = history.refetch;
  const { trigger } = usePolling(
    async () => {
      await Promise.all([refetchLive(), selectedId ? refetchHistory() : Promise.resolve()]);
      setTick(Date.now());
    },
    LOCATION_POLL_MS,
    { enabled: enabled && today && focused },
  );

  // freshness is evaluated against the later of the last poll tick and the last data update
  const now = Math.max(tick, live.dataUpdatedAt);
  const forbidden = isApiError(live.error) && live.error.status === 403;
  const blocked = planBlocked || forbidden;
  const blockMessage = planBlocked ? (plan.isExpired ? plan.panelMessage : plan.message('staff_location') || plan.panelMessage) : forbidden && live.error ? live.error.message : '';

  return { plan, live, history, branches, today, now, blocked, blockMessage, planChecking: plan.isLoading, refreshNow: trigger };
}
