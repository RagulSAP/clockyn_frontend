import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getChatUnreadTotal } from '@/api/chat';
import { getGroupUnreadTotal } from '@/api/groupChat';
import { useOrgPlan } from '@/hooks/useOrgPlan';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import { badges } from '@/store/badges';

const SEED_STALE_MS = 60_000;

/**
 * Seeds the Chat tab badge (individual + group unread) as soon as a session exists and the plan allows chat, so a user who restarts the app
 * with unread messages sees the badge before opening the chat hub (the hub, the conversation lists and the global
 * socket keep it current afterwards). It shares its cache entries with the hub (`useChatUnreadSync`), so there is
 * no extra request when the hub is opened. A failed load (e.g. a plan-blocked organisation) leaves the badge as it is.
 *
 * Mounted once by the app bootstrap (no navigation hooks: it lives outside the screens).
 */
export function useChatBadgeSeed(): void {
  const userId = useUserId();
  const orgId = useOrgId();
  const plan = useOrgPlan();
  // A plan-blocked organisation would only get HTTP 500 / 403 answers (and console errors) from both lists: do not ask.
  const on = userId !== '' && orgId !== '' && !plan.isLoading && !plan.isBlocked('chat');

  const individual = useQuery({
    queryKey: [...queryKeys.chat.unread(userId), 'hub', orgId],
    queryFn: () => getChatUnreadTotal(userId, orgId),
    enabled: on,
    retry: false,
    staleTime: SEED_STALE_MS,
  });
  const group = useQuery({
    queryKey: [...queryKeys.groupChat.unread(userId), 'hub', orgId],
    queryFn: () => getGroupUnreadTotal(userId, orgId),
    enabled: on,
    retry: false,
    staleTime: SEED_STALE_MS,
  });

  useEffect(() => {
    if (individual.data !== undefined) badges.setChatSection('individual', individual.data);
  }, [individual.data, individual.dataUpdatedAt]);
  useEffect(() => {
    if (group.data !== undefined) badges.setChatSection('group', group.data);
  }, [group.data, group.dataUpdatedAt]);
}
