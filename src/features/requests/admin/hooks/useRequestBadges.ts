import { useEffect, useMemo } from 'react';

import { badges } from '@/store/badges';
import { useOrgId, useUserId } from '@/store/auth';

import { useSeenStore, seenScope } from '../store/seenStore';
import { countPending, countUnread, pendingIds, ZERO_COUNTS, type TypeCounts } from '../utils/badgeLogic';
import type { RequestType } from '@/types/api/requests';
import { useAdminRequestsQuery } from './useAdminRequests';

export interface RequestBadges {
  /** Requests still needing a decision, per type. `pending.total` feeds the Home "Requests" tile. */
  pending: TypeCounts;
  /** Pending requests not seen yet, per type. Feeds the hub rows; clears when that list is opened. */
  unread: TypeCounts;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
  /** Marks the currently pending requests of a type as seen. (The list screens do this themselves.) */
  markSeen: (type: RequestType) => void;
}

/**
 * One badge model for Home and the Requests hub (v1 used two different metrics). Pass `enabled: false` where the
 * viewer cannot manage requests. Keeps the global `requests` badge (`@/store/badges`) in sync with `pending.total`.
 */
export function useRequestBadges(options: { enabled?: boolean } = {}): RequestBadges {
  const orgId = useOrgId();
  const userId = useUserId();
  const query = useAdminRequestsQuery({ enabled: options.enabled });
  const scope = seenScope(orgId, userId);
  const seen = useSeenStore((s) => s.seen[scope]);
  const markSeenInStore = useSeenStore((s) => s.markSeen);
  const data = query.data;

  const pending = useMemo(() => (data ? countPending(data) : ZERO_COUNTS), [data]);
  const unread = useMemo(() => (data ? countUnread(data, seen) : ZERO_COUNTS), [data, seen]);

  const total = pending.total;
  const loaded = data !== undefined;
  useEffect(() => {
    if (loaded) badges.set('requests', total);
  }, [loaded, total]);

  const refetch = query.refetch;
  return useMemo(
    () => ({
      pending,
      unread,
      isLoading: query.isPending && !loaded,
      refetch: () => refetch(),
      markSeen: (type: RequestType) => {
        if (data) markSeenInStore(scope, type, pendingIds(data, type));
      },
    }),
    [pending, unread, query.isPending, loaded, refetch, data, markSeenInStore, scope],
  );
}
