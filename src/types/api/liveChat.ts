/** DTOs of Live Chat (org admin <-> Clockyn support), `src/api/liveChat.ts`. camelCase; timestamps ISO-8601 UTC. */
import type { RawRecord } from './common';
import type { ChatMessageType } from './chat';

/** `org` = the app's admin (mine), `support` = a Clockyn operator. */
export type LiveChatSenderType = 'org' | 'support';
export type LiveChatStatus = 'open' | 'closed';

/** One message of the conversation. */
export interface LiveChatMessage {
  id: string;
  senderType: LiveChatSenderType;
  senderId: string;
  /** Support: the agent's name. Org: the admin's name. */
  senderName: string;
  /** Text body; for attachments the file's display name. */
  text: string;
  type: ChatMessageType;
  /** Presigned download URL of an image / file. */
  fileUrl: string | null;
  fileName: string | null;
  contentType: string | null;
  sentAt: string;
  /** For messages I sent: has support read it. */
  isRead: boolean;
  isDelivered: boolean;
  raw: RawRecord;
}

/** `GET /live-chat/messages/{org}`. */
export interface LiveChatHistory {
  /** `null` while the thread does not exist yet (nothing was ever sent). */
  status: LiveChatStatus | null;
  unread: number;
  messages: LiveChatMessage[];
}

export interface SendLiveChatInput {
  orgId: string;
  userId: string;
  message: string;
}

export interface SendLiveChatFileInput {
  orgId: string;
  userId: string;
  fileUri: string;
  fileName: string;
  mimeType?: string | null;
  /** Upload progress, 0-100. */
  onProgress?: (percent: number) => void;
}

/** Typed view of the live-chat frames on the per-user socket. */
export type LiveChatSocketEvent =
  | { type: 'live_chat_message'; orgId: string; message: LiveChatMessage }
  | { type: 'live_chat_read'; orgId: string; reader: LiveChatSenderType }
  /** A message was deleted from the admin console; `lastMessage*` describe the thread's new last message ('' when none). */
  | { type: 'live_chat_message_deleted'; orgId: string; messageId: string; lastMessage: string; lastMessageAt: string }
  | { type: 'unknown' };
