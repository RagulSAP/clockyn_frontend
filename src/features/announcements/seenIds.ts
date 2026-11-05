/**
 * Announcement "seen ids" + unread counters (staff / manager side).
 *
 * v1 problems fixed here:
 *  - the seen-id lists were device-global (shared by every account on the device) and never cleared on logout:
 *    the keys are now scoped per USER id (`storageKeyFor`) and wiped on sign-out (`SESSION_SCOPED_KEYS`);
 *  - marking a feed as read issued a SECOND request and OVERWROTE the stored ids (race: an announcement created in
 *    between was marked seen without being shown): ids are now taken from the list that was actually fetched and
 *    displayed, and MERGED into the stored set;
 *  - the badge was reset to 0 even when the request had failed: callers only mark after a successful load.
 *
 * Classification of an announcement into a feed (`broadcast` = target all|selected, `targeted` = branch|dept) comes
 * from `@/api/announcements` (`filterBroadcast` / `filterTargeted`) and is the single source of truth for unread
 * counts. Realtime events (WS and push) only bump `@/store/badges` optimistically; the next list refetch replaces
 * that estimate by the exact value computed here (see `useAnnouncementUnreadSync`).
 */
import { create } from 'zustand';

import { filterBroadcast, filterTargeted, unseenAnnouncementIds } from '@/api/announcements';
import { getJSON, setJSON, STORAGE_KEYS, storageKeyFor } from '@/lib/storage';
import { badges } from '@/store/badges';
import type { Announcement } from '@/types/api/announcements';

export type AnnouncementFeedKind = 'broadcast' | 'targeted';

/** The persisted id list is capped (newest kept) so it cannot grow without bound. */
export const MAX_SEEN_IDS = 500;

const BASE_KEY: Record<AnnouncementFeedKind, string> = {
  broadcast: STORAGE_KEYS.announcementSeenBroadcast,
  targeted: STORAGE_KEYS.announcementSeenTargeted,
};

/** Storage key of one user's seen ids for a feed. */
export function seenKey(feed: AnnouncementFeedKind, userId: string): string {
  return storageKeyFor(BASE_KEY[feed], userId);
}

/** Announcements belonging to a feed. */
export function feedItems(list: readonly Announcement[], feed: AnnouncementFeedKind): Announcement[] {
  return feed === 'broadcast' ? filterBroadcast(list) : filterTargeted(list);
}

/** Merge `add` into `existing` (order kept, duplicates and blanks dropped, newest `max` kept). */
export function mergeSeenIds(existing: readonly string[], add: readonly string[], max: number = MAX_SEEN_IDS): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...existing, ...add]) {
    const key = String(id ?? '').trim();
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.length > max ? out.slice(out.length - max) : out;
}

export interface UnreadCounts {
  broadcast: number;
  targeted: number;
  total: number;
}

export const ZERO_UNREAD: UnreadCounts = { broadcast: 0, targeted: 0, total: 0 };

/** Unseen broadcast / targeted announcements of `list` given the two seen-id lists. */
export function computeUnreadCounts(
  list: readonly Announcement[],
  seen: { broadcast: Iterable<string>; targeted: Iterable<string> },
): UnreadCounts {
  const broadcast = unseenAnnouncementIds(filterBroadcast(list), seen.broadcast).length;
  const targeted = unseenAnnouncementIds(filterTargeted(list), seen.targeted).length;
  return { broadcast, targeted, total: broadcast + targeted };
}

// ── storage ────────────────────────────────────────────────────────────────────────────────

/** Seen ids of a user for a feed (empty for an unknown user or unreadable / corrupt storage). */
export async function loadSeenIds(feed: AnnouncementFeedKind, userId: string): Promise<string[]> {
  if (!userId) return [];
  const raw = await getJSON<unknown>(seenKey(feed, userId), []);
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

/** Merge ids into a user's seen list and persist it. Returns the stored list. */
export async function addSeenIds(feed: AnnouncementFeedKind, userId: string, ids: readonly string[]): Promise<string[]> {
  if (!userId) return [];
  const merged = mergeSeenIds(await loadSeenIds(feed, userId), ids);
  await setJSON(seenKey(feed, userId), merged);
  return merged;
}

// ── unread counters (per feed) ─────────────────────────────────────────────────────────────

interface UnreadState {
  broadcast: number;
  targeted: number;
  set: (c: { broadcast: number; targeted: number }) => void;
  reset: () => void;
}

/** Per-feed unread counters that drive the hub cards (the Chat tab badge is the sum, in `@/store/badges`). */
export const useAnnouncementUnreadStore = create<UnreadState>()((set) => ({
  broadcast: 0,
  targeted: 0,
  set: ({ broadcast, targeted }) => set({ broadcast, targeted }),
  reset: () => set({ broadcast: 0, targeted: 0 }),
}));

/** Hook: `{ broadcast, targeted }` unread counts. */
export function useAnnouncementUnread(): { broadcast: number; targeted: number } {
  const broadcast = useAnnouncementUnreadStore((s) => s.broadcast);
  const targeted = useAnnouncementUnreadStore((s) => s.targeted);
  return { broadcast, targeted };
}

let refreshSeq = 0;

/**
 * Recompute the unread counters from a freshly fetched list and the user's seen ids, then publish them
 * (per-feed store + the Chat tab badge). A later call supersedes an earlier one that is still reading storage.
 */
export async function refreshUnread(userId: string, list: readonly Announcement[]): Promise<UnreadCounts> {
  if (!userId) return ZERO_UNREAD;
  const seq = ++refreshSeq;
  const [broadcast, targeted] = await Promise.all([loadSeenIds('broadcast', userId), loadSeenIds('targeted', userId)]);
  const counts = computeUnreadCounts(list, { broadcast, targeted });
  if (seq !== refreshSeq) return counts; // superseded
  useAnnouncementUnreadStore.getState().set(counts);
  badges.set('announcements', counts.total);
  return counts;
}

/** Sign-out / user switch: forget the counters (stored ids are wiped by the sign-out storage cleanup). */
export function resetUnread(): void {
  refreshSeq += 1;
  useAnnouncementUnreadStore.getState().reset();
  badges.set('announcements', 0);
}

/**
 * Mark every announcement of a feed as seen, using the list that is on screen (no second request), then update
 * the counters. Call only after a SUCCESSFUL load.
 */
export async function markFeedRead(feed: AnnouncementFeedKind, userId: string, list: readonly Announcement[]): Promise<UnreadCounts> {
  if (!userId) return ZERO_UNREAD;
  await addSeenIds(
    feed,
    userId,
    feedItems(list, feed).map((a) => a.id),
  );
  return refreshUnread(userId, list);
}

/** Opening "Broadcast" (all / selected staff announcements). */
export function markBroadcastRead(userId: string, list: readonly Announcement[]): Promise<UnreadCounts> {
  return markFeedRead('broadcast', userId, list);
}

/** Opening "Targeted" (branch / department announcements). */
export function markTargetedRead(userId: string, list: readonly Announcement[]): Promise<UnreadCounts> {
  return markFeedRead('targeted', userId, list);
}
