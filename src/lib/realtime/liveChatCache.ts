/**
 * Cache side of "a Live Chat message was deleted" (`live_chat_message_deleted`, sent when support's admin console deletes
 * a message): the message leaves the cached history and the unread count is reloaded (the Support badge is re-seeded from
 * it). Idempotent and a no-op on the history when the message is not cached, so the global socket and the open conversation may both call it.
 */
import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/queryKeys';
import type { LiveChatHistory } from '@/types/api/liveChat';

export function removeLiveChatMessageFromCache(queryClient: QueryClient, userId: string, orgId: string, messageId: string): void {
  if (!messageId) return;
  const key = queryKeys.liveChat.messages(userId, orgId);
  const cached = queryClient.getQueryData<LiveChatHistory>(key);
  if (cached?.messages.some((m) => m.id === messageId)) {
    // keep `dataUpdatedAt`: the open conversation compares it with the time of my last send to decide "reopened"
    const updatedAt = queryClient.getQueryState(key)?.dataUpdatedAt;
    queryClient.setQueryData<LiveChatHistory>(key, { ...cached, messages: cached.messages.filter((m) => m.id !== messageId) }, updatedAt ? { updatedAt } : undefined);
  }
  // the deleted message may have been an unread one: reload the count (re-seeds the Support badge)
  void queryClient.invalidateQueries({ queryKey: queryKeys.liveChat.unread(userId, orgId) });
}
