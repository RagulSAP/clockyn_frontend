import type { LiveChatMessage } from '@/types/api/liveChat';
import { chatItemFromLive, SUPPORT_FALLBACK_NAME } from '../utils/liveChatItems';

const msg = (over: Partial<LiveChatMessage> = {}): LiveChatMessage => ({
  id: 'm1',
  senderType: 'support',
  senderId: 'agent@clockyn.test',
  senderName: 'Priya',
  text: 'hello',
  type: 'text',
  fileUrl: null,
  fileName: null,
  contentType: null,
  sentAt: '2026-11-08T10:00:00Z',
  isRead: false,
  isDelivered: true,
  raw: {},
  ...over,
});

describe('chatItemFromLive', () => {
  it('shows support messages as the other side with the agent name', () => {
    expect(chatItemFromLive(msg())).toMatchObject({ id: 'm1', key: 'm1', fromMe: false, senderName: 'Priya', text: 'hello', state: 'sent' });
  });

  it('falls back to "Clockyn Support" when the agent has no name', () => {
    expect(chatItemFromLive(msg({ senderName: '  ' })).senderName).toBe(SUPPORT_FALLBACK_NAME);
  });

  it('shows every org message as mine, without a sender name', () => {
    const item = chatItemFromLive(msg({ senderType: 'org', senderId: 'other-admin', senderName: 'Ravi', isRead: true }));
    expect(item).toMatchObject({ fromMe: true, senderName: '', isRead: true });
  });

  it('carries attachments through', () => {
    expect(chatItemFromLive(msg({ type: 'image', fileUrl: 'https://s3/x.png' }))).toMatchObject({ type: 'image', fileUrl: 'https://s3/x.png' });
  });

  it('parses the timestamp', () => {
    expect(chatItemFromLive(msg()).ts).toBe(Date.parse('2026-11-08T10:00:00Z'));
  });
});
