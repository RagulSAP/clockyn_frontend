/**
 * Pure logic of the chat hubs (admin "Team Communication" and staff "Choose a channel"): menu definitions, badge
 * mapping and the chat plan-gate decision. No React, no I/O (unit tested).
 */
import type { IconName, Tone } from '@/components/ui';
import { PLAN_PANEL_MESSAGES } from '@/config/plans';
import { routes, type AppRoute } from '@/config/routes';

export type HubAudience = 'admin' | 'staff';
export type HubBadgeKey = 'individual' | 'group' | 'broadcast' | 'targeted';

export interface HubItem {
  key: string;
  icon: IconName;
  tone: Tone;
  title: string;
  description: string;
  route: AppRoute;
  /** Which unread counter the card shows (none = no badge). */
  badge?: HubBadgeKey;
}

/** Admin hub: Individual, Group, Announcement, Branch & Dept (v1 order and copy). */
export const ADMIN_HUB_ITEMS: readonly HubItem[] = [
  { key: 'individual', icon: 'chat', tone: 'primary', title: 'Individual Chat', description: 'Direct message with staff', route: routes.admin.comms.direct, badge: 'individual' },
  { key: 'group', icon: 'users', tone: 'primary', title: 'Group Chat', description: 'Team conversations', route: routes.admin.comms.groups, badge: 'group' },
  { key: 'announce', icon: 'megaphone', tone: 'primary', title: 'Announcement', description: 'Broadcast to all staff', route: routes.admin.comms.announcements },
  { key: 'targeted', icon: 'building', tone: 'primary', title: 'Branch & Dept', description: 'Targeted announcements', route: routes.admin.comms.announcementsTargeted },
];

/** Staff / manager hub: Individual, Group, Broadcast, Targeted (v1 order and copy). */
export const STAFF_HUB_ITEMS: readonly HubItem[] = [
  { key: 'individual', icon: 'chat', tone: 'primary', title: 'Individual Chat', description: 'One-to-one conversation', route: routes.staff.comms.direct, badge: 'individual' },
  { key: 'group', icon: 'users', tone: 'primary', title: 'Group Chat', description: 'Team communication', route: routes.staff.comms.groups, badge: 'group' },
  { key: 'broadcast', icon: 'megaphone', tone: 'primary', title: 'Broadcast', description: 'Announcements from admin', route: routes.staff.comms.broadcast, badge: 'broadcast' },
  { key: 'targeted', icon: 'layers', tone: 'primary', title: 'Targeted Announcement', description: 'Branch / Department', route: routes.staff.comms.targeted, badge: 'targeted' },
];

export type HubCounts = Record<HubBadgeKey, number>;

/** Unread number of a card (0 when the card has no badge or the count is invalid). */
export function badgeFor(item: Pick<HubItem, 'badge'>, counts: Partial<HubCounts>): number {
  if (!item.badge) return 0;
  const n = counts[item.badge];
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export type ChatGate =
  | { kind: 'checking' }
  | { kind: 'open' }
  | { kind: 'blocked'; title: string; message: string; cta: { label: string; route: AppRoute } | null };

/** Admin block message when the plan source gave no text (expired / no plan). */
export const ADMIN_BLOCKED_FALLBACK = 'Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.';

/**
 * Chat plan-gate decision.
 *  - still loading the plan status -> `checking` (a skeleton; v1 flashed the menu first and let a blocked org tap a card);
 *  - status unknown after a failure -> `open` (fail-open, like v1: `blocked` is false);
 *  - blocked -> admin: "Feature Unavailable" + message + "Renew Plan" (iOS: "View Plan Status") to the billing screen;
 *               staff / manager: "Chat Unavailable" + "contact your admin" text and NO action.
 */
export function decideChatGate(input: { isLoading: boolean; blocked: boolean; audience: HubAudience; message: string; platformOS: string }): ChatGate {
  if (input.isLoading) return { kind: 'checking' };
  if (!input.blocked) return { kind: 'open' };
  if (input.audience === 'admin') {
    return {
      kind: 'blocked',
      title: 'Feature Unavailable',
      message: input.message || ADMIN_BLOCKED_FALLBACK,
      cta: { label: input.platformOS === 'ios' ? 'View Plan Status' : 'Renew Plan', route: routes.admin.billing.overview },
    };
  }
  return { kind: 'blocked', title: 'Chat Unavailable', message: input.message || PLAN_PANEL_MESSAGES.staff, cta: null };
}
