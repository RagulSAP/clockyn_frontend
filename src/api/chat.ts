/**
 * 1:1 chat API — `/chat/*` (list, search, messages, send, send-file, mark-read, delete) plus the
 * WebSocket URL builder / frame parser (the socket itself lives in `@/lib/realtime`).
 *
 * Notes
 *  - The legacy `/announcement/*` helpers that v1 exported from its chat module have no callers; the live
 *    announcement endpoints are in `announcements.ts`.
 *  - Plan block on the list endpoint arrives as HTTP 500 `detail: "403: ..."`, exposed by the client as status 403.
 */
import { wsBaseUrl } from '@/config/env';
import { api } from '@/lib/api/client';
import type {
  ChatContact,
  ChatMessage,
  ChatSearchResult,
  ChatSocketEvent,
  SendChatFileInput,
  SendChatMessageInput,
} from '@/types/api/chat';
import { mapGroupMessage } from './groupChat';
import { bool, isRecord, listOf, num, optStr, rec, str } from './mappers/common';
import { ensureSuccess, mapMessageType, requireId, resolveMimeType, seg } from './sharedHelpers';

/** Maps one wire chat-list row to a `ChatContact`. */
export function mapChatContact(input: unknown): ChatContact {
  const r = rec(input);
  const lastType = optStr(r.last_message_type);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    roleName: str(r.role_name),
    deptName: str(r.dept_name),
    branchName: str(r.branch_name),
    lastMessage: optStr(r.last_message) ?? null,
    lastMessageType: lastType ? mapMessageType(lastType) : null,
    lastMessageAt: optStr(r.last_message_time) ?? null,
    unreadCount: num(r.unread_count),
    isOnline: bool(r.is_online),
    photoUrl: optStr(r.profile_photo_url) ?? null,
    raw: r,
  };
}

/** Maps one wire staff-search row to a `ChatSearchResult`. */
export function mapChatSearchResult(input: unknown): ChatSearchResult {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    roleName: str(r.role_name),
    deptName: str(r.dept_name),
    branchName: str(r.branch_name),
    photoUrl: optStr(r.profile_photo_url) ?? null,
  };
}

/** Maps one wire message (REST or `new_message` socket payload) to a `ChatMessage`. */
export function mapChatMessage(input: unknown): ChatMessage {
  const r = rec(input);
  const senderName = optStr(r.sender_name);
  return {
    id: str(r.message_id),
    senderId: str(r.sender_id),
    receiverId: str(r.receiver_id),
    text: str(r.message),
    type: mapMessageType(r.message_type),
    fileUrl: optStr(r.file_url) ?? null,
    sentAt: str(r.timestamp),
    isRead: bool(r.is_read),
    isDelivered: bool(r.is_delivered),
    ...(senderName ? { senderName } : {}),
    raw: r,
  };
}

/** Total unread messages across the contacts (chat badge). */
export function sumChatUnread(contacts: readonly ChatContact[]): number {
  return contacts.reduce((total, c) => total + c.unreadCount, 0);
}

/**
 * Parses a frame received on the per-user chat socket (`/ws/chat/{userId}`) into a typed event.
 * Accepts the raw JSON string or an already parsed object; unparseable frames become `unknown`.
 */
export function parseChatSocketEvent(frame: unknown): ChatSocketEvent {
  let value: unknown = frame;
  if (typeof frame === 'string') {
    try {
      value = JSON.parse(frame);
    } catch {
      return { type: 'unknown', rawType: '', raw: frame };
    }
  }
  if (!isRecord(value)) return { type: 'unknown', rawType: '', raw: value };
  const rawType = str(value.type);
  const data = rec(value.data);
  switch (rawType) {
    case 'new_message':
    case 'new_chat_message':
      return { type: 'new_message', message: mapChatMessage(data) };
    case 'new_group_message':
      return { type: 'new_group_message', message: mapGroupMessage(data) };
    case 'read_update':
      return {
        type: 'read_update',
        readerId: str(data.reader_id),
        senderId: optStr(data.sender_id) ?? null,
        groupId: optStr(data.group_id) ?? null,
      };
    case 'group_created':
      return {
        type: 'group_created',
        groupId: str(data.group_id),
        name: str(data.group_name),
        createdBy: str(data.created_by),
        raw: data,
      };
    default:
      return { type: 'unknown', rawType, raw: value };
  }
}

