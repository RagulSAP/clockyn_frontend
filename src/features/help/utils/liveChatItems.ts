import type { ChatItem } from '@/features/chat/types';
import { timestampMs } from '@/features/chat/utils/format';
import type { LiveChatMessage } from '@/types/api/liveChat';

/** Shown above a support message that carries no agent name. */
export const SUPPORT_FALLBACK_NAME = 'Clockyn Support';

/**
 * A live-chat message shaped for the shared chat list. Everything the org's admins write is "mine" (the thread is
 * shared by the organisation's admins); everything support writes is not, and shows the agent's name above the bubble.
 */
export function chatItemFromLive(m: LiveChatMessage): ChatItem {
  const fromMe = m.senderType === 'org';
  return {
    key: m.id,
    id: m.id,
    senderId: m.senderId,
    senderName: fromMe ? '' : m.senderName.trim() || SUPPORT_FALLBACK_NAME,
    fromMe,
    text: m.text,
    type: m.type,
    fileUrl: m.fileUrl,
    sentAt: m.sentAt,
    ts: timestampMs(m.sentAt),
    isRead: m.isRead,
    isDelivered: m.isDelivered,
    readCount: 0,
    totalMembers: 0,
    state: 'sent',
  };
}
