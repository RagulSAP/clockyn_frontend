import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { requestsApi } from '@/api';
import { useToast } from '@/components/ui';
import { usePolling } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import type { RequestType, StaffRequest } from '@/types/api/requests';

import { useSeenStore, seenScope } from '../store/seenStore';
import { pendingIds } from '../utils/badgeLogic';
import { pendingRequestCount, requestsOfType } from '../utils/requestLogic';
import { useScreenFocused } from './useScreenFocused';

/** Polling interval of the hub and the four lists while they are open (v1: 10 s). */
export const REQUESTS_POLL_MS = 10_000;

/**
 * The org's whole request inbox (all four types, one call): shared by the hub, the four lists, the badges and the
 * Home tile so a single fetch feeds them all. Scoped by org id in the key.
 */
export function useAdminRequestsQuery(options: { enabled?: boolean } = {}): UseQueryResult<StaffRequest[]> {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.requests.admin(orgId),
    queryFn: () => requestsApi.listAdminRequests(orgId),
    enabled: orgId !== '' && (options.enabled ?? true),
    staleTime: 5_000,
  });
}

/** Poll the inbox every 10 s while the screen is focused (stops while another screen covers it). */
export function useInboxPolling(query: UseQueryResult<StaffRequest[]>): boolean {
  const focused = useScreenFocused();
  const refetch = query.refetch;
  usePolling(async () => {
    await refetch();
  }, REQUESTS_POLL_MS, { enabled: focused });
  return focused;
}

/** Toasts "Failed to load requests" once when a refresh starts failing (not on every failed poll). */
function useLoadErrorToast(query: UseQueryResult<StaffRequest[]>): void {
  const toast = useToast();
  const failed = query.isError;
  const was = useRef(false);
  const error = query.error;
  useEffect(() => {
    if (failed && !was.current) toast.error(getErrorMessage(error, 'Failed to load requests'));
    was.current = failed;
  }, [failed, error, toast]);
}

export interface RequestListState {
  requests: StaffRequest[];
  /** Header "N Pending". */
  pendingCount: number;
  query: UseQueryResult<StaffRequest[]>;
  /** First load without data. */
  isInitialLoading: boolean;
  /** Pull-to-refresh spinner (not shown for background polls). */
  refreshing: boolean;
  refresh: () => Promise<void>;
}

/** Data, polling and seen-marking of one of the four request lists. */
export function useRequestList(type: RequestType): RequestListState {
  const orgId = useOrgId();
  const userId = useUserId();
  const query = useAdminRequestsQuery();
  useInboxPolling(query);
  useLoadErrorToast(query);
  const markSeen = useSeenStore((s) => s.markSeen);

  const data = query.data;
  const requests = useMemo(() => requestsOfType(data ?? [], type), [data, type]);
  const pendingCount = useMemo(() => pendingRequestCount(requests), [requests]);

  // Opening a list (and every refresh while it is open) marks its pending requests as seen: clears that badge.
  const idsKey = useMemo(() => (data ? pendingIds(data, type).join('|') : null), [data, type]);
  useEffect(() => {
    if (idsKey === null || !data) return;
    markSeen(seenScope(orgId, userId), type, pendingIds(data, type));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey encodes the pending ids of `data`
  }, [idsKey, markSeen, orgId, userId, type]);

  const [refreshing, setRefreshing] = useState(false);
  const refetch = query.refetch;
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return { requests, pendingCount, query, isInitialLoading: query.isPending && !data, refreshing, refresh };
}
