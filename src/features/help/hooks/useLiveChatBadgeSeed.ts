import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { liveChatApi } from '@/api';
import { liveChatSession } from '@/lib/realtime/liveChatSession';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useRole, useUserId } from '@/store/auth';
import { badges } from '@/store/badges';

const SEED_STALE_MS = 60_000;

/**
 * Seeds the Support tab badge (unread messages from support) for admins as soon as a session exists, so an admin who
 * restarts the app with an unanswered reply sees it before opening Live Chat. The global socket and push keep it
 * current afterwards. Managers and staff have no Live Chat and never ask. A failed load leaves the badge as it is.
 * Mounted once by the app bootstrap.
 */
export function useLiveChatBadgeSeed(): void {
  const userId = useUserId();
  const orgId = useOrgId();
  const role = useRole();
  const on = role === 1 && userId !== '' && orgId !== '';

  const unread = useQuery({
    queryKey: queryKeys.liveChat.unread(userId, orgId),
    queryFn: () => liveChatApi.getUnread(orgId, userId),
    enabled: on,
    retry: false,
    staleTime: SEED_STALE_MS,
  });

  useEffect(() => {
    if (unread.data === undefined || liveChatSession.isOpen()) return;
    badges.set('liveChat', unread.data);
  }, [unread.data, unread.dataUpdatedAt]);
}
