/** DTOs for group chat (`src/api/groupChat.ts`). */
import type { RawRecord } from './common';
import type { ChatMessageType } from './chat';

/** One row of the group list for the caller. */
export interface GroupSummary {
  groupId: string;
  name: string;
  /** user_id of the creator. */
  createdBy: string;
  memberCount: number;
  lastMessage: string | null;
  /** Display name of the last sender. */
  lastMessageSender: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  raw: RawRecord;
}

/** One group message (text or attachment). */
export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  /** Text body; for attachments this is the file name. */
  text: string;
  type: ChatMessageType;
  fileUrl: string | null;
  /** ISO-8601 UTC timestamp. */
  sentAt: string;
  /** True for my own messages, otherwise whether I have seen it. */
  isRead: boolean;
  /** How many other members have seen my message (0 for others' messages). */
  readCount: number;
  /** Active member count minus one (the sender). */
  totalMembers: number;
  raw: RawRecord;
}

/** A member of a group; `isAdmin` marks the creator. */
export interface GroupMember {
  userId: string;
  name: string;
  empId: string;
  roleName: string;
  deptName: string;
  branchName: string;
  isAdmin: boolean;
}

/** Input of `createGroup`. The creator is always added to the member list by the API layer. */
export interface CreateGroupInput {
  name: string;
  createdBy: string;
  memberIds: string[];
  orgId: string;
}

/** Input of `sendGroupFile`. */
export interface SendGroupFileInput {
  senderId: string;
  groupId: string;
  fileUri: string;
  fileName: string;
  mimeType?: string | null;
  /** Upload progress, 0-100. */
  onProgress?: (percent: number) => void;
}