/** `GET /chat/list/{userId}?org_id={orgId}` — org members with last message and unread counts. */
export async function getChatList(userId: string, orgId: string): Promise<ChatContact[]> {
  const body = await api.get<unknown>(`/chat/list/${seg(requireId(userId, 'userId'))}`, { org_id: orgId });
  return listOf(body).map(mapChatContact);
}

/** `GET /chat/list/{userId}?org_id={orgId}` — total unread 1:1 messages (chat badge). */
export async function getChatUnreadTotal(userId: string, orgId: string): Promise<number> {
  return sumChatUnread(await getChatList(userId, orgId));
}

/** `GET /chat/search/{userId}?q={query}` — searches org members by name to start a conversation. */
export async function searchChatStaff(userId: string, query: string): Promise<ChatSearchResult[]> {
  const body = await api.get<unknown>(`/chat/search/${seg(requireId(userId, 'userId'))}`, { q: query });
  return listOf(body).map(mapChatSearchResult);
}

/** `GET /chat/messages/{userId}/{otherUserId}` — the conversation, oldest first. */
export async function getChatMessages(userId: string, otherUserId: string): Promise<ChatMessage[]> {
  const body = await api.get<unknown>(`/chat/messages/${seg(requireId(userId, 'userId'))}/${seg(requireId(otherUserId, 'otherUserId'))}`);
  return listOf(body).map(mapChatMessage);
}

/** `POST /chat/send` — sends a text message (the backend resolves sender name and receiver push token itself). */
export async function sendChatMessage(input: SendChatMessageInput): Promise<ChatMessage> {
  const body = await api.post<unknown>('/chat/send', {
    sender_id: input.senderId,
    receiver_id: input.receiverId,
    message: input.message,
    ...(input.senderName ? { sender_name: input.senderName } : {}),
  });
  ensureSuccess(body, 'Failed to send message');
  return mapChatMessage(body);
}

/** `POST /chat/send-file` (multipart, with upload progress) — sends an image/document. */
export async function sendChatFile(input: SendChatFileInput): Promise<ChatMessage> {
  const body = await api.upload<unknown>(
    '/chat/send-file',
    {
      fileUri: input.fileUri,
      fieldName: 'file',
      fileName: input.fileName,
      mimeType: resolveMimeType(input.mimeType, input.fileName),
      fields: {
        sender_id: input.senderId,
        receiver_id: input.receiverId,
        ...(input.senderName ? { sender_name: input.senderName } : {}),
      },
    },
    { onProgress: input.onProgress },
  );
  ensureSuccess(body, 'Upload failed');
  return mapChatMessage(body);
}

/**
 * `PUT /chat/mark-read` — marks messages sent by `senderId` to `receiverId` as seen. The viewer is `receiverId`:
 * when I open a conversation with X, call `markChatRead(X, me)`.
 */
export async function markChatRead(senderId: string, receiverId: string): Promise<void> {
  const body = await api.put<unknown>('/chat/mark-read', { sender_id: senderId, receiver_id: receiverId });
  ensureSuccess(body, 'Failed to mark messages as read');
}

/** `DELETE /chat/delete/{userId}/{otherUserId}` — deletes the conversation for the caller. */
export async function deleteConversation(userId: string, otherUserId: string): Promise<void> {
  const body = await api.delete<unknown>(`/chat/delete/${seg(requireId(userId, 'userId'))}/${seg(requireId(otherUserId, 'otherUserId'))}`);
  ensureSuccess(body, 'Failed to delete conversation');
}

/** Path of the per-user chat socket, relative to the API host. */
export function chatSocketPath(userId: string): string {
  return `/ws/chat/${seg(userId)}`;
}

/** Absolute `wss://` URL of the per-user chat socket (`/ws/chat/{userId}`), which also carries group events. */
export function chatSocketUrl(userId: string, token?: string | null): string {
  const url = `${wsBaseUrl}${chatSocketPath(userId)}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}
