/**
 * Badge counters (bottom bar / sidebar / home). In-memory only: counts are re-derived from the server on start
 * (chat/group lists, announcements, leads) and bumped live by the global socket / push events.
 *
 *  - Tab display rules live in the shell: Chat tab = `chat + announcements`, CRM tab = `crm`.
 *  - `chat` is always `chatGroup + chatIndividual`; use the section-aware actions when you know the section.
 *  - Message ids are de-duplicated across every source (global socket, chat-screen socket, push) with a bounded set.
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export type BadgeKey = 'chat' | 'announcements' | 'crm' | 'requests';
export type ChatSection = 'group' | 'individual';

export interface BadgeCounts {
  chat: number;
  announcements: number;
  crm: number;
  requests: number;
}

interface BadgeState extends BadgeCounts {
  chatGroup: number;
  chatIndividual: number;

  /** Add `n` (default 1) to a counter. For `chat` it counts as an individual-section unread. */
  increment: (key: BadgeKey, n?: number) => void;
  /** Absolute value. For `chat` the individual section is set so that the total equals `n`. */
  set: (key: BadgeKey, n: number) => void;
  /** Subtract `n`, or zero the counter when `n` is omitted. Never below 0. For `chat` pass a section via `markChatRead`. */
  markRead: (key: BadgeKey, n?: number) => void;

  /** Absolute unread of one chat section (sync from a loaded list). */
  setChatSection: (section: ChatSection, n: number) => void;
  /** +1 for a chat message unless its id was already counted (returns whether it counted). Own messages: do not call. */
  incrementChatForMessage: (section: ChatSection, messageId: string | number | null | undefined) => boolean;
  /** Subtract `n` (or zero when omitted) from one chat section. */
  markChatRead: (section: ChatSection, n?: number) => void;

  /** Zero everything and forget seen message ids (sign-out). */
  reset: () => void;
}

const clamp = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

const ZERO: BadgeCounts & { chatGroup: number; chatIndividual: number } = {
  chat: 0,
  announcements: 0,
  crm: 0,
  requests: 0,
  chatGroup: 0,
  chatIndividual: 0,
};

// ── message-id de-duplication ──────────────────────────────────────────────────────────────

const MAX_SEEN_IDS = 1000;
const seenMessageIds = new Set<string>();

/**
 * Remember a message id. Returns `true` when it is new (and should be counted), `false` when it was already seen
 * or has no usable id. The set is bounded (oldest ids are evicted first).
 */
export function registerMessageId(id: string | number | null | undefined): boolean {
  if (id === null || id === undefined) return false;
  const key = String(id).trim();
  if (key === '' || key === 'undefined' || key === 'null') return false;
  if (seenMessageIds.has(key)) return false;
  seenMessageIds.add(key);
  if (seenMessageIds.size > MAX_SEEN_IDS) {
    const oldest = seenMessageIds.values().next().value;
    if (oldest !== undefined) seenMessageIds.delete(oldest);
  }
  return true;
}

export function hasSeenMessageId(id: string | number | null | undefined): boolean {
  return id !== null && id !== undefined && seenMessageIds.has(String(id).trim());
}

export function clearSeenMessageIds(): void {
  seenMessageIds.clear();
}

// ── store ────────────────────────────────────────────────────────────────────────────────────

