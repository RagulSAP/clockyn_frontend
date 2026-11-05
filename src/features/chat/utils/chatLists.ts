/**
 * Conversation-list bookkeeping (pure): unread counters, previews after sends / incoming messages, role filtering,
 * admin-first ordering and search. The lists live in the react-query cache; these functions are the updaters.
 */
import type { StaffMember } from '@/types/api/staff';
import type { ChatContact, ChatMessage, ChatSearchResult } from '@/types/api/chat';
import type { GroupMessage, GroupSummary } from '@/types/api/groupChat';
import { matchesQuery } from './format';
import { peerOfMessage } from './messageLog';

export const ADMIN_ROLE_NAME = 'admin';

export const isAdminRoleName = (roleName: string | null | undefined): boolean => (roleName ?? '').trim().toLowerCase() === ADMIN_ROLE_NAME;

/** Total unread across rows (the chat badge section value). */
export function totalUnread(rows: readonly { unreadCount: number }[]): number {
  return rows.reduce((sum, r) => sum + (r.unreadCount > 0 ? r.unreadCount : 0), 0);
}

// ── direct ──────────────────────────────────────────────────────────────────────────────────

export interface ListUpdate<T> {
  list: T[];
  /** The row is unknown (new partner / group): refetch the list to get its name and details. */
  needsRefetch: boolean;
}

function toFront<T>(list: readonly T[], index: number, row: T): T[] {
  return [row, ...list.filter((_, i) => i !== index)];
}

/**
 * Apply a socket message to the chat list. Incoming messages from a partner whose conversation is NOT open add one
 * unread; the conversation that is open is never counted (the open conversation marks it read itself).
 */
export function applyIncomingToChatList(
  list: readonly ChatContact[],
  msg: ChatMessage,
  me: string,
  openPeerId: string | null = null,
): ListUpdate<ChatContact> {
  const partner = peerOfMessage(msg, me);
  if (!partner) return { list: [...list], needsRefetch: false };
  const index = list.findIndex((c) => c.userId === partner);
  if (index < 0) return { list: [...list], needsRefetch: true };
  const incoming = msg.senderId !== me;
  const current = list[index];
  const unreadCount = incoming && partner !== openPeerId ? current.unreadCount + 1 : current.unreadCount;
  const row: ChatContact = {
    ...current,
    lastMessage: msg.text,
    lastMessageType: msg.type,
    lastMessageAt: msg.sentAt,
    unreadCount: partner === openPeerId ? 0 : unreadCount,
  };
  return { list: toFront(list, index, row), needsRefetch: false };
}

/** Zero one conversation's unread counter (when it is opened). */
export function zeroChatUnread(list: readonly ChatContact[], peerId: string): ChatContact[] {
  return list.map((c) => (c.userId === peerId && c.unreadCount !== 0 ? { ...c, unreadCount: 0 } : c));
}

/** Contact row for someone who has no conversation yet (opened from the staff search). */
export function chatContactFromSearch(r: ChatSearchResult): ChatContact {
  return {
    userId: r.userId,
    name: r.name,
    roleName: r.roleName,
    deptName: r.deptName,
    branchName: r.branchName,
    lastMessage: null,
    lastMessageType: null,
    lastMessageAt: null,
    unreadCount: 0,
    isOnline: false,
    photoUrl: r.photoUrl,
    raw: {},
  };
}

export function roleLabelOf(staff: Pick<StaffMember, 'roleId' | 'roleName'>): string {
  if (staff.roleId === 1) return 'Admin';
  if (staff.roleId === 2) return 'Manager';
  if (staff.roleId === 3) return 'Staff';
  return staff.roleName ?? 'Staff';
}

export function chatSearchResultFromStaff(s: StaffMember): ChatSearchResult {
  return {
    userId: s.userId,
    name: s.name,
    roleName: roleLabelOf(s),
    deptName: s.department,
    branchName: s.branch,
    photoUrl: s.photoUrl ?? null,
  };
}

/** After sending: refresh the row's preview (and insert the row when this is the first message). */
export function applySentToChatList(
  list: readonly ChatContact[],
  peer: ChatContact,
  preview: { text: string; type: ChatMessage['type']; at: string },
): ChatContact[] {
  const index = list.findIndex((c) => c.userId === peer.userId);
  const base = index >= 0 ? list[index] : peer;
  const row: ChatContact = { ...base, lastMessage: preview.text, lastMessageType: preview.type, lastMessageAt: preview.at, unreadCount: 0 };
  return index >= 0 ? toFront(list, index, row) : [row, ...list];
}

