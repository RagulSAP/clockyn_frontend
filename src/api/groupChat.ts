/**
 * Group chat API — `/group-chat/*` (list, create, messages, send, members, add-members, mark-read, send-file)
 * plus the group WebSocket URL builder (the socket itself lives in `@/lib/realtime`).
 *
 * Fixes applied vs v1 (see docs/FIX_POLICY.md B6): the list endpoint takes `org_id` (v1 sent
 * `organization_id`, which the backend rejects with 422) and errors are surfaced, never swallowed.
 * A plan block on the list endpoint arrives as HTTP 500 `detail: "403: ..."`; the client exposes it as `status 403`.
 */
import { wsBaseUrl } from '@/config/env';
import { api } from '@/lib/api/client';
import type {
  CreateGroupInput,
  GroupMember,
  GroupMessage,
  GroupSummary,
  SendGroupFileInput,
} from '@/types/api/groupChat';
import { bool, listOf, num, optStr, rec, str } from './mappers/common';
import { ensureSuccess, mapMessageType, requireId, resolveMimeType, seg } from './sharedHelpers';

/** Maps one wire group-list row to a `GroupSummary`. */
export function mapGroupSummary(input: unknown): GroupSummary {
  const r = rec(input);
  return {
    groupId: str(r.group_id),
    name: str(r.group_name),
    createdBy: str(r.created_by),
    memberCount: num(r.member_count),
    lastMessage: optStr(r.last_message) ?? null,
    lastMessageSender: optStr(r.last_message_sender) ?? null,
    lastMessageAt: optStr(r.last_message_time) ?? null,
    unreadCount: num(r.unread_count),
    raw: r,
  };
}

/** Maps one wire group message (REST or `new_group_message` socket payload) to a `GroupMessage`. */
export function mapGroupMessage(input: unknown): GroupMessage {
  const r = rec(input);
  return {
    id: str(r.message_id),
    groupId: str(r.group_id),
    senderId: str(r.sender_id),
    senderName: str(r.sender_name),
    text: str(r.message),
    type: mapMessageType(r.message_type),
    fileUrl: optStr(r.file_url) ?? null,
    sentAt: str(r.timestamp),
    isRead: bool(r.is_read),
    readCount: num(r.read_count),
    totalMembers: num(r.total_members),
    raw: r,
  };
}

/** Maps one wire member row to a `GroupMember`. */
export function mapGroupMember(input: unknown): GroupMember {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    roleName: str(r.role_name),
    deptName: str(r.dept_name),
    branchName: str(r.branch_name),
    isAdmin: bool(r.is_admin),
  };
}

/**
 * Member ids for `POST /group-chat/create`: the creator is always included (the backend does not add them)
 * and duplicates / blanks are removed, keeping the creator first.
 */
export function buildGroupMemberIds(createdBy: string, memberIds: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of [createdBy, ...memberIds]) {
    const v = id.trim();
    if (v !== '' && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Total unread across groups (chat badge). */
export function sumGroupUnread(groups: readonly GroupSummary[]): number {
  return groups.reduce((total, g) => total + g.unreadCount, 0);
}

/** `GET /group-chat/list/{userId}?org_id={orgId}` — groups the user belongs to, newest activity first. */
export async function listGroups(userId: string, orgId: string): Promise<GroupSummary[]> {
  const body = await api.get<unknown>(`/group-chat/list/${seg(requireId(userId, 'userId'))}`, { org_id: orgId });
  return listOf(body).map(mapGroupSummary);
}

/** `GET /group-chat/list/{userId}?org_id={orgId}` — total unread messages across the user's groups (badge). */
export async function getGroupUnreadTotal(userId: string, orgId: string): Promise<number> {
  return sumGroupUnread(await listGroups(userId, orgId));
}

/** `POST /group-chat/create` — creates a group; the creator is added to `member_ids` automatically. */
export async function createGroup(input: CreateGroupInput): Promise<GroupSummary> {
  const name = input.name.trim();
  if (name === '') throw new Error('Enter a group name');
  const memberIds = buildGroupMemberIds(input.createdBy, input.memberIds);
  if (memberIds.length < 2) throw new Error('Select at least 1 member');
  const body = await api.post<unknown>('/group-chat/create', {
    group_name: name,
    created_by: input.createdBy,
    member_ids: memberIds,
    org_id: input.orgId,
  });
  ensureSuccess(body, 'Failed to create group');
  return mapGroupSummary(body);
}

/** `GET /group-chat/messages/{groupId}?user_id={userId}` — messages oldest first, with read receipts. */
export async function getGroupMessages(groupId: string, userId: string): Promise<GroupMessage[]> {
  const body = await api.get<unknown>(`/group-chat/messages/${seg(requireId(groupId, 'groupId'))}`, { user_id: userId });
  return listOf(body).map(mapGroupMessage);
}

/** `POST /group-chat/send` — sends a text message to a group (members only). */
export async function sendGroupMessage(groupId: string, senderId: string, message: string): Promise<GroupMessage> {
  const body = await api.post<unknown>('/group-chat/send', { group_id: groupId, sender_id: senderId, message });
  ensureSuccess(body, 'Failed to send group message');
  return mapGroupMessage(body);
}

/** `GET /group-chat/members/{groupId}` — members of a group (`isAdmin` marks the creator). */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const body = await api.get<unknown>(`/group-chat/members/${seg(requireId(groupId, 'groupId'))}`);
  return listOf(body).map(mapGroupMember);
}

/** `POST /group-chat/add-members` — adds users to a group (existing members are skipped by the server). */
export async function addGroupMembers(groupId: string, memberIds: string[]): Promise<void> {
  const body = await api.post<unknown>('/group-chat/add-members', { group_id: groupId, member_ids: memberIds });
  ensureSuccess(body, 'Failed to add members');
}

/** `PUT /group-chat/mark-read` — marks the group's messages as read by `userId`. */
export async function markGroupRead(groupId: string, userId: string): Promise<void> {
  const body = await api.put<unknown>('/group-chat/mark-read', { group_id: groupId, user_id: userId });
  ensureSuccess(body, 'Failed to mark messages as read');
}

/** `POST /group-chat/send-file` (multipart, with upload progress) — sends an image/document to a group. */
export async function sendGroupFile(input: SendGroupFileInput): Promise<GroupMessage> {
  const body = await api.upload<unknown>(
    '/group-chat/send-file',
    {
      fileUri: input.fileUri,
      fieldName: 'file',
      fileName: input.fileName,
      mimeType: resolveMimeType(input.mimeType, input.fileName),
      fields: { sender_id: input.senderId, group_id: input.groupId },
    },
    { onProgress: input.onProgress },
  );
  ensureSuccess(body, 'Upload failed');
  return mapGroupMessage(body);
}

/** Path of the group socket, relative to the API host (it receives the same events as the personal socket). */
export function groupSocketPath(groupId: string, userId: string): string {
  return `/ws/group-chat/${seg(groupId)}/${seg(userId)}`;
}

/** Absolute `wss://` URL of the group socket (`/ws/group-chat/{groupId}/{userId}`). */
export function groupSocketUrl(groupId: string, userId: string, token?: string | null): string {
  const url = `${wsBaseUrl}${groupSocketPath(groupId, userId)}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}
