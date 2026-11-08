/**
 * Realtime public API (CONTRACTS §6): `createSocket` (+ backoff / dedupe helpers) and the hooks
 *  - `useGlobalSocket()`            mounted by the root bootstrap: feeds `@/store/badges`;
 *  - `useChatSocket(userId, fn)`    chat screens: every frame of the per-user socket;
 *  - `useGroupSocket(groupId, userId, fn)` group chat screens (same backend manager, filter by `data.group_id`).
 *
 * Fixes over v1: sockets reconnect with backoff (also the chat/group ones), rebind when the user changes, close
 * on sign-out, respect the CONNECTING state on foreground, and badge counting happens ONLY in the global socket
 * (chat sockets never count — no double counting; message ids are de-duplicated across all sources).
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { queryClient } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';
import { realtimeBus } from './events';
import { useLatestRef } from './useLatestRef';
import { handleSocketFrame, setGlobalSocketOpen } from './globalRealtime';
import { chatSocketPath, createSocket, groupSocketPath, type ManagedSocket } from './socketCore';

export * from './socketCore';
export { realtimeBus } from './events';
export type { RealtimeEvent, PunchNotification } from './events';

/** Reconnect on every app foreground (a no-op while the socket is open or connecting). */
function useReconnectOnForeground(socketRef: { current: ManagedSocket | null }, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') socketRef.current?.reconnectNow();
    });
    return () => sub.remove();
  }, [enabled, socketRef]);
}

/**
 * The single app-wide socket (`/ws/chat/{userId}`), bound to the REACTIVE session: it opens when a user is
 * signed in, rebinds when the user changes and closes on sign-out. After a reconnect the chat / group caches are
 * invalidated so anything missed while offline is fetched.
 */
export function useGlobalSocket(): void {
  const userId = useSession()?.userId ?? null;
  const socketRef = useRef<ManagedSocket | null>(null);

  useEffect(() => {
    if (!userId) return;
    const socket = createSocket({
      path: chatSocketPath(userId),
      onMessage: (frame) => {
        handleSocketFrame(frame);
      },
      onOpen: ({ reconnected }) => {
        setGlobalSocketOpen(true);
        if (reconnected) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all(userId) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.groupChat.all(userId) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.liveChat.all(userId) });
          realtimeBus.emit({ type: 'socket_reconnected' });
        }
      },
      onClose: () => setGlobalSocketOpen(false),
    });
    socketRef.current = socket;
    return () => {
      socketRef.current = null;
      socket.close();
      setGlobalSocketOpen(false);
    };
  }, [userId]);

  useReconnectOnForeground(socketRef, !!userId);
}

type ChatSocketOptions = {
  /** Called after the socket reconnected (not on the first open): refetch what was missed while offline. */
  onReconnect?: () => void;
};

function useScreenSocket(path: string | null, onMessage: (message: unknown) => void, opts?: ChatSocketOptions): void {
  const handlerRef = useLatestRef(onMessage);
  const reconnectRef = useLatestRef(opts?.onReconnect);
  const socketRef = useRef<ManagedSocket | null>(null);

  useEffect(() => {
    if (!path) return;
    const socket = createSocket({
      path,
      onMessage: (message) => handlerRef.current(message),
      onOpen: ({ reconnected }) => {
        if (reconnected) reconnectRef.current?.();
      },
    });
    socketRef.current = socket;
    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [path, handlerRef, reconnectRef]);

  useReconnectOnForeground(socketRef, !!path);
}

/**
 * Per-user chat socket for chat screens. Delivers every decoded frame (`new_message`, `new_group_message`,
 * `read_update`, `group_created`, …) to `onMessage` (latest closure; no need to memoise). Rebinds when `userId`
 * changes; pass `null`/`''` to stay disconnected. It never touches badge counts.
 */
export function useChatSocket(userId: string | null | undefined, onMessage: (message: unknown) => void, opts?: ChatSocketOptions): void {
  useScreenSocket(userId ? chatSocketPath(userId) : null, onMessage, opts);
}

/** Group chat socket. The backend delivers the same per-user events on it, so filter by `data.group_id`. */
export function useGroupSocket(
  groupId: string | null | undefined,
  userId: string | null | undefined,
  onMessage: (message: unknown) => void,
  opts?: ChatSocketOptions,
): void {
  useScreenSocket(groupId && userId ? groupSocketPath(groupId, userId) : null, onMessage, opts);
}
