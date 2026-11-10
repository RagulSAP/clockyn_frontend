/**
 * Live Chat API: the org admin's conversation with Clockyn support (`/live-chat/*`, admin only).
 * One thread per organisation; the server derives the sender's name itself. Realtime frames
 * (`live_chat_message`, `live_chat_read`, `live_chat_message_deleted`) arrive on the per-user chat socket.
 */
import { api } from '@/lib/api/client';
import type {
  LiveChatHistory,
  LiveChatMessage,
  LiveChatSenderType,
  LiveChatSocketEvent,
  LiveChatStatus,
  SendLiveChatFileInput,
  SendLiveChatInput,
} from '@/types/api/liveChat';
import { bool, isRecord, listOf, num, optStr, rec, str } from './mappers/common';
import { ensureSuccess, mapMessageType, requireId, resolveMimeType, seg } from './sharedHelpers';

const senderType = (v: unknown): LiveChatSenderType => (str(v).trim().toLowerCase() === 'support' ? 'support' : 'org');
const threadStatus = (v: unknown): LiveChatStatus | null => {
  const s = str(v).trim().toLowerCase();
  return s === 'open' || s === 'closed' ? s : null;
};

/** Maps one wire message (REST or socket payload) to a `LiveChatMessage`. */
export function mapLiveChatMessage(input: unknown): LiveChatMessage {
  const r = rec(input);
  return {
    id: str(r.message_id),
    senderType: senderType(r.sender_type),
    senderId: str(r.sender_id),
    senderName: str(r.sender_name),
    text: str(r.message),
    type: mapMessageType(r.message_type),
    fileUrl: optStr(r.file_url) ?? null,
    fileName: optStr(r.file_name) ?? null,
    contentType: optStr(r.content_type) ?? null,
    sentAt: str(r.timestamp),
    isRead: bool(r.is_read),
    isDelivered: bool(r.is_delivered),
    raw: r,
  };
}

/** Maps the history response. */
export function mapLiveChatHistory(body: unknown): LiveChatHistory {
  const r = rec(body);
  return { status: threadStatus(r.status), unread: num(r.unread), messages: listOf(body, ['messages']).map(mapLiveChatMessage) };
}

/** Parses a frame of the per-user socket (raw JSON string or object); anything else is `unknown`. */
export function parseLiveChatSocketEvent(frame: unknown): LiveChatSocketEvent {
  let value: unknown = frame;
  if (typeof frame === 'string') {
    try {
      value = JSON.parse(frame);
    } catch {
      return { type: 'unknown' };
    }
  }
  if (!isRecord(value)) return { type: 'unknown' };
  const type = str(value.type);
  const data = rec(value.data);
  if (type === 'live_chat_message') return { type, orgId: str(data.org_id), message: mapLiveChatMessage(data) };
  if (type === 'live_chat_read') return { type, orgId: str(data.org_id), reader: senderType(data.reader) };
  if (type === 'live_chat_message_deleted') {
    return { type, orgId: str(data.org_id), messageId: str(data.message_id), lastMessage: str(data.last_message), lastMessageAt: str(data.last_message_at) };
  }
  return { type: 'unknown' };
}

/** `GET /live-chat/messages/{org}?user_id=`: the conversation (oldest first), its status and my unread count. */
export async function getMessages(orgId: string, userId: string): Promise<LiveChatHistory> {
  const body = await api.get<unknown>(`/live-chat/messages/${seg(requireId(orgId, 'orgId'))}`, { user_id: requireId(userId, 'userId') });
  return mapLiveChatHistory(body);
}

/** `POST /live-chat/send`: a text message (a closed thread is reopened by the server). */
export async function send(input: SendLiveChatInput): Promise<LiveChatMessage> {
  const body = await api.post<unknown>('/live-chat/send', { org_id: input.orgId, user_id: input.userId, message: input.message });
  ensureSuccess(body, 'Failed to send message');
  return mapLiveChatMessage(body);
}

/** `POST /live-chat/send-file` (multipart, with upload progress): an image or document. */
export async function sendFile(input: SendLiveChatFileInput): Promise<LiveChatMessage> {
  const body = await api.upload<unknown>(
    '/live-chat/send-file',
    {
      fileUri: input.fileUri,
      fieldName: 'file',
      fileName: input.fileName,
      mimeType: resolveMimeType(input.mimeType, input.fileName),
      fields: { org_id: input.orgId, user_id: input.userId },
    },
    { onProgress: input.onProgress },
  );
  ensureSuccess(body, 'Upload failed');
  return mapLiveChatMessage(body);
}

/** `PUT /live-chat/mark-read`: marks the support messages as read. */
export async function markRead(orgId: string, userId: string): Promise<void> {
  const body = await api.put<unknown>('/live-chat/mark-read', { org_id: orgId, user_id: userId });
  ensureSuccess(body, 'Failed to mark messages as read');
}

/** `GET /live-chat/unread/{org}?user_id=`: unread support messages (badge seed). */
export async function getUnread(orgId: string, userId: string): Promise<number> {
  const body = await api.get<unknown>(`/live-chat/unread/${seg(requireId(orgId, 'orgId'))}`, { user_id: requireId(userId, 'userId') });
  return num(rec(body).unread);
}
