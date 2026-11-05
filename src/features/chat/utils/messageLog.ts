/**
 * The message log of ONE open conversation: mapping from the API DTOs, ordering, de-duplication, the optimistic
 * send state machine and the read-receipt updates. Pure and framework free (unit-tested).
 *
 * Rules
 *  - Server messages are unique by id; confirmed messages are ordered by server time, messages still pending on
 *    this device (`sending` / `failed`) always sit after them in creation order (no client-clock mis-ordering).
 *  - An optimistic message goes `sending -> sent` (REST response OR the socket echo, whichever is first, never both)
 *    or `sending -> failed -> sending` (retry). The `key` of an optimistic message survives confirmation.
 *  - Only messages that belong to the open conversation may be appended; read updates only touch the right messages.
 */
import type { ChatMessage } from '@/types/api/chat';
import type { GroupMessage } from '@/types/api/groupChat';
import type { ChatItem, RetryPayload } from '../types';
import { timestampMs } from './format';

// ── mapping ─────────────────────────────────────────────────────────────────────────────────

/** Every other member has seen a group message I sent (`totalMembers` already excludes the sender). */
export function groupAllRead(readCount: number, totalMembers: number): boolean {
  return totalMembers > 0 && readCount >= totalMembers;
}

export function chatItemFromDirect(m: ChatMessage, me: string): ChatItem {
  return {
    key: m.id,
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName ?? '',
    fromMe: m.senderId === me,
    text: m.text,
    type: m.type,
    fileUrl: m.fileUrl,
    sentAt: m.sentAt,
    ts: timestampMs(m.sentAt),
    isRead: m.isRead,
    isDelivered: m.isDelivered,
    readCount: 0,
    totalMembers: 0,
    state: 'sent',
  };
}

export function chatItemFromGroup(m: GroupMessage, me: string): ChatItem {
  const fromMe = m.senderId === me;
  return {
    key: m.id,
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    fromMe,
    text: m.text,
    type: m.type,
    fileUrl: m.fileUrl,
    sentAt: m.sentAt,
    ts: timestampMs(m.sentAt),
    // For my own messages the server always says `is_read: true`; the receipts decide.
    isRead: fromMe ? groupAllRead(m.readCount, m.totalMembers) : true,
    isDelivered: true,
    readCount: m.readCount,
    totalMembers: m.totalMembers,
    state: 'sent',
  };
}

let clientCounter = 0;
/** Unique client id for an optimistic message. */
export function newClientId(now: number = Date.now()): string {
  clientCounter += 1;
  return `c${now}_${clientCounter}`;
}

export interface OptimisticInput {
  clientId: string;
  senderId: string;
  senderName?: string;
  text: string;
  type: ChatItem['type'];
  localUri?: string | null;
  retry: RetryPayload;
  now?: number;
}

/** A message created on this device, shown immediately with a pending marker. */
export function createOptimisticItem(input: OptimisticInput): ChatItem {
  const now = input.now ?? Date.now();
  return {
    key: input.clientId,
    id: input.clientId,
    clientId: input.clientId,
    senderId: input.senderId,
    senderName: input.senderName ?? '',
    fromMe: true,
    text: input.text,
    type: input.type,
    fileUrl: null,
    localUri: input.localUri ?? null,
    sentAt: new Date(now).toISOString(),
    ts: now,
    isRead: false,
    isDelivered: false,
    readCount: 0,
    totalMembers: 0,
    state: 'sending',
    progress: input.type === 'text' ? undefined : 0,
    retry: input.retry,
  };
}

// ── ordering / de-duplication ───────────────────────────────────────────────────────────────

/** Confirmed messages by server time, then pending ones by creation time. */
export function compareItems(a: ChatItem, b: ChatItem): number {
  const ap = a.state !== 'sent';
  const bp = b.state !== 'sent';
  if (ap !== bp) return ap ? 1 : -1;
  return a.ts - b.ts;
}

/** Drops items without an id, de-duplicates by id (last wins, first position kept) and sorts. */
export function normalizeItems(items: readonly ChatItem[]): ChatItem[] {
  const byId = new Map<string, ChatItem>();
  for (const item of items) {
    if (!item.id) continue;
    byId.set(item.id, item);
  }
  return [...byId.values()].sort(compareItems);
}

// ── the reducer ─────────────────────────────────────────────────────────────────────────────

export type LogAction =
  | { type: 'reset' }
  /** A fresh server history (also after a reconnect): replaces confirmed messages, keeps pending ones. */
  | { type: 'history'; items: ChatItem[] }
  | { type: 'optimistic'; item: ChatItem }
  | { type: 'progress'; clientId: string; progress: number }
  /** REST response of a send. */
  | { type: 'confirmed'; clientId: string; item: ChatItem }
  | { type: 'failed'; clientId: string }
  | { type: 'retrying'; clientId: string }
  | { type: 'discard'; clientId: string }
  /** A message that arrived on the socket and was verified to belong to this conversation. */
  | { type: 'incoming'; item: ChatItem }
  /** Direct chat: the peer read my messages. */
  | { type: 'own_read' }
  | { type: 'delivered'; messageId: string }
  /** Group chat: read receipt counts. `fallbackTotal` is used when neither the payload nor the message knows it. */
  | { type: 'group_read'; messageId?: string; readCount?: number; totalMembers?: number; fallbackTotal: number };

/** A confirmed message newer than the fetched history is kept for this long (see `history`). */
const RECENT_KEEP_MS = 2 * 60_000;

