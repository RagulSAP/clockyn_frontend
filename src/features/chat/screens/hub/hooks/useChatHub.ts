import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { useAnnouncementUnread } from '@/features/announcements';
import { getOrgLogoUrl } from '@/api/auth';
import { getChatUnreadTotal } from '@/api/chat';
import { getCompanyDetails } from '@/api/company';
import { getGroupUnreadTotal } from '@/api/groupChat';
import { useOrgPlan, useRefreshOnFocus } from '@/hooks';
import { PLAN_STALE_TIME_MS } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import { badges, useBadgeStore } from '@/store/badges';
import { decideChatGate, type ChatGate, type HubAudience, type HubCounts } from '../hubLogic';

/** Chat plan gate for a hub (reads the plan status for every role; refreshed by react-query, never cached forever). */
export function useChatGate(audience: HubAudience): ChatGate {
  const plan = useOrgPlan();
  return decideChatGate({
    isLoading: plan.isLoading,
    blocked: plan.isBlocked('chat'),
    audience,
    message: plan.message('chat'),
    platformOS: Platform.OS,
  });
}

/**
 * Keeps the individual + group unread counters (`@/store/badges`) in step with the server: loaded on mount, on every
 * focus and after a socket reconnect (the global socket invalidates the chat caches). A failed refresh keeps the
 * previous counts (v1 wrote 0 on a transient error).
 */
export function useChatUnreadSync(enabled: boolean): void {
  const userId = useUserId();
  const orgId = useOrgId();
  const on = enabled && userId !== '' && orgId !== '';

  const individual = useQuery({
    queryKey: [...queryKeys.chat.unread(userId), 'hub', orgId],
    queryFn: () => getChatUnreadTotal(userId, orgId),
    enabled: on,
  });
  const group = useQuery({
    queryKey: [...queryKeys.groupChat.unread(userId), 'hub', orgId],
    queryFn: () => getGroupUnreadTotal(userId, orgId),
    enabled: on,
  });

  useEffect(() => {
    if (individual.data !== undefined) badges.setChatSection('individual', individual.data);
  }, [individual.data, individual.dataUpdatedAt]);
  useEffect(() => {
    if (group.data !== undefined) badges.setChatSection('group', group.data);
  }, [group.data, group.dataUpdatedAt]);

  useRefreshOnFocus(() => {
    if (!on) return;
    void individual.refetch();
    void group.refetch();
  });
}

/** Unread counters of the four cards (chat sections from the badge store, announcements from the seen-ids counters). */
export function useHubCounts(): HubCounts {
  const individual = useBadgeStore((s) => s.chatIndividual);
  const group = useBadgeStore((s) => s.chatGroup);
  const { broadcast, targeted } = useAnnouncementUnread();
  return { individual, group, broadcast, targeted };
}

/**
 * Company logo for the staff / manager header (v1 showed the cached company logo, else the chat icon). Uses the
 * same cache entry as the staff home screen; silent on failure (the header shows the icon).
 */
export function useStaffOrgLogo(): string | undefined {
  const orgId = useOrgId();
  const q = useQuery({
    queryKey: queryKeys.company.logo(orgId),
    queryFn: () => getOrgLogoUrl(orgId),
    enabled: orgId !== '',
    retry: false,
    staleTime: PLAN_STALE_TIME_MS,
  });
  return q.data || undefined;
}

/** Company logo for the admin header (silent on failure: the header shows an icon instead). */
export function useCompanyLogo(enabled: boolean): string | undefined {
  const orgId = useOrgId();
  const q = useQuery({
    queryKey: queryKeys.company.details(orgId),
    queryFn: () => getCompanyDetails(orgId),
    enabled: enabled && orgId !== '',
    retry: false,
    staleTime: 10 * 60_000,
  });
  return q.data?.logoUrl || undefined;
}
