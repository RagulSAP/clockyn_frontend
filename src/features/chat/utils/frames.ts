/**
 * Interpretation of the realtime frames chat screens care about. The per-user socket and the group socket deliver
 * the same event stream, so every consumer must still check which conversation a frame belongs to
 * (see `directBelongs` / `groupBelongs` in `messageLog`, `readAppliesToGroup` below).
 */
import { mapGroupMessage } from '@/api/groupChat';
import { parseChatSocketEvent } from '@/api/chat';
import type { ChatMessage } from '@/types/api/chat';
import type { GroupMessage } from '@/types/api/groupChat';

export interface ReadFrame {
  readerId: string | null;
  /** 1:1: the user whose messages were read. */
  senderId: string | null;
  /** Group: the group that was read. */
  groupId: string | null;
  messageId: string | null;
  readCount: number | null;
  totalMembers: number | null;
}

export type ChatFrame =
  | { kind: 'direct_message'; message: ChatMessage }
  | { kind: 'group_message'; message: GroupMessage }
  | { kind: 'read'; read: ReadFrame }
  | { kind: 'delivered'; messageId: string }
  | { kind: 'group_created' }
  | { kind: 'other' };

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function decode(frame: unknown): Record<string, unknown> | null {
  if (typeof frame === 'string') {
    try {
      const parsed: unknown = JSON.parse(frame);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isRecord(frame) ? frame : null;
}

const optStr = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v));
const optNum = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function interpretChatFrame(frame: unknown): ChatFrame {
  const raw = decode(frame);
  if (!raw) return { kind: 'other' };
  const type = typeof raw.type === 'string' ? raw.type : '';
  const data = isRecord(raw.data) ? raw.data : {};

  switch (type) {
    case 'new_message':
    case 'new_chat_message': {
      // A group message may also arrive under the 1:1 event name: it carries a group id.
      if (optStr(data.group_id)) return { kind: 'group_message', message: mapGroupMessage(data) };
      const ev = parseChatSocketEvent(frame);
      return ev.type === 'new_message' ? { kind: 'direct_message', message: ev.message } : { kind: 'other' };
    }
    case 'new_group_message':
      return { kind: 'group_message', message: mapGroupMessage(data) };
    case 'read_update':
      return {
        kind: 'read',
        read: {
          readerId: optStr(data.reader_id),
          senderId: optStr(data.sender_id),
          groupId: optStr(data.group_id),
          messageId: optStr(data.message_id),
          readCount: optNum(data.read_count),
          totalMembers: optNum(data.total_members),
        },
      };
    case 'delivered': {
      const id = optStr(data.message_id);
      return id ? { kind: 'delivered', messageId: id } : { kind: 'other' };
    }
    case 'group_created':
      return { kind: 'group_created' };
    default:
      return { kind: 'other' };
  }
}

/** A read receipt of the open 1:1 conversation: `peerId` read what I sent (never a group receipt). */
export function readAppliesToDirect(read: ReadFrame, me: string, peerId: string): boolean {
  if (!peerId || read.groupId || read.readerId !== peerId) return false;
  return read.senderId === null || read.senderId === me;
}

/**
 * A read receipt of the open group. A frame that names another group is ignored; a frame without a group id is
 * accepted only when it is not shaped like a 1:1 receipt (`sender_id` present) and the reader is someone else.
 */
export function readAppliesToGroup(read: ReadFrame, me: string, groupId: string): boolean {
  if (!groupId) return false;
  if (read.readerId === me) return false;
  if (read.groupId) return read.groupId === groupId;
  return read.senderId === null && (read.messageId !== null || read.readCount !== null);
}
