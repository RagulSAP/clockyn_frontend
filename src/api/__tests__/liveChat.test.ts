import { api } from '@/lib/api/client';
import { getMessages, getUnread, mapLiveChatHistory, mapLiveChatMessage, markRead, parseLiveChatSocketEvent, send, sendFile } from '../liveChat';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete' | 'upload', jest.Mock>;

beforeEach(() => {
  Object.values(mocked).forEach((m) => m.mockReset());
});

const wire = (over: Record<string, unknown> = {}) => ({
  message_id: 'm1',
  timestamp: '2026-11-08T10:00:00Z',
  message_type: 'text',
  message: 'hello',
  file_url: null,
  file_name: null,
  content_type: null,
  sender_type: 'support',
  sender_id: 'agent@clockyn.test',
  sender_name: 'Priya',
  is_read: false,
  is_delivered: true,
  ...over,
});

describe('mapLiveChatMessage', () => {
  it('maps a support text message', () => {
    expect(mapLiveChatMessage(wire())).toMatchObject({
      id: 'm1',
      senderType: 'support',
      senderName: 'Priya',
      text: 'hello',
      type: 'text',
      fileUrl: null,
      isRead: false,
      isDelivered: true,
    });
  });

  it('treats anything but support as the org and keeps attachment fields', () => {
    const m = mapLiveChatMessage(
      wire({ sender_type: 'org', message_type: 'image', file_url: 'https://s3/x.png', file_name: 'x.png', content_type: 'image/png', is_read: true }),
    );
    expect(m).toMatchObject({ senderType: 'org', type: 'image', fileUrl: 'https://s3/x.png', fileName: 'x.png', contentType: 'image/png', isRead: true });
    expect(mapLiveChatMessage(wire({ sender_type: 'SUPPORT ' })).senderType).toBe('support');
    expect(mapLiveChatMessage({}).senderType).toBe('org');
  });
});

describe('mapLiveChatHistory', () => {
  it('maps status, unread and the messages', () => {
    const h = mapLiveChatHistory({ success: true, status: 'closed', unread: 2, messages: [wire(), wire({ message_id: 'm2' })] });
    expect(h.status).toBe('closed');
    expect(h.unread).toBe(2);
    expect(h.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('copes with a thread that does not exist yet', () => {
    expect(mapLiveChatHistory({ success: true, status: null, unread: 0, messages: [] })).toEqual({ status: null, unread: 0, messages: [] });
    expect(mapLiveChatHistory({ status: 'weird' }).status).toBeNull();
  });
});

describe('parseLiveChatSocketEvent', () => {
  it('parses a live_chat_message frame (object or JSON string)', () => {
    const frame = { type: 'live_chat_message', data: { ...wire(), org_id: 'org1' } };
    for (const input of [frame, JSON.stringify(frame)]) {
      const ev = parseLiveChatSocketEvent(input);
      expect(ev).toMatchObject({ type: 'live_chat_message', orgId: 'org1' });
      if (ev.type === 'live_chat_message') expect(ev.message.id).toBe('m1');
    }
  });

  it('parses live_chat_read', () => {
    expect(parseLiveChatSocketEvent({ type: 'live_chat_read', data: { org_id: 'org1', reader: 'support' } })).toEqual({
      type: 'live_chat_read',
      orgId: 'org1',
      reader: 'support',
    });
  });

  it('answers unknown for other frames and garbage', () => {
    expect(parseLiveChatSocketEvent({ type: 'new_message', data: {} })).toEqual({ type: 'unknown' });
    expect(parseLiveChatSocketEvent('not json')).toEqual({ type: 'unknown' });
    expect(parseLiveChatSocketEvent(42)).toEqual({ type: 'unknown' });
  });
});

describe('requests', () => {
  it('getMessages asks for the org thread as this user', async () => {
    mocked.get.mockResolvedValue({ success: true, status: 'open', unread: 1, messages: [wire()] });
    const h = await getMessages('org1', 'me');
    expect(mocked.get).toHaveBeenCalledWith('/live-chat/messages/org1', { user_id: 'me' });
    expect(h.messages).toHaveLength(1);
  });

  it('getMessages rejects a missing org or user id', async () => {
    await expect(getMessages('', 'me')).rejects.toThrow();
    await expect(getMessages('org1', '')).rejects.toThrow();
    expect(mocked.get).not.toHaveBeenCalled();
  });

  it('send posts org, user and text and returns the stored message', async () => {
    mocked.post.mockResolvedValue({ success: true, ...wire({ message_id: 'm9', sender_type: 'org', message: 'hi' }) });
    const m = await send({ orgId: 'org1', userId: 'me', message: 'hi' });
    expect(mocked.post).toHaveBeenCalledWith('/live-chat/send', { org_id: 'org1', user_id: 'me', message: 'hi' });
    expect(m).toMatchObject({ id: 'm9', senderType: 'org', text: 'hi' });
  });

  it('send surfaces the server message when success is false', async () => {
    mocked.post.mockResolvedValue({ success: false, message: 'Message cannot be empty' });
    await expect(send({ orgId: 'org1', userId: 'me', message: ' ' })).rejects.toThrow('Message cannot be empty');
  });

  it('sendFile uploads with org/user fields, a mime fallback and progress', async () => {
    mocked.upload.mockResolvedValue({
      success: true,
      ...wire({ message_id: 'f1', sender_type: 'org', message_type: 'file', message: 'doc.pdf', file_url: 'https://s3/f' }),
    });
    const onProgress = jest.fn();
    const m = await sendFile({ orgId: 'org1', userId: 'me', fileUri: 'file:///tmp/doc.pdf', fileName: 'doc.pdf', mimeType: null, onProgress });
    expect(mocked.upload).toHaveBeenCalledWith(
      '/live-chat/send-file',
      { fileUri: 'file:///tmp/doc.pdf', fieldName: 'file', fileName: 'doc.pdf', mimeType: 'application/pdf', fields: { org_id: 'org1', user_id: 'me' } },
      { onProgress },
    );
    expect(m).toMatchObject({ id: 'f1', type: 'file' });
  });

  it('markRead puts org and user', async () => {
    mocked.put.mockResolvedValue({ success: true, marked: 2 });
    await markRead('org1', 'me');
    expect(mocked.put).toHaveBeenCalledWith('/live-chat/mark-read', { org_id: 'org1', user_id: 'me' });
  });

  it('getUnread returns the count', async () => {
    mocked.get.mockResolvedValue({ success: true, unread: 3 });
    expect(await getUnread('org1', 'me')).toBe(3);
    expect(mocked.get).toHaveBeenCalledWith('/live-chat/unread/org1', { user_id: 'me' });
  });
});
