/**
 * Process-wide glue between realtime sources (the global socket, foreground pushes) and the badge store.
 * One shared de-duper + the store's own message-id memory guarantee a chat message counts exactly once, no
 * matter whether the global socket, a chat screen's socket or a push delivers it.
 */
import { parseLiveChatSocketEvent } from '@/api/liveChat';
import { queryClient } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { getSession } from '@/store/auth';
import { badges } from '@/store/badges';
import {
  applyGlobalAction,
  interpretPushData,
  interpretSocketFrame,
  PUNCH_DEDUPE_MS,
  punchDedupeKey,
  type AnnouncementKind,
  type BadgeSink,
  type ChatSection,
  type GlobalAction,
} from './events';
import { liveChatSession } from './liveChatSession';
import { removeLiveChatMessageFromCache } from './liveChatCache';
import { createDeduper } from './socketCore';

export const globalMessageDeduper = createDeduper(1000);

let globalSocketOpen = false;
/** Set by `useGlobalSocket`; lets push handlers defer to the socket for chat counts while it is connected. */
export function setGlobalSocketOpen(open: boolean): void {
  globalSocketOpen = open;
}
export function isGlobalSocketOpen(): boolean {
  return globalSocketOpen;
}

/** Badge store wiring. Admin has no announcement badge; only admins/managers see the requests badge. */
export const badgeSink: BadgeSink = {
  addChatMessage: (section: ChatSection, messageId: string) => {
    badges.incrementChatForMessage(section, messageId);
  },
  addLiveChatMessage: (messageId: string) => {
    const session = getSession();
    if (!session || session.roleId !== 1) return; // Live Chat belongs to the admin
    if (liveChatSession.isOpen()) return; // the open conversation reads it itself
    badges.incrementLiveChatForMessage(messageId);
  },
  addAnnouncement: (_kind: AnnouncementKind) => {
    const session = getSession();
    if (!session || session.roleId === 1) return;
    badges.increment('announcements');
    // Heal optimistic drift: refetch the announcement list so any mounted consumer recomputes the real unseen count.
    void queryClient.invalidateQueries({ queryKey: queryKeys.announcements.mine(session.userId) });
  },
  addRequest: () => {
    const session = getSession();
    if (!session || (session.roleId !== 1 && session.roleId !== 2)) return;
    badges.increment('requests');
  },
};

/** Handle one frame of the per-user socket. */
export function handleSocketFrame(frame: unknown): boolean {
  const session = getSession();
  if (!session) return false;
  // a message deleted from the admin console leaves the cached Live Chat history even while the screen is not mounted
  const live = parseLiveChatSocketEvent(frame);
  if (live.type === 'live_chat_message_deleted') {
    if (!live.orgId || live.orgId === session.orgId) removeLiveChatMessageFromCache(queryClient, session.userId, session.orgId, live.messageId);
    return true;
  }
  const action = interpretSocketFrame(frame, session.userId);
  return action ? applyGlobalAction(action, badgeSink, globalMessageDeduper) : false;
}

const recentPunches = new Map<string, number>();
/** True when the same user+type punch push was already handled within the de-dupe window. */
export function isDuplicatePunchPush(data: Record<string, unknown> | undefined, now: number = Date.now()): boolean {
  for (const [k, at] of recentPunches) if (now - at > PUNCH_DEDUPE_MS) recentPunches.delete(k);
  const key = punchDedupeKey(data);
  if (recentPunches.has(key)) return true;
  recentPunches.set(key, now);
  return false;
}

/** Handle the data of a foreground push (badge effects only; navigation / force logout live in the bootstrap). */
export function handlePushData(data: Record<string, unknown> | undefined, notification?: { title?: string; body?: string }): boolean {
  const session = getSession();
  if (!session) return false;
  const action: GlobalAction | null = interpretPushData(data, { selfId: session.userId, socketOpen: globalSocketOpen, notification });
  if (action?.kind === 'punch_notification' && isDuplicatePunchPush(data)) return false;
  return action ? applyGlobalAction(action, badgeSink, globalMessageDeduper) : false;
}

/** Sign-out: forget de-dup memory. (Counts themselves are reset by the store's own teardown.) */
export function resetGlobalRealtime(): void {
  globalMessageDeduper.clear();
  recentPunches.clear();
  globalSocketOpen = false;
}
