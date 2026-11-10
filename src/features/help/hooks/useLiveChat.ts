import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';

import { liveChatApi } from '@/api';
import { useToast } from '@/components/ui';
import type { ChatItem } from '@/features/chat/types';
import type { PickedAttachment } from '@/features/chat/hooks/usePickAttachment';
import { createOptimisticItem, messageLogReducer, newClientId } from '@/features/chat/utils/messageLog';
import { getErrorMessage } from '@/lib/api/errors';
import { liveChatSession } from '@/lib/realtime/liveChatSession';
import { useChatSocket } from '@/lib/realtime/socket';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import { badges } from '@/store/badges';
import { parseLiveChatSocketEvent } from '@/api/liveChat';
import type { LiveChatStatus } from '@/types/api/liveChat';
import { useLatestRef } from '@/lib/realtime/useLatestRef';
import { chatItemFromLive } from '../utils/liveChatItems';

export interface LiveChatState {
  items: ChatItem[];
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  /** `closed` when support closed the thread (sending reopens it); `null` before the first message. */
  status: LiveChatStatus | null;
  /** True while an attachment is uploading. */
  uploading: boolean;
  sendText: (text: string) => Promise<void>;
  /** Sends a photo / file the person already picked and confirmed in the preview. */
  sendAttachment: (attachment: PickedAttachment) => Promise<void>;
  retry: (clientId: string) => Promise<void>;
  discard: (clientId: string) => void;
}

/**
 * The open Live Chat conversation of the admin's organisation with Clockyn support: history, live updates
 * (`live_chat_message` / `live_chat_read` on the per-user socket), optimistic text / photo / file sends with retry,
 * upload progress, read ticks, mark-read and the Support badge bookkeeping.
 */
export function useLiveChat(): LiveChatState {
  const userId = useUserId();
  const orgId = useOrgId();
  const toast = useToast();
  const queryClient = useQueryClient();
  const enabled = userId !== '' && orgId !== '';

  const [items, dispatch] = useReducer(messageLogReducer, [] as ChatItem[]);
  const itemsRef = useLatestRef(items);
  const handledIncoming = useRef(new Set<string>());
  // `dataUpdatedAt` of the history when I last wrote: until the history is loaded again my message has reopened the thread
  const [reopenedAt, setReopenedAt] = useState<number | null>(null);

  const history = useQuery({
    queryKey: queryKeys.liveChat.messages(userId, orgId),
    queryFn: () => liveChatApi.getMessages(orgId, userId),
    enabled,
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: 'always',
  });
  const { refetch } = history;
  const dataUpdatedAtRef = useLatestRef(history.dataUpdatedAt);

  useEffect(() => {
    if (!history.data) return;
    dispatch({ type: 'history', items: history.data.messages.map(chatItemFromLive) });
  }, [history.data]);

  const markRead = useCallback(() => {
    liveChatApi.markRead(orgId, userId).catch((e: unknown) => console.warn('[live-chat] mark-read failed', getErrorMessage(e)));
  }, [orgId, userId]);

  // "open" means FOCUSED, not mounted: a tab switch keeps this screen mounted but hidden, and a reply that lands then
  // must raise the Support badge / push instead of being marked read. Focus (re)gain clears the badge and tells the server.
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      liveChatSession.setOpen(true);
      badges.markRead('liveChat');
      markRead();
      return () => liveChatSession.setOpen(false);
    }, [enabled, markRead]),
  );

  const onFrame = useCallback(
    (frame: unknown) => {
      const ev = parseLiveChatSocketEvent(frame);
      if (ev.type === 'live_chat_message') {
        if (ev.orgId && ev.orgId !== orgId) return;
        const item = chatItemFromLive(ev.message);
        if (!item.id) return;
        dispatch({ type: 'incoming', item });
        // read right away only while the conversation is on screen; otherwise the focus effect marks it read on return
        if (!item.fromMe && liveChatSession.isOpen() && !handledIncoming.current.has(item.id)) {
          handledIncoming.current.add(item.id);
          markRead();
        }
        return;
      }
      if (ev.type === 'live_chat_read' && ev.reader === 'support') dispatch({ type: 'own_read' });
    },
    [orgId, markRead],
  );
  useChatSocket(enabled ? userId : null, onFrame, {
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
            ? await liveChatApi.send({ orgId, userId, message: item.text })
            : await liveChatApi.sendFile({
                orgId,
                userId,
                fileUri: retry.uri,
                fileName: retry.fileName,
                mimeType: retry.mimeType,
                onProgress: (progress) => dispatch({ type: 'progress', clientId, progress }),
              });
        const confirmed = chatItemFromLive(sent);
        dispatch({ type: 'confirmed', clientId, item: confirmed.id ? confirmed : { ...confirmed, id: clientId } });
        setReopenedAt(dataUpdatedAtRef.current);
        void queryClient.invalidateQueries({ queryKey: queryKeys.liveChat.unread(userId, orgId) });
      } catch (e) {
        dispatch({ type: 'failed', clientId });
        toast.error(getErrorMessage(e, retry.kind === 'text' ? 'Failed to send message' : 'Upload failed'));
      }
    },
    [orgId, userId, toast, queryClient, dataUpdatedAtRef],
  );

  const sendText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !enabled) return;
      const item = createOptimisticItem({ clientId: newClientId(), senderId: userId, text, type: 'text', retry: { kind: 'text' } });
      dispatch({ type: 'optimistic', item });
      await deliver(item);
    },
    [enabled, userId, deliver],
  );

  const sendAttachment = useCallback(
    async (asset: PickedAttachment) => {
      if (!enabled) return;
      const item = createOptimisticItem({
        clientId: newClientId(),
        senderId: userId,
        text: asset.fileName,
        type: asset.type,
        localUri: asset.uri,
        retry: { kind: 'file', uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType },
      });
      dispatch({ type: 'optimistic', item });
      await deliver(item);
    },
    [enabled, userId, deliver],
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
  const reopened = reopenedAt !== null && history.dataUpdatedAt <= reopenedAt;
  const status: LiveChatStatus | null = reopened ? 'open' : (history.data?.status ?? null);

  return { items, isLoading: history.isLoading, error: history.error, refetch, status, uploading, sendText, sendAttachment, retry, discard };
}