export const useBadgeStore = create<BadgeState>()((set, get) => ({
  ...ZERO,

  increment: (key, n = 1) => {
    const add = clamp(n);
    if (add === 0) return;
    if (key === 'chat') {
      const chatIndividual = get().chatIndividual + add;
      set({ chatIndividual, chat: get().chatGroup + chatIndividual });
    } else {
      set({ [key]: get()[key] + add } as Pick<BadgeState, BadgeKey>);
    }
  },

  set: (key, n) => {
    const value = clamp(n);
    if (key === 'chat') {
      const chatIndividual = Math.max(0, value - get().chatGroup);
      set({ chatIndividual, chat: get().chatGroup + chatIndividual });
    } else {
      set({ [key]: value } as Pick<BadgeState, BadgeKey>);
    }
  },

  markRead: (key, n) => {
    if (key === 'chat') {
      // Subtract from individual first, then group.
      const s = get();
      let remaining = n === undefined ? Number.POSITIVE_INFINITY : clamp(n);
      const fromIndividual = Math.min(s.chatIndividual, remaining);
      remaining -= fromIndividual;
      const fromGroup = Math.min(s.chatGroup, remaining);
      const chatIndividual = s.chatIndividual - fromIndividual;
      const chatGroup = s.chatGroup - fromGroup;
      set({ chatIndividual, chatGroup, chat: chatIndividual + chatGroup });
      return;
    }
    set({ [key]: n === undefined ? 0 : Math.max(0, get()[key] - clamp(n)) } as Pick<BadgeState, BadgeKey>);
  },

  setChatSection: (section, n) => {
    const value = clamp(n);
    const s = get();
    const chatGroup = section === 'group' ? value : s.chatGroup;
    const chatIndividual = section === 'individual' ? value : s.chatIndividual;
    set({ chatGroup, chatIndividual, chat: chatGroup + chatIndividual });
  },

  incrementChatForMessage: (section, messageId) => {
    if (!registerMessageId(messageId)) return false;
    const s = get();
    const chatGroup = section === 'group' ? s.chatGroup + 1 : s.chatGroup;
    const chatIndividual = section === 'individual' ? s.chatIndividual + 1 : s.chatIndividual;
    set({ chatGroup, chatIndividual, chat: chatGroup + chatIndividual });
    return true;
  },

  markChatRead: (section, n) => {
    const s = get();
    const current = section === 'group' ? s.chatGroup : s.chatIndividual;
    const next = n === undefined ? 0 : Math.max(0, current - clamp(n));
    const chatGroup = section === 'group' ? next : s.chatGroup;
    const chatIndividual = section === 'individual' ? next : s.chatIndividual;
    set({ chatGroup, chatIndividual, chat: chatGroup + chatIndividual });
  },

  reset: () => {
    clearSeenMessageIds();
    set({ ...ZERO });
  },
}));

// ── hooks / non-React access ─────────────────────────────────────────────────────────────────

/** `{ chat, announcements, crm, requests }` (re-renders only when a count changes). */
export function useBadges(): BadgeCounts {
  return useBadgeStore(
    useShallow((s) => ({ chat: s.chat, announcements: s.announcements, crm: s.crm, requests: s.requests })),
  );
}

/** Chat tab number: unread chat + unread announcements. */
export function useChatTabBadge(): number {
  return useBadgeStore((s) => s.chat + s.announcements);
}

/** Stable action bag (does not subscribe to counts). */
export function useBadgeActions(): Pick<
  BadgeState,
  'increment' | 'set' | 'markRead' | 'setChatSection' | 'incrementChatForMessage' | 'markChatRead' | 'reset'
> {
  return useBadgeStore(
    useShallow((s) => ({
      increment: s.increment,
      set: s.set,
      markRead: s.markRead,
      setChatSection: s.setChatSection,
      incrementChatForMessage: s.incrementChatForMessage,
      markChatRead: s.markChatRead,
      reset: s.reset,
    })),
  );
}

/** Non-React access (socket handlers, push handlers). */
export const badges = {
  get: (): BadgeCounts => {
    const s = useBadgeStore.getState();
    return { chat: s.chat, announcements: s.announcements, crm: s.crm, requests: s.requests };
  },
  increment: (key: BadgeKey, n?: number): void => useBadgeStore.getState().increment(key, n),
  set: (key: BadgeKey, n: number): void => useBadgeStore.getState().set(key, n),
  markRead: (key: BadgeKey, n?: number): void => useBadgeStore.getState().markRead(key, n),
  setChatSection: (section: ChatSection, n: number): void => useBadgeStore.getState().setChatSection(section, n),
  incrementChatForMessage: (section: ChatSection, messageId: string | number | null | undefined): boolean =>
    useBadgeStore.getState().incrementChatForMessage(section, messageId),
  markChatRead: (section: ChatSection, n?: number): void => useBadgeStore.getState().markChatRead(section, n),
  reset: (): void => useBadgeStore.getState().reset(),
};

/** Reset all badge counters and de-dup memory (called by sign-out). */
export function resetBadges(): void {
  useBadgeStore.getState().reset();
}
