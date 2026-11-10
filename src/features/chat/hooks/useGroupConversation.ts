import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { groupChatApi } from '@/api';
import { useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useLatestRef } from '@/lib/realtime/useLatestRef';
import { useGroupSocket } from '@/lib/realtime/socket';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import { badges } from '@/store/badges';
import type { GroupMember, GroupSummary } from '@/types/api/groupChat';
import type { ChatItem } from '../types';
import { applyIncomingToGroupList, applySentToGroupList, setGroupMemberCount, zeroGroupUnread } from '../utils/chatLists';
import { openConversationRegistry } from '../utils/chatSession';
import { interpretChatFrame, readAppliesToGroup } from '../utils/frames';
import {
  chatItemFromGroup,
  createOptimisticItem,
  groupBelongs,
  messageLogReducer,
  newClientId,
} from '../utils/messageLog';
import type { PickedAttachment } from './usePickAttachment';
import { useGroupListQuery } from './useGroupChatList';

const READ_REFETCH_DELAY_MS = 800;

export interface GroupConversationState {
  group: GroupSummary | undefined;
  members: GroupMember[];
  membersLoading: boolean;
  /** The members failed to load (and none are known): the members sheet shows an error with a retry. */
  membersError: unknown;
  refetchMembers: () => Promise<unknown>;
  items: ChatItem[];
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  uploading: boolean;
  sendText: (text: string) => Promise<void>;
  /** Sends a photo / file the person already picked and confirmed in the preview. */
  sendAttachment: (attachment: PickedAttachment) => Promise<void>;
  retry: (clientId: string) => Promise<void>;
  discard: (clientId: string) => void;
  /** Adds staff to the group, refreshes the members and the member count; resolves false on failure (toasted). */
  addMembers: (staffIds: string[]) => Promise<boolean>;
}

/**
 * One open group: history + members, live updates (only frames of THIS group), optimistic sends with
 * failed / retry, uploads with progress, read receipts (`read_count` / `total_members`), mark-read and unread /
 * badge bookkeeping.
 */
