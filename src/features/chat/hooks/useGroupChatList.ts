import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { groupChatApi } from '@/api';
import { useRefreshOnFocus } from '@/hooks';
import { useChatSocket } from '@/lib/realtime/socket';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import { badges } from '@/store/badges';
import type { GroupSummary } from '@/types/api/groupChat';
import { applyIncomingToGroupList, totalUnread } from '../utils/chatLists';
import { openConversationRegistry } from '../utils/chatSession';
import { interpretChatFrame } from '../utils/frames';

export interface GroupChatListState {
  groups: GroupSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/** Query of the groups the user belongs to (`org_id` is sent — v1 sent a parameter the server rejects). */
export function useGroupListQuery() {
  const userId = useUserId();
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.groupChat.list(userId, orgId),
    queryFn: () => groupChatApi.listGroups(userId, orgId),
    enabled: userId !== '' && orgId !== '',
  });
}

/** The group list: server list + live socket updates for groups that are not open + group badge synchronisation. */
export function useGroupChatList(): GroupChatListState {
  const userId = useUserId();
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const listKey = useMemo(() => queryKeys.groupChat.list(userId, orgId), [userId, orgId]);
  const query = useGroupListQuery();
  const { refetch } = query;

  useRefreshOnFocus(refetch);

  useEffect(() => {
    if (query.data) badges.setChatSection('group', totalUnread(query.data));
  }, [query.data]);

  const onFrame = useCallback(
    (frame: unknown) => {
      const f = interpretChatFrame(frame);
      if (f.kind === 'group_created') {
        void queryClient.invalidateQueries({ queryKey: listKey });
        return;
      }
      if (f.kind !== 'group_message') return;
      const open = openConversationRegistry.group();
      if (open && f.message.groupId === open) return; // the open group settles its own messages
      let needsRefetch = false;
      queryClient.setQueryData<GroupSummary[]>(listKey, (old) => {
        if (!old) return old;
        const update = applyIncomingToGroupList(old, f.message, userId, open);
        needsRefetch = update.needsRefetch;
        return update.list;
      });
      if (needsRefetch) void queryClient.invalidateQueries({ queryKey: listKey });
    },
    [listKey, queryClient, userId],
  );
  useChatSocket(userId, onFrame, { onReconnect: () => void refetch() });

  return {
    groups: query.data ?? [],
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    error: query.error,
    refetch,
  };
}
