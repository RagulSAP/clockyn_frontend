/**
 * Interpretation of the realtime frames delivered on the per-user socket (`/ws/chat/{userId}`) and of the
 * equivalent push data messages. Pure functions + a tiny pub/sub so features can react to non-badge events
 * (punch notifications, new requests) without opening their own socket.
 *
 * Event table (see the realtime spec):
 *   new_message | new_chat_message  -> chat unread +1 (dedupe by message id, ignore own messages)
 *   new_group_message               -> group unread +1 (same rules)
 *   announcement                    -> announcements unread +1 (broadcast | targeted)
 *   request_submitted               -> requests badge +1 (admin)
 *   badge_update                    -> punch notification
 *   read_update / group_created / … -> no badge effect (chat screens consume them via useChatSocket)
 */
import type { Deduper } from './socketCore';

export type ChatSection = 'group' | 'individual';
export type AnnouncementKind = 'broadcast' | 'targeted';

export type PunchNotification = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  type: string;
  receivedAt: string;
};

export type GlobalAction =
  | { kind: 'chat_message'; section: ChatSection; messageId: string }
  | { kind: 'announcement'; announcement: AnnouncementKind }
  | { kind: 'request_submitted' }
  | { kind: 'punch_notification'; notification: PunchNotification | null };

/** What the realtime layer needs from the badge store (wired in `useGlobalSocket`). */
export type BadgeSink = {
  addChatMessage: (section: ChatSection, messageId: string) => void;
  addAnnouncement: (kind: AnnouncementKind) => void;
  addRequest: () => void;
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asString = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** `all | selected | broadcast` are organisation-wide; everything else (branch, dept) is targeted. */
export function classifyAnnouncementTarget(target: unknown): AnnouncementKind {
  const t = asString(target).toLowerCase();
  return t === 'all' || t === 'selected' || t === 'broadcast' ? 'broadcast' : 'targeted';
}

/**
 * Map a socket frame to an action, or `null` when the frame has no global effect.
 * `selfId` is the logged-in user: chat messages sent by the user are ignored.
 */
export function interpretSocketFrame(frame: unknown, selfId: string, now: () => Date = () => new Date()): GlobalAction | null {
  const msg = asRecord(frame);
  if (!msg) return null;
  const type = asString(msg.type);

  switch (type) {
    case 'badge_update': {
      const n = asRecord(msg.notification);
      if (!n) return { kind: 'punch_notification', notification: null };
      return {
        kind: 'punch_notification',
        notification: {
          id: asString(n.id) || String(now().getTime()),
          title: asString(n.title),
          body: asString(n.body),
          imageUrl: n.image_url ? asString(n.image_url) : null,
          type: asString(n.type) || 'punch_in',
          receivedAt: now().toISOString(),
        },
      };
    }
    case 'announcement':
      return { kind: 'announcement', announcement: classifyAnnouncementTarget(msg.target ?? asRecord(msg.data)?.target) };
    case 'request_submitted':
      return { kind: 'request_submitted' };
    case 'new_message':
    case 'new_chat_message':
    case 'new_group_message': {
      const data = asRecord(msg.data) ?? msg;
      const senderId = asString(data.sender_id);
      const messageId = asString(data.message_id ?? data.messageId);
      if (!senderId || senderId === selfId || !messageId) return null;
      // A group message always carries `group_id`; `new_group_message` is group even if the field is odd.
      const section: ChatSection = type === 'new_group_message' || data.group_id ? 'group' : 'individual';
      return { kind: 'chat_message', section, messageId };
    }
    default:
      return null;
  }
}

/**
 * Map a push data payload (foreground FCM message) to an action. Chat pushes are only counted when the
 * socket is not delivering them (`socketOpen` false) or the push carries a message id that can be
 * de-duplicated against the socket frame.
 */
export function interpretPushData(
  data: Record<string, unknown> | undefined,
  opts: { selfId: string; socketOpen: boolean; now?: () => number; notification?: { title?: string; body?: string } },
): GlobalAction | null {
  if (!data) return null;
  const type = asString(data.type);
  const now = opts.now ?? Date.now;
  switch (type) {
    case 'punch_in':
    case 'punch_out': {
      const n = opts.notification;
      if (!n) return { kind: 'punch_notification', notification: null };
      return {
        kind: 'punch_notification',
        notification: {
          id: String(now()),
          title: n.title ?? '',
          body: n.body ?? '',
          imageUrl: data.image_url ? asString(data.image_url) : null,
          type,
          receivedAt: new Date(now()).toISOString(),
        },
      };
    }
    case 'announcement':
      return { kind: 'announcement', announcement: classifyAnnouncementTarget(data.target) };
    case 'request_submitted':
      return { kind: 'request_submitted' };
    case 'new_message':
    case 'new_chat_message':
    case 'new_group_message': {
      const section: ChatSection = type === 'new_group_message' ? 'group' : 'individual';
      const realId = asString(data.message_id ?? data.messageId);
      const sender = asString(data.sender_id);
      if (sender && sender === opts.selfId) return null;
      if (realId) return { kind: 'chat_message', section, messageId: realId };
      // No id to de-duplicate against: the socket is authoritative while it is open.
      return opts.socketOpen ? null : { kind: 'chat_message', section, messageId: `push_${now()}` };
    }
    default:
      return null;
  }
}

/** Dedupe key for punch pushes: the same user + type within `PUNCH_DEDUPE_MS` is one notification (v1: 10 s). */
export const PUNCH_DEDUPE_MS = 10_000;
export const punchDedupeKey = (data: Record<string, unknown> | undefined): string => `${asString(data?.user_id)}|${asString(data?.type)}`;

/**
 * Apply an action: dedupe chat messages by id (shared across the global socket and FCM), notify the badge
 * sink, and publish on the bus. Returns true when something was applied.
 */
export function applyGlobalAction(action: GlobalAction, sink: BadgeSink, deduper: Deduper): boolean {
  switch (action.kind) {
    case 'chat_message':
      if (deduper.seen(`${action.section}:${action.messageId}`)) return false;
      sink.addChatMessage(action.section, action.messageId);
      realtimeBus.emit({ type: 'chat_message', section: action.section, messageId: action.messageId });
      return true;
    case 'announcement':
      sink.addAnnouncement(action.announcement);
      realtimeBus.emit({ type: 'announcement', announcement: action.announcement });
      return true;
    case 'request_submitted':
      sink.addRequest();
      realtimeBus.emit({ type: 'request_submitted' });
      return true;
    case 'punch_notification':
      realtimeBus.emit({ type: 'punch_notification', notification: action.notification });
      return true;
  }
}

export type RealtimeEvent =
  | { type: 'chat_message'; section: ChatSection; messageId: string }
  | { type: 'announcement'; announcement: AnnouncementKind }
  | { type: 'request_submitted' }
  | { type: 'punch_notification'; notification: PunchNotification | null }
  /** The global socket reconnected after a drop: anything missed while offline should be refetched. */
  | { type: 'socket_reconnected' };

type Listener = (event: RealtimeEvent) => void;

function createBus() {
  const listeners = new Set<Listener>();
  return {
    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    emit(event: RealtimeEvent) {
      [...listeners].forEach((fn) => {
        try {
          fn(event);
        } catch (e) {
          console.warn('[realtime] bus listener failed', e);
        }
      });
    },
    clear() {
      listeners.clear();
    },
  };
}

/** Process-wide pub/sub for non-badge consumers (e.g. admin home reacting to `request_submitted`). */
export const realtimeBus = createBus();
