import { QueryClient } from '@tanstack/react-query';

import { queryClient as appQueryClient } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { useAuthStore } from '@/store/auth';
import type { LiveChatHistory, LiveChatMessage } from '@/types/api/liveChat';

import { handleSocketFrame } from '../globalRealtime';
import { removeLiveChatMessageFromCache } from '../liveChatCache';

// the app client with `gcTime: Infinity` so no garbage-collection timer keeps Jest alive
jest.mock('@/lib/query/queryClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { QueryClient: QC } = require('@tanstack/react-query');
  return { queryClient: new QC({ defaultOptions: { queries: { gcTime: Infinity } } }) };
});

const msg = (id: string): LiveChatMessage => ({
  id,
  senderType: 'support',
  senderId: 'agent',
  senderName: 'Priya',
  text: `text ${id}`,
  type: 'text',
  fileUrl: null,
  fileName: null,
  contentType: null,
  sentAt: '2026-11-10T10:00:00Z',
  isRead: false,
  isDelivered: true,
  raw: {},
});
const hist = (...ids: string[]): LiveChatHistory => ({ status: 'open', unread: 0, messages: ids.map(msg) });
const KEY = queryKeys.liveChat.messages('u1', 'o1');

describe('removeLiveChatMessageFromCache', () => {
  it('removes the message from the cached history, keeps the data timestamp and reloads the unread count', () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    client.setQueryData(KEY, hist('a', 'b'), { updatedAt: 1234 });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    removeLiveChatMessageFromCache(client, 'u1', 'o1', 'b');
    expect(client.getQueryData<LiveChatHistory>(KEY)?.messages.map((m) => m.id)).toEqual(['a']);
    expect(client.getQueryState(KEY)?.dataUpdatedAt).toBe(1234);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.liveChat.unread('u1', 'o1') });
  });

  it('leaves the history alone when the message is not cached, or nothing is cached', () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    removeLiveChatMessageFromCache(client, 'u1', 'o1', 'a'); // nothing cached: no throw
    expect(client.getQueryData(KEY)).toBeUndefined();
    const original = hist('a');
    client.setQueryData(KEY, original);
    removeLiveChatMessageFromCache(client, 'u1', 'o1', 'zzz');
    expect(client.getQueryData(KEY)).toBe(original);
  });
});

describe('global socket: live_chat_message_deleted', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: { userId: 'u1', orgId: 'o1', orgName: 'Acme', roleId: 1, email: 'a@b.c', name: 'A', managerPermissions: [] },
      hydrated: true,
    });
  });

  it('drops the message from the cached history even when the Live Chat screen is not mounted', () => {
    appQueryClient.setQueryData(KEY, hist('a', 'b'));
    const frame = (orgId: string) => ({ type: 'live_chat_message_deleted', data: { org_id: orgId, message_id: 'a', last_message: '', last_message_at: '' } });
    handleSocketFrame(frame('other-org'));
    expect(appQueryClient.getQueryData<LiveChatHistory>(KEY)?.messages).toHaveLength(2);
    handleSocketFrame(frame('o1'));
    expect(appQueryClient.getQueryData<LiveChatHistory>(KEY)?.messages.map((m) => m.id)).toEqual(['b']);
    appQueryClient.clear();
  });
});
