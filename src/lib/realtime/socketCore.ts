/**
 * Realtime socket helper — one WebSocket with exponential-backoff reconnect, keep-alive ping and a
 * clean close. Works with the browser WebSocket (web) and React Native's global WebSocket (native).
 *
 * Differences from the v1 sockets (fixed here):
 *  - reconnects ALWAYS (v1 chat/group sockets never reconnected), with exponential backoff + jitter;
 *  - the CONNECTING state is respected (no second socket when the app returns to the foreground);
 *  - `close()` cancels every timer and detaches every handler (no leaks, no zombie reconnects).
 */
import { wsBaseUrl } from '@/config/env';
import { getAccessToken } from '@/store/auth';

export type BackoffOptions = {
  /** Delay before the first retry (ms). */
  baseMs: number;
  /** Upper bound for a single delay (ms). */
  maxMs: number;
  /** Multiplier applied per failed attempt. */
  factor: number;
  /** Random spread, 0..1 (0.2 = +-20 %). */
  jitter: number;
};

export const DEFAULT_BACKOFF: BackoffOptions = { baseMs: 1000, maxMs: 30000, factor: 2, jitter: 0.2 };

/**
 * Delay (ms) before reconnect attempt number `attempt` (0-based).
 * Pure: pass `random` (0..1) to make it deterministic.
 */
export function computeBackoff(attempt: number, opts: Partial<BackoffOptions> = {}, random: () => number = Math.random): number {
  const { baseMs, maxMs, factor, jitter } = { ...DEFAULT_BACKOFF, ...opts };
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const raw = Math.min(maxMs, baseMs * Math.pow(factor, safeAttempt));
  // jitter in [-jitter, +jitter] around the raw delay, never above maxMs, never below 0
  const spread = (random() * 2 - 1) * jitter;
  return Math.max(0, Math.min(maxMs, Math.round(raw * (1 + spread))));
}

/**
 * Join the ws base URL and a path (`/ws/chat/1`). Accepts paths with or without a leading slash.
 * `token` (the session's bearer token) is appended as `?token=` — the browser WebSocket API cannot set headers.
 */
export function buildSocketUrl(path: string, base: string = wsBaseUrl, token?: string | null): string {
  const cleanBase = base.replace(/\/+$/, '');
  const url = `${cleanBase}${path.startsWith('/') ? '' : '/'}${path}`;
  return token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;
}

/** Path of the per-user chat / global socket. */
export const chatSocketPath = (userId: string): string => `/ws/chat/${encodeURIComponent(userId)}`;
/** Path of the group-chat socket (the backend multiplexes it on the same per-user manager). */
export const groupSocketPath = (groupId: string, userId: string): string =>
  `/ws/group-chat/${encodeURIComponent(groupId)}/${encodeURIComponent(userId)}`;

export type SocketCloseInfo = { willReconnect: boolean; code?: number };

export type CreateSocketOptions = {
  /** Path appended to `wsBaseUrl`, e.g. `/ws/chat/123`. */
  path: string;
  /** Called with every JSON-decoded frame (non-JSON frames such as `pong` are ignored). */
  onMessage: (message: unknown) => void;
  /** Fires on the first open AND after every successful reconnect (`reconnected` is true for the latter). */
  onOpen?: (info: { reconnected: boolean }) => void;
  onClose?: (info: SocketCloseInfo) => void;
  /** Keep-alive interval, default 30 000 ms. `0` disables the ping. */
  pingMs?: number;
  /** Backoff tuning (defaults to 1 s → 30 s, factor 2, +-20 % jitter). */
  backoff?: Partial<BackoffOptions>;
  /** Test seams. */
  baseUrl?: string;
  /** Bearer token for the `?token=` query param; read on EVERY (re)connect. Defaults to the signed-in session's. */
  getToken?: () => string | undefined;
  WebSocketImpl?: typeof WebSocket;
  random?: () => number;
};

