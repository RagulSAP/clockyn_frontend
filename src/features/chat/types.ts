import type { ChatMessageType } from '@/types/api/chat';

/** Which role area renders the chat: admin (full) or staff/manager (simplified). */
export type ChatVariant = 'admin' | 'staff';

export type ConversationKind = 'direct' | 'group';

/** Life cycle of a message created on this device. Messages that come from the server are always `sent`. */
export type SendState = 'sent' | 'sending' | 'failed';

/** What to resend when a failed message is retried. */
export type RetryPayload = { kind: 'text' } | { kind: 'file'; uri: string; fileName: string; mimeType: string };

/** One message of an open conversation (1:1 or group), already shaped for rendering. */
export interface ChatItem {
  /** Stable React key: the optimistic client id when the message was created here (so confirming it does not remount). */
  key: string;
  /** Server message id, or the client id while the message is pending. */
  id: string;
  /** Present for messages created on this device. */
  clientId?: string;
  senderId: string;
  /** Group: the sender's display name. Direct: empty. */
  senderName: string;
  fromMe: boolean;
  /** Text body; for attachments the file name. */
  text: string;
  type: ChatMessageType;
  /** Remote (presigned) URL of an attachment. */
  fileUrl: string | null;
  /** Local `file://` / blob URI of an attachment created here; kept so the thumbnail never changes after the upload. */
  localUri?: string | null;
  /** ISO timestamp. */
  sentAt: string;
  /** Epoch ms of `sentAt` (or of creation for pending messages). */
  ts: number;
  /** Own message: the receiver (direct) / every member (group) has seen it. */
  isRead: boolean;
  isDelivered: boolean;
  /** Group only: how many other members have seen my message. */
  readCount: number;
  /** Group only: number of other members (the sender is excluded). */
  totalMembers: number;
  state: SendState;
  /** Upload progress 0-100 while `state === 'sending'` for attachments. */
  progress?: number;
  retry?: RetryPayload;
}
