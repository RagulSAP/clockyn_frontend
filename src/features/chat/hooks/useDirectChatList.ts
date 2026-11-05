import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { chatApi } from '@/api';
import { useRefreshOnFocus } from '@/hooks';
import { useChatSocket } from '@/lib/realtime/socket';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useRole, useUserId } from '@/store/auth';
import { badges } from '@/store/badges';
import type { ChatContact } from '@/types/api/chat';
import type { ChatVariant } from '../types';
import { applyIncomingToChatList, chatContactFromAdmin, mergeAdminFirst, totalUnread } from '../utils/chatLists';
import { openConversationRegistry } from '../utils/chatSession';
import { interpretChatFrame } from '../utils/frames';
import { peerOfMessage } from '../utils/messageLog';
import { useOrgAdminContact } from './useStaffDirectory';

export interface DirectChatListState {
  /** Conversations in display order (admin first for managers / staff). */
  contacts: ChatContact[];
  /** The list exactly as the server sent it (used to check whether someone already has a conversation). */
  serverList: ChatContact[];
  /** Managers / staff on the admin screens only see admin conversations. */
  adminOnly: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/**
 * The 1:1 conversation list: server list + live socket updates + admin pinned first for managers / staff +
 * chat-badge synchronisation (the badge section is re-derived from every list that loads).
 */
export function useDirectChatList(variant: ChatVariant): DirectChatListState {
  const userId = useUserId();
  const orgId = useOrgId();
  const role = useRole();
  const queryClient = useQueryClient();
  const listKey = useMemo(() => queryKeys.chat.list(userId, orgId), [userId, orgId]);

  const isAdminUser = role === 1;
  const adminOnly = variant === 'admin' && !isAdminUser;

  const query = useQuery({
    queryKey: listKey,
    queryFn: () => chatApi.getChatList(userId, orgId),
    enabled: userId !== '' && orgId !== '',
  });
  const adminQuery = useOrgAdminContact(!isAdminUser);
  const { refetch } = query;

  useRefreshOnFocus(refetch);

  useEffect(() => {
    if (query.data) badges.setChatSection('individual', totalUnread(query.data));
  }, [query.data]);

  const onFrame = useCallback(
    (frame: unknown) => {
      const f = interpretChatFrame(frame);
      if (f.kind !== 'direct_message') return;
      const open = openConversationRegistry.direct();
      // the open conversation settles its own messages
      if (open && peerOfMessage(f.message, userId) === open) return;
      let needsRefetch = false;
      queryClient.setQueryData<ChatContact[]>(listKey, (old) => {
        if (!old) return old;
        const update = applyIncomingToChatList(old, f.message, userId, open);
        needsRefetch = update.needsRefetch;
        return update.list;
      });
      if (needsRefetch) void queryClient.invalidateQueries({ queryKey: listKey });
    },
    [listKey, queryClient, userId],
  );
  useChatSocket(userId, onFrame, { onReconnect: () => void refetch() });

  const adminContact = useMemo(() => (adminQuery.data ? chatContactFromAdmin(adminQuery.data) : null), [adminQuery.data]);
  const serverList = query.data;
  const contacts = useMemo(
    () => (isAdminUser ? [...(serverList ?? [])] : mergeAdminFirst(serverList ?? [], adminContact)),
    [serverList, adminContact, isAdminUser],
  );

  return {
    contacts,
    serverList: serverList ?? [],
    adminOnly,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    error: query.error,
    refetch,
  };
}
