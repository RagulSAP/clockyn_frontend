/**
 * Pure notification helpers shared by native + web (unit-tested): payload normalisation, tap routing and
 * the foreground "re-display as local notification" rule.
 */
import { ROLE, routes } from '@/config/routes';

export type PushData = Record<string, string>;

export type PushMessage = {
  title?: string;
  body?: string;
  /** All values are strings (FCM data payloads are string-only; other primitives are stringified). */
  data: PushData;
  messageId?: string;
  /** `remote` = delivered by FCM, `local` = scheduled by this app (e.g. a foreground chat re-display). */
  source: 'remote' | 'local';
};

export type PushHandlers = {
  /** A push arrived while the app is in the foreground (the OS shows nothing by itself). */
  onForeground: (msg: PushMessage) => void;
  /** The user tapped a notification (remote OR local), including the one that cold-started the app. */
  onOpen: (msg: PushMessage) => void;
  /** The FCM token rotated — re-POST it to the backend. */
  onTokenRefresh?: (token: string) => void;
};

export type LocalNotificationInput = { title: string; body: string; data?: Record<string, unknown> };

export type NotificationTarget = { route: string; params: Record<string, string> };

/** Converts an arbitrary payload into `Record<string,string>` (drops null/undefined/objects). */
export function normalizePushData(raw: unknown): PushData {
  const out: PushData = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') out[k] = String(v);
  }
  return out;
}

const first = (data: PushData, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = data[k];
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
};

/**
 * Tap routing table (v1 table, re-expressed with the new route registry; unknown types → `null`).
 *
 *  punch_in / punch_out                          → admin home
 *  ticket_resolved / new_poll / poll_approved /
 *  announcement                                   → staff home (admin home for role 1)
 *  new_chat_message / new_message                 → direct chat (admin | staff by role), `userId` when the payload has a sender id
 *  new_group_message                              → group chat (admin | staff by role), `groupId` when present
 *  request_submitted                              → admin requests hub
 *  request_updated                                → staff requests hub
 *
 * Role: `opts.roleId` (the signed-in session) wins; otherwise the payload's `role_id`; role 1 = admin screens,
 * anything else = staff screens (same default as v1).
 */
export function parseNotificationTarget(
  data: Record<string, unknown> | null | undefined,
  opts?: { roleId?: number | null },
): NotificationTarget | null {
  const d = normalizePushData(data);
  const type = d.type;
  if (!type) return null;
  const role = opts?.roleId ?? (d.role_id !== undefined ? Number(d.role_id) : undefined);
  const isAdmin = role === ROLE.admin;

  switch (type) {
    case 'punch_in':
    case 'punch_out':
      return { route: routes.admin.home, params: {} };
    case 'ticket_resolved':
    case 'new_poll':
    case 'poll_approved':
    case 'announcement':
      return { route: isAdmin ? routes.admin.home : routes.staff.home, params: {} };
    case 'new_chat_message':
    case 'new_message': {
      const userId = first(d, 'sender_id', 'from_user_id', 'sender_user_id');
      return {
        route: isAdmin ? routes.admin.comms.direct : routes.staff.comms.direct,
        params: userId ? { userId } : {},
      };
    }
    case 'new_group_message': {
      const groupId = first(d, 'group_id');
      return {
        route: isAdmin ? routes.admin.comms.groups : routes.staff.comms.groups,
        params: groupId ? { groupId } : {},
      };
    }
    case 'request_submitted':
      return { route: routes.admin.requests.hub, params: {} };
    case 'request_updated':
      return { route: routes.staff.requests.hub, params: {} };
    default:
      return null; // force_logout and unknown types: nothing to open
  }
}

/**
 * Which foreground pushes are re-displayed as a local notification (FCM shows nothing while foregrounded):
 * chat and group messages only, with the v1 default titles.
 */
export function foregroundLocalNotification(msg: Pick<PushMessage, 'title' | 'body' | 'data'>): LocalNotificationInput | null {
  switch (msg.data.type) {
    case 'new_message':
    case 'new_chat_message':
      return { title: msg.title || 'New Message', body: msg.body ?? '', data: msg.data };
    case 'new_group_message':
      return { title: msg.title || 'New Group Message', body: msg.body ?? '', data: msg.data };
    default:
      return null;
  }
}

/** Key used to de-duplicate "open" events delivered through more than one channel. */
export function openEventKey(msg: PushMessage): string {
  return msg.messageId ? `id:${msg.messageId}` : `t:${msg.data.type ?? ''}|${msg.title ?? ''}|${msg.body ?? ''}`;
}