const indexById =(items: readonly ChatItem[], id: string): number => items.findIndex((i) => i.id === id);

function lastIndexWhere<T>(items: readonly T[], pred: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i -= 1) if (pred(items[i])) return i;
  return -1;
}

/** Server data wins; the identity that must not change on screen (key, local thumbnail, client id) is kept. */
function adopt(local: ChatItem, server: ChatItem): ChatItem {
  return {
    ...server,
    key: local.key,
    clientId: local.clientId,
    localUri: local.localUri ?? null,
    state: 'sent',
    progress: undefined,
    retry: undefined,
    isRead: server.isRead || local.isRead,
    readCount: Math.max(server.readCount, local.readCount),
  };
}

export function messageLogReducer(items: ChatItem[], action: LogAction): ChatItem[] {
  switch (action.type) {
    case 'reset':
      return [];

    case 'history': {
      const server = normalizeItems(action.items);
      const known = new Map(items.map((i) => [i.id, i]));
      const merged = server.map((s) => {
        const local = known.get(s.id);
        return local ? adopt(local, s) : s;
      });
      const serverIds = new Set(server.map((s) => s.id));
      const newestServer = server.reduce((max, s) => Math.max(max, s.ts), 0);
      const now = Date.now();
      // keep what is still in flight / failed on this device, plus messages that landed after the history
      // request was made (a refetch that started before a send must not make that message vanish)
      const keep = items.filter(
        (i) => !serverIds.has(i.id) && (i.state !== 'sent' || (i.ts > newestServer && now - i.ts < RECENT_KEEP_MS)),
      );
      return [...merged, ...keep].sort(compareItems);
    }

    case 'optimistic':
      return normalizeItems([...items, action.item]);

    case 'progress':
      return items.map((i) => (i.clientId === action.clientId && i.state === 'sending' ? { ...i, progress: action.progress } : i));

    case 'confirmed': {
      const tempIdx = items.findIndex((i) => i.clientId === action.clientId);
      if (tempIdx < 0) return normalizeItems([...items.filter((i) => i.id !== action.item.id), action.item]);
      const duplicateIdx = items.findIndex((i, idx) => idx !== tempIdx && i.id === action.item.id);
      if (duplicateIdx >= 0) return items.filter((_, idx) => idx !== tempIdx); // the socket delivered it first
      const next = items.slice();
      next[tempIdx] = adopt(items[tempIdx], action.item);
      return normalizeItems(next);
    }

    case 'failed':
      return items.map((i) => (i.clientId === action.clientId && i.state === 'sending' ? { ...i, state: 'failed', progress: undefined } : i));

    case 'retrying':
      return items.map((i) =>
        i.clientId === action.clientId && i.state === 'failed' ? { ...i, state: 'sending', progress: i.type === 'text' ? undefined : 0 } : i,
      );

    case 'discard':
      return items.filter((i) => !(i.clientId === action.clientId && i.state === 'failed'));

    case 'incoming': {
      const incoming = action.item;
      if (!incoming.id || items.some((i) => i.id === incoming.id)) return items;
      if (incoming.fromMe) {
        // Echo of a message sent from this device: settle the matching optimistic bubble instead of adding a twin.
        const idx = lastIndexWhere(items, (i) => i.state === 'sending' && i.fromMe && i.type === incoming.type && i.text === incoming.text);
        if (idx >= 0) {
          const next = items.slice();
          next[idx] = adopt(items[idx], incoming);
          return normalizeItems(next);
        }
      }
      return normalizeItems([...items, incoming]);
    }

    case 'own_read':
      return items.map((i) => (i.fromMe && i.state === 'sent' && !i.isRead ? { ...i, isRead: true, isDelivered: true } : i));

    case 'delivered': {
      const idx = indexById(items, action.messageId);
      if (idx < 0 || items[idx].isDelivered) return items;
      return items.map((i, n) => (n === idx ? { ...i, isDelivered: true } : i));
    }

    case 'group_read':
      return items.map((i) => {
        if (!i.fromMe || i.state !== 'sent') return i;
        if (action.messageId && i.id !== action.messageId) return i;
        const readCount = action.readCount ?? i.readCount;
        const totalMembers = action.totalMembers ?? (i.totalMembers || action.fallbackTotal);
        return { ...i, readCount, totalMembers, isRead: groupAllRead(readCount, totalMembers) || i.isRead };
      });

    default:
      return items;
  }
}

// ── "does this belong to the open conversation" guards ──────────────────────────────────────

interface DirectEnds {
  senderId: string;
  receiverId: string;
}

/** The other participant of a 1:1 message from my point of view ('' when unknown). */
export function peerOfMessage(m: DirectEnds, me: string): string {
  return m.senderId === me ? m.receiverId : m.senderId;
}

/**
 * True when a 1:1 message is part of the conversation between me and `peerId`. A missing `receiverId` (some frames
 * omit it) is read as "the other side" so incoming messages from the peer are still accepted.
 */
export function directBelongs(m: DirectEnds, me: string, peerId: string): boolean {
  if (!peerId) return false;
  if (m.senderId === peerId) return m.receiverId === '' || m.receiverId === me;
  if (m.senderId === me) return m.receiverId === '' || m.receiverId === peerId;
  return false;
}

export function groupBelongs(m: { groupId: string }, groupId: string): boolean {
  return !!groupId && m.groupId === groupId;
}
