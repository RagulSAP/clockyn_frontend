import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi, chatApi } from '@/api';
import { useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useLatestRef } from '@/lib/realtime/useLatestRef';
import { useChatSocket } from '@/lib/realtime/socket';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useRole, useSession, useUserId } from '@/store/auth';
import { badges } from '@/store/badges';
import type { ChatContact, ChatMessage } from '@/types/api/chat';
import type { ChatItem } from '../types';
import { applyIncomingToChatList, applySentToChatList, zeroChatUnread } from '../utils/chatLists';
import { openConversationRegistry } from '../utils/chatSession';
import { interpretChatFrame, readAppliesToDirect } from '../utils/frames';
import {
  chatItemFromDirect,
  createOptimisticItem,
  directBelongs,
  messageLogReducer,
  newClientId,
} from '../utils/messageLog';
import { peerKey } from './keys';
import type { PickedAttachment } from './usePickAttachment';
import { useOrgAdminContact, useStaffDirectory } from './useStaffDirectory';

export interface PeerInfo {
  userId: string;
  name: string;
  roleName: string;
  deptName: string;
  branchName: string;
  photoUrl: string | null;
}

/**
 * Who the open conversation is with: list row -> row opened from the search -> staff directory.
 * `fetchPhoto` (admin screens) loads the profile photo from `/profile-photo/{id}` when the row has none.
 */