/** The org admin as a pinned contact (shown first even without any message). */
export function chatContactFromAdmin(admin: StaffMember): ChatContact {
  return {
    userId: admin.userId,
    name: admin.name || 'Admin',
    roleName: 'Admin',
    deptName: '',
    branchName: '',
    lastMessage: null,
    lastMessageType: null,
    lastMessageAt: null,
    unreadCount: 0,
    isOnline: false,
    photoUrl: admin.photoUrl ?? null,
    raw: {},
  };
}

/** Staff / manager list: the admin conversation is always first (synthesised when it has no messages yet). */
export function mergeAdminFirst(list: readonly ChatContact[], admin: ChatContact | null): ChatContact[] {
  if (!admin) return [...list];
  const index = list.findIndex((c) => c.userId === admin.userId);
  if (index >= 0) return toFront(list, index, list[index]);
  return [admin, ...list];
}

export interface ContactFilter {
  query?: string;
  /** Managers / staff using the admin screens only see admin conversations. */
  adminOnly?: boolean;
  /** Also match the branch (the admin list does, the staff list matches name / role / department only). */
  matchBranch?: boolean;
}

export function filterChatContacts(list: readonly ChatContact[], { query = '', adminOnly = false, matchBranch = true }: ContactFilter = {}): ChatContact[] {
  return list.filter((c) => {
    if (adminOnly && !isAdminRoleName(c.roleName)) return false;
    return matchesQuery(query, c.name, c.roleName, c.deptName, matchBranch ? c.branchName : '');
  });
}

export function filterSearchResults(list: readonly ChatSearchResult[], adminOnly: boolean): ChatSearchResult[] {
  return adminOnly ? list.filter((r) => isAdminRoleName(r.roleName)) : [...list];
}

/** Local staff search (staff screens, and the admin screen when the backend search fails). */
export function searchStaffLocally(staff: readonly StaffMember[], query: string, opts: { selfId: string; adminOnly?: boolean }): ChatSearchResult[] {
  if (query.trim() === '') return [];
  return staff
    .filter((s) => s.userId !== opts.selfId && s.isActive)
    .filter((s) => matchesQuery(query, s.name, s.branch, s.department, roleLabelOf(s)))
    .map(chatSearchResultFromStaff)
    .filter((r) => !opts.adminOnly || isAdminRoleName(r.roleName));
}

// ── groups ──────────────────────────────────────────────────────────────────────────────────

/** Apply a group message to the group list (unread +1 unless that group is open or the message is mine). */
export function applyIncomingToGroupList(
  list: readonly GroupSummary[],
  msg: GroupMessage,
  me: string,
  openGroupId: string | null = null,
): ListUpdate<GroupSummary> {
  const index = list.findIndex((g) => g.groupId === msg.groupId);
  if (index < 0) return { list: [...list], needsRefetch: true };
  const current = list[index];
  const counts = msg.senderId !== me && msg.groupId !== openGroupId;
  const row: GroupSummary = {
    ...current,
    lastMessage: msg.text,
    lastMessageSender: msg.senderId === me ? 'You' : msg.senderName,
    lastMessageAt: msg.sentAt,
    unreadCount: msg.groupId === openGroupId ? 0 : current.unreadCount + (counts ? 1 : 0),
  };
  return { list: toFront(list, index, row), needsRefetch: false };
}

export function zeroGroupUnread(list: readonly GroupSummary[], groupId: string): GroupSummary[] {
  return list.map((g) => (g.groupId === groupId && g.unreadCount !== 0 ? { ...g, unreadCount: 0 } : g));
}

/** After sending in a group. */
export function applySentToGroupList(list: readonly GroupSummary[], groupId: string, text: string, at: string): GroupSummary[] {
  const index = list.findIndex((g) => g.groupId === groupId);
  if (index < 0) return [...list];
  return toFront(list, index, { ...list[index], lastMessage: text, lastMessageSender: 'You', lastMessageAt: at, unreadCount: 0 });
}

export function setGroupMemberCount(list: readonly GroupSummary[], groupId: string, count: number): GroupSummary[] {
  return list.map((g) => (g.groupId === groupId ? { ...g, memberCount: count } : g));
}

export function filterGroups(list: readonly GroupSummary[], query: string): GroupSummary[] {
  return list.filter((g) => matchesQuery(query, g.name));
}

/** Staff that can be added to / picked for a group: not me, not already a member, active, matching the query. */
export function groupCandidates(
  staff: readonly StaffMember[],
  opts: { selfId: string; excludeIds?: readonly string[]; query?: string },
): StaffMember[] {
  const exclude = new Set(opts.excludeIds ?? []);
  return staff.filter(
    (s) => s.userId !== opts.selfId && s.isActive && !exclude.has(s.userId) && matchesQuery(opts.query ?? '', s.name, s.department, s.branch),
  );
}