export type ManagedSocket = {
  /** Send a text frame (objects are JSON-encoded). Returns false when the socket is not open. */
  send: (data: string | Record<string, unknown>) => boolean;
  /** Permanently close: cancels reconnects/pings and detaches handlers. Idempotent. */
  close: () => void;
  /** Reconnect immediately (e.g. on app foreground) unless a socket is already open/connecting. */
  reconnectNow: () => void;
  isOpen: () => boolean;
};

const READY_CONNECTING = 0;
const READY_OPEN = 1;

export function createSocket(options: CreateSocketOptions): ManagedSocket {
  const { path, onMessage, onOpen, onClose, pingMs = 30000, backoff, baseUrl, random } = options;
  const Impl: typeof WebSocket | undefined = options.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);
  const tokenOf = options.getToken ?? getAccessToken;

  let ws: WebSocket | null = null;
  let closedByUser = false;
  let attempt = 0;
  let everOpened = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const clearTimers = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
  };

  const detach = (socket: WebSocket) => {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
  };

  const scheduleReconnect = () => {
    if (closedByUser || reconnectTimer) return;
    const delay = computeBackoff(attempt, backoff, random);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (closedByUser || !Impl) return;
    if (ws && (ws.readyState === READY_OPEN || ws.readyState === READY_CONNECTING)) return;
    let socket: WebSocket;
    try {
      socket = new Impl(buildSocketUrl(path, baseUrl, tokenOf()));
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      if (ws !== socket) return;
      const reconnected = everOpened;
      everOpened = true;
      attempt = 0;
      if (pingTimer) clearInterval(pingTimer);
      if (pingMs > 0) {
        pingTimer = setInterval(() => {
          if (ws === socket && socket.readyState === READY_OPEN) {
            try {
              socket.send('ping');
            } catch {
              /* a failed ping surfaces as a close event */
            }
          }
        }, pingMs);
      }
      onOpen?.({ reconnected });
    };

    socket.onmessage = (event: MessageEvent) => {
      if (ws !== socket) return;
      const raw = (event as { data?: unknown }).data;
      if (typeof raw !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return; // `pong` / non-JSON frames
      }
      try {
        onMessage(parsed);
      } catch (e) {
        console.warn('[realtime] message handler failed', e);
      }
    };

    socket.onerror = () => {
      // Make sure an errored socket always ends in `onclose` so the reconnect path runs exactly once.
      try {
        socket.close();
      } catch {
        /* already closed */
      }
    };

    socket.onclose = (event: CloseEvent) => {
      if (ws !== socket) return;
      ws = null;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      const willReconnect = !closedByUser;
      onClose?.({ willReconnect, code: (event as { code?: number } | undefined)?.code });
      if (willReconnect) scheduleReconnect();
    };
  };

  connect();

  return {
    send(data) {
      if (!ws || ws.readyState !== READY_OPEN) return false;
      try {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    },
    close() {
      if (closedByUser) return;
      closedByUser = true;
      clearTimers();
      const socket = ws;
      ws = null;
      if (socket) {
        detach(socket);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    },
    reconnectNow() {
      if (closedByUser) return;
      if (ws && (ws.readyState === READY_OPEN || ws.readyState === READY_CONNECTING)) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      attempt = 0;
      connect();
    },
    isOpen: () => !!ws && ws.readyState === READY_OPEN,
  };
}

/**
 * Bounded "have I seen this id" set (insertion-ordered eviction). `seen(id)` returns `true` when the id
 * was already recorded, otherwise records it and returns `false` — i.e. use it as a guard:
 * `if (dedupe.seen(id)) return;`.
 */
export type Deduper = { seen: (id: string) => boolean; has: (id: string) => boolean; clear: () => void; size: () => number };

export function createDeduper(maxSize = 500): Deduper {
  const ids = new Set<string>();
  return {
    seen(id: string) {
      if (ids.has(id)) return true;
      ids.add(id);
      if (ids.size > maxSize) {
        const oldest = ids.values().next().value;
        if (oldest !== undefined) ids.delete(oldest);
      }
      return false;
    },
    has: (id: string) => ids.has(id),
    clear: () => ids.clear(),
    size: () => ids.size,
  };
}
