/** DTOs for 1:1 chat (`src/api/chat.ts`). All fields are camelCase; timestamps are ISO-8601 UTC strings. */
import type { RawRecord } from './common';
import type { GroupMessage } from './groupChat';

/** Kind of a chat message (the server re-derives file/image from the extension). */
export type ChatMessageType = 'text' | 'image' | 'file';

/** One org member in the chat list (admin + active staff, excluding the caller). */
export interface ChatContact {
  userId: string;
  name: string;
  roleName: string;
  deptName: string;
  branchName: string;
  /** Preview of the latest message (file name for attachments); `null` when nothing was sent yet. */
  lastMessage: string | null;
  lastMessageType: ChatMessageType | null;
  /** ISO timestamp of the latest message. */
  lastMessageAt: string | null;
  unreadCount: number;
  /** Always `false` on the current backend; do not build presence UI on it. */
  isOnline: boolean;
  photoUrl: string | null;
  raw: RawRecord;
}

/** Row of the staff search used to start a new conversation. */
export interface ChatSearchResult {
  userId: string;
  name: string;
  roleName: string;
  deptName: string;
  branchName: string;
  photoUrl: string | null;
}

/** A single 1:1 message. */
export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  /** Text body; for attachments this is the original file name. */
  text: string;
  type: ChatMessageType;
  /** Presigned download URL for image/file messages. */
  fileUrl: string | null;
  /** ISO-8601 UTC timestamp. */
  sentAt: string;
  /** For messages I sent: has the receiver seen it. For received messages: always true. */
  isRead: boolean;
  isDelivered: boolean;
  senderName?: string;
  raw: RawRecord;
}

/** Input of `sendChatMessage`. */
export interface SendChatMessageInput {
  senderId: string;
  receiverId: string;
  message: string;
  /** Optional; the backend resolves the sender name itself but v1 sent it. */
  senderName?: string;
}

/** Input of `sendChatFile`. */
export interface SendChatFileInput {
  senderId: string;
  receiverId: string;
  fileUri: string;
  fileName: string;
  /** Falls back to a guess from the extension when missing / `application/octet-stream`. */
  mimeType?: string | null;
  senderName?: string;
  /** Upload progress, 0-100. */
  onProgress?: (percent: number) => void;
}

/** Typed view of the frames the per-user chat socket delivers. */
export type ChatSocketEvent =
  | { type: 'new_message'; message: ChatMessage }
  | { type: 'new_group_message'; message: GroupMessage }
  | { type: 'read_update'; readerId: string; senderId: string | null; groupId: string | null }
  | { type: 'group_created'; groupId: string; name: string; createdBy: string; raw: RawRecord }
  | { type: 'unknown'; rawType: string; raw: unknown };