export function useGroupConversation(groupId: string): GroupConversationState {
  const userId = useUserId();
  const orgId = useOrgId();
  const toast = useToast();
  const queryClient = useQueryClient();
  const listKey = useMemo(() => queryKeys.groupChat.list(userId, orgId), [userId, orgId]);
  const messagesKey = useMemo(() => queryKeys.groupChat.messages(userId, groupId), [userId, groupId]);
  const membersKey = useMemo(() => queryKeys.groupChat.members(userId, groupId), [userId, groupId]);

  const [items, dispatch] = useReducer(messageLogReducer, [] as ChatItem[]);
  const itemsRef = useLatestRef(items);
  const handledIncoming = useRef(new Set<string>());
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listQuery = useGroupListQuery();
  const group = listQuery.data?.find((g) => g.groupId === groupId);

  const history = useQuery({
    queryKey: messagesKey,
    queryFn: () => groupChatApi.getGroupMessages(groupId, userId),
    enabled: userId !== '' && groupId !== '',
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: 'always',
  });
  const { refetch } = history;

  const membersQuery = useQuery({
    queryKey: membersKey,
    queryFn: () => groupChatApi.getGroupMembers(groupId),
    enabled: groupId !== '',
    staleTime: 0,
  });
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const membersRef = useLatestRef(members);

  useEffect(() => {
    if (history.data) dispatch({ type: 'history', items: history.data.map((m) => chatItemFromGroup(m, userId)) });
  }, [history.data, userId]);

  const markRead = useCallback(() => {
    groupChatApi.markGroupRead(groupId, userId).catch((e: unknown) => console.warn('[chat] group mark-read failed', getErrorMessage(e)));
  }, [groupId, userId]);

  // opening: zero this group's unread, lower the badge by what it held, tell the server
  useEffect(() => {
    if (!userId || !groupId) return undefined;
    openConversationRegistry.setGroup(groupId);
    const cached = queryClient.getQueryData<GroupSummary[]>(listKey)?.find((g) => g.groupId === groupId);
    const previous = cached?.unreadCount ?? 0;
    queryClient.setQueryData<GroupSummary[]>(listKey, (old) => (old ? zeroGroupUnread(old, groupId) : old));
    if (previous > 0) badges.markChatRead('group', previous);
    markRead();
    return () => {
      if (openConversationRegistry.group() === groupId) openConversationRegistry.setGroup(null);
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [groupId, userId, listKey, queryClient, markRead]);

  const onFrame = useCallback(
    (frame: unknown) => {
      const f = interpretChatFrame(frame);
      if (f.kind === 'group_message') {
        const m = f.message;
        // the group socket carries every conversation of the user: keep only this group's messages
        if (!groupBelongs(m, groupId)) return;
        dispatch({ type: 'incoming', item: chatItemFromGroup(m, userId) });
        if (m.senderId !== userId && !handledIncoming.current.has(m.id)) {
          handledIncoming.current.add(m.id);
          badges.incrementChatForMessage('group', m.id);
          badges.markChatRead('group', 1);
          markRead();
        }
        queryClient.setQueryData<GroupSummary[]>(listKey, (old) => (old ? applyIncomingToGroupList(old, m, userId, groupId).list : old));
        return;
      }
      if (f.kind === 'read') {
        if (!readAppliesToGroup(f.read, userId, groupId)) return;
        if (f.read.readCount !== null || f.read.totalMembers !== null) {
          dispatch({
            type: 'group_read',
            messageId: f.read.messageId ?? undefined,
            readCount: f.read.readCount ?? undefined,
            totalMembers: f.read.totalMembers ?? undefined,
            fallbackTotal: Math.max(0, membersRef.current.length - 1),
          });
        } else {
          // the server only said "someone read": the receipts come from a (debounced) history refresh
          if (readTimer.current) clearTimeout(readTimer.current);
          readTimer.current = setTimeout(() => void refetch(), READ_REFETCH_DELAY_MS);
        }
      }
    },
    [groupId, userId, queryClient, listKey, markRead, membersRef, refetch],
  );
  useGroupSocket(groupId, userId, onFrame, {
    onReconnect: () => {
      void refetch();
      markRead();
    },
  });

  const deliver = useCallback(
    async (item: ChatItem) => {
      const clientId = item.clientId;
      const retry = item.retry;
      if (!clientId || !retry) return;
      try {
        const sent =
          retry.kind === 'text'
            ? await groupChatApi.sendGroupMessage(groupId, userId, item.text)
            : await groupChatApi.sendGroupFile({
                senderId: userId,
                groupId,
                fileUri: retry.uri,
                fileName: retry.fileName,
                mimeType: retry.mimeType,
                onProgress: (progress) => dispatch({ type: 'progress', clientId, progress }),
              });
        const confirmed = chatItemFromGroup(sent, userId);
        dispatch({ type: 'confirmed', clientId, item: confirmed.id ? confirmed : { ...confirmed, id: clientId } });
      } catch (e) {
        dispatch({ type: 'failed', clientId });
        toast.error(getErrorMessage(e, retry.kind === 'text' ? 'Failed to send message' : 'Upload failed'));
      }
    },
    [groupId, userId, toast],
  );

  const previewSent = useCallback(
    (text: string, at: string) => {
      queryClient.setQueryData<GroupSummary[]>(listKey, (old) => (old ? applySentToGroupList(old, groupId, text, at) : old));
    },
    [queryClient, listKey, groupId],
  );

  const sendText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !userId || !groupId) return;
      const item = createOptimisticItem({ clientId: newClientId(), senderId: userId, text, type: 'text', retry: { kind: 'text' } });
      dispatch({ type: 'optimistic', item });
      previewSent(text, item.sentAt);
      await deliver(item);
    },
    [userId, groupId, deliver, previewSent],
  );

  const sendAttachment = useCallback(
    async (asset: PickedAttachment) => {
      if (!userId || !groupId) return;
      const item = createOptimisticItem({
        clientId: newClientId(),
        senderId: userId,
        text: asset.fileName,
        type: asset.type,
        localUri: asset.uri,
        retry: { kind: 'file', uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType },
      });
      dispatch({ type: 'optimistic', item });
      previewSent(asset.fileName, item.sentAt);
      await deliver(item);
    },
    [userId, groupId, deliver, previewSent],
  );

  const retry = useCallback(
    async (clientId: string) => {
      const item = itemsRef.current.find((i) => i.clientId === clientId && i.state === 'failed');
      if (!item) return;
      dispatch({ type: 'retrying', clientId });
      await deliver(item);
    },
    [itemsRef, deliver],
  );

  const discard = useCallback((clientId: string) => dispatch({ type: 'discard', clientId }), []);

  const addMembers = useCallback(
    async (staffIds: string[]): Promise<boolean> => {
      if (staffIds.length === 0) return false;
      try {
        await groupChatApi.addGroupMembers(groupId, staffIds);
        const next = await groupChatApi.getGroupMembers(groupId);
        queryClient.setQueryData(membersKey, next);
        queryClient.setQueryData<GroupSummary[]>(listKey, (old) => (old ? setGroupMemberCount(old, groupId, next.length) : old));
        toast.success(`${staffIds.length} staff added!`);
        return true;
      } catch (e) {
        toast.error(getErrorMessage(e, 'Failed to add staff'));
        return false;
      }
    },
    [groupId, queryClient, membersKey, listKey, toast],
  );

  const uploading = useMemo(() => items.some((i) => i.state === 'sending' && i.retry?.kind === 'file'), [items]);

  return {
    group,
    members,
    membersLoading: membersQuery.isLoading,
    membersError: membersQuery.isError && !membersQuery.data ? membersQuery.error : null,
    refetchMembers: membersQuery.refetch,
    items,
    isLoading: history.isLoading,
    error: history.error,
    refetch,
    uploading,
    sendText,
    sendAttachment,
    retry,
    discard,
    addMembers,
  };
}
