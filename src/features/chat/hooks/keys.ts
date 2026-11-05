import { queryKeys } from '@/lib/query/queryKeys';

/** Cache slot that remembers who a conversation opened from the staff search is with (scoped to the signed-in user). */
export const peerKey = (userId: string, peerId: string) => [...queryKeys.chat.all(userId), 'peer', peerId] as const;