export function usePeerInfo(peerId: string, fetchPhoto = false): PeerInfo {
  const userId = useUserId();
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: queryKeys.chat.list(userId, orgId),
    queryFn: () => chatApi.getChatList(userId, orgId),
    enabled: userId !== '' && orgId !== '',
  });
  const fromList = list.data?.find((c) => c.userId === peerId);
  const fromSearch = queryClient.getQueryData<ChatContact>(peerKey(userId, peerId));
  const known = fromList ?? fromSearch;
  const role = useRole();
  const lookup = !known && !list.isLoading;
  const staff = useStaffDirectory(lookup);
  // managers / staff open the admin from a push notification before they ever chatted: the admin is not in the staff list
  const admin = useOrgAdminContact(lookup && role !== 1);
  const fromStaff = staff.data?.find((s) => s.userId === peerId) ?? (admin.data?.userId === peerId ? admin.data : undefined);

  const rowPhoto = known?.photoUrl ?? fromStaff?.photoUrl ?? null;
  const photoQuery = useQuery({
    queryKey: [...queryKeys.chat.all(userId), 'peer-photo', peerId],
    queryFn: () => authApi.getProfilePhotoUrl(peerId),
    enabled: fetchPhoto && peerId !== '' && userId !== '' && !rowPhoto,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const photo = rowPhoto ?? photoQuery.data ?? null;

  return useMemo<PeerInfo>(() => {
    if (known) {
      return {
        userId: peerId,
        name: known.name,
        roleName: known.roleName,
        deptName: known.deptName,
        branchName: known.branchName,
        photoUrl: photo,
      };
    }
    if (fromStaff) {
      return {
        userId: peerId,
        name: fromStaff.name,
        roleName: fromStaff.roleName ?? '',
        deptName: fromStaff.department,
        branchName: fromStaff.branch,
        photoUrl: photo,
      };
    }
    return { userId: peerId, name: '', roleName: '', deptName: '', branchName: '', photoUrl: photo };
  }, [known, fromStaff, peerId, photo]);
}

/** Remember a contact opened from the staff search so the conversation header can show it before any message exists. */
export function rememberPeer(queryClient: ReturnType<typeof useQueryClient>, userId: string, contact: ChatContact): void {
  queryClient.setQueryData(peerKey(userId, contact.userId), contact);
}

export interface DirectConversationState {
  items: ChatItem[];
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  /** True while an attachment is uploading (camera / attach buttons are disabled meanwhile). */
  uploading: boolean;
  sendText: (text: string) => Promise<void>;
  /** Sends a photo / file the person already picked and confirmed in the preview. */
  sendAttachment: (attachment: PickedAttachment) => Promise<void>;
  retry: (clientId: string) => Promise<void>;
  discard: (clientId: string) => void;
}

/**
 * One open 1:1 conversation: history, live updates (only frames of THIS conversation), optimistic sends with
 * failed / retry, uploads with progress, read receipts, mark-read and unread / badge bookkeeping.
 */
export function useDirectConversation(peerId: string): DirectConversationState {
  const userId = useUserId();
  const orgId = useOrgId();
  const session = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const listKey = useMemo(() => queryKeys.chat.list(userId, orgId), [userId, orgId]);
  const senderName = session?.name?.trim() || undefined;

  const [items, dispatch] = useReducer(messageLogReducer, [] as ChatItem[]);
  const itemsRef = useLatestRef(items);
  const handledIncoming = useRef(new Set<string>());

  const history = useQuery({
    queryKey: queryKeys.chat.messages(userId, peerId),
    queryFn: () => chatApi.getChatMessages(userId, peerId),
    enabled: userId !== '' && peerId !== '',
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: 'always',
  });
  const { refetch } = history;

  // history (first load, refetch, reconnect) -> the log, keeping messages that are still in flight
  useEffect(() => {
    if (history.data) dispatch({ type: 'history', items: history.data.map((m) => chatItemFromDirect(m, userId)) });
  }, [history.data, userId]);

  const markRead = useCallback(() => {
    chatApi.markChatRead(peerId, userId).catch((e: unknown) => console.warn('[chat] mark-read failed', getErrorMessage(e)));
  }, [peerId, userId]);

  // opening: zero this conversation's unread, lower the badge by what it held, tell the server
  useEffect(() => {
    if (!userId || !peerId) return undefined;
    openConversationRegistry.setDirect(peerId);
    const cached = queryClient.getQueryData<ChatContact[]>(listKey)?.find((c) => c.userId === peerId);
    const previous = cached?.unreadCount ?? 0;
    queryClient.setQueryData<ChatContact[]>(listKey, (old) => (old ? zeroChatUnread(old, peerId) : old));
    if (previous > 0) badges.markChatRead('individual', previous);
    markRead();
    return () => {
      if (openConversationRegistry.direct() === peerId) openConversationRegistry.setDirect(null);
    };
  }, [peerId, userId, listKey, queryClient, markRead]);

  const peerContact = useCallback(
    (): ChatContact =>
      queryClient.getQueryData<ChatContact[]>(listKey)?.find((c) => c.userId === peerId) ??
      queryClient.getQueryData<ChatContact>(peerKey(userId, peerId)) ?? {
        userId: peerId,
        name: '',
        roleName: '',
        deptName: '',
        branchName: '',
        lastMessage: null,
        lastMessageType: null,
        lastMessageAt: null,
        unreadCount: 0,
        isOnline: false,
        photoUrl: null,
        raw: {},
      },
    [queryClient, listKey, userId, peerId],
  );

  const updateListPreview = useCallback(
    (preview: { text: string; type: ChatMessage['type']; at: string }) => {
      queryClient.setQueryData<ChatContact[]>(listKey, (old) => (old ? applySentToChatList(old, peerContact(), preview) : old));
    },
    [queryClient, listKey, peerContact],
  );

  const onFrame = useCallback(
    (frame: unknown) => {
      const f = interpretChatFrame(frame);
      switch (f.kind) {
        case 'direct_message': {
          const m = f.message;
          // v1 appended every incoming message to the open conversation, whoever it was from
          if (!directBelongs(m, userId, peerId)) return;
          const item = chatItemFromDirect(m, userId);
          dispatch({ type: 'incoming', item });
          if (m.senderId !== userId && !handledIncoming.current.has(m.id)) {
            handledIncoming.current.add(m.id);
            // the global socket counts it as unread; this conversation is open, so it is read right away
            badges.incrementChatForMessage('individual', m.id);
            badges.markChatRead('individual', 1);
            markRead();
          }
          queryClient.setQueryData<ChatContact[]>(listKey, (old) => {
            if (!old) return old;
            const update = applyIncomingToChatList(old, m, userId, peerId);
            return update.needsRefetch ? applySentToChatList(old, peerContact(), { text: m.text, type: m.type, at: m.sentAt }) : update.list;
          });
          return;
        }
        case 'read':
          if (readAppliesToDirect(f.read, userId, peerId)) dispatch({ type: 'own_read' });
          return;
        case 'delivered':
          dispatch({ type: 'delivered', messageId: f.messageId });
          return;
        default:
          return;
      }
    },
    [userId, peerId, queryClient, listKey, peerContact, markRead],
  );
  useChatSocket(userId && peerId ? userId : null, onFrame, {
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
            ? await chatApi.sendChatMessage({ senderId: userId, receiverId: peerId, message: item.text, senderName })
            : await chatApi.sendChatFile({
                senderId: userId,
                receiverId: peerId,
                fileUri: retry.uri,
                fileName: retry.fileName,
                mimeType: retry.mimeType,
                senderName,
                onProgress: (progress) => dispatch({ type: 'progress', clientId, progress }),
              });
        const confirmed = chatItemFromDirect(sent, userId);
        dispatch({ type: 'confirmed', clientId, item: confirmed.id ? confirmed : { ...confirmed, id: clientId } });
        updateListPreview({ text: sent.text || item.text, type: sent.type, at: sent.sentAt });
      } catch (e) {
        dispatch({ type: 'failed', clientId });
        toast.error(getErrorMessage(e, retry.kind === 'text' ? 'Failed to send message' : 'Upload failed'));
      }
    },
    [userId, peerId, senderName, toast, updateListPreview],
  );

  const sendText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !userId || !peerId) return;
      const item = createOptimisticItem({ clientId: newClientId(), senderId: userId, text, type: 'text', retry: { kind: 'text' } });
      dispatch({ type: 'optimistic', item });
      updateListPreview({ text, type: 'text', at: item.sentAt });
      await deliver(item);
    },
    [userId, peerId, deliver, updateListPreview],
  );

  const sendAttachment = useCallback(
    async (asset: PickedAttachment) => {
      if (!userId || !peerId) return;
      const item = createOptimisticItem({
        clientId: newClientId(),
        senderId: userId,
        text: asset.fileName,
        type: asset.type,
        localUri: asset.uri,
        retry: { kind: 'file', uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType },
      });
      dispatch({ type: 'optimistic', item });
      updateListPreview({ text: asset.fileName, type: asset.type, at: item.sentAt });
      await deliver(item);
    },
    [userId, peerId, deliver, updateListPreview],
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

  const uploading = useMemo(() => items.some((i) => i.state === 'sending' && i.retry?.kind === 'file'), [items]);

  return { items, isLoading: history.isLoading, error: history.error, refetch, uploading, sendText, sendAttachment, retry, discard };
}
