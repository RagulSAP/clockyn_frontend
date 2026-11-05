import { api } from '@/lib/api/client';
import {
  chatSocketPath,
  chatSocketUrl,
  deleteConversation,
  getChatList,
  getChatMessages,
  getChatUnreadTotal,
  mapChatContact,
  mapChatMessage,
  markChatRead,
  parseChatSocketEvent,
  searchChatStaff,
  sendChatFile,
  sendChatMessage,
  sumChatUnread,
} from '../chat';
import {
  addGroupMembers,
  buildGroupMemberIds,
  createGroup,
  getGroupMembers,
  getGroupMessages,
  getGroupUnreadTotal,
  groupSocketUrl,
  listGroups,
  mapGroupMessage,
  markGroupRead,
  sendGroupFile,
  sendGroupMessage,
  sumGroupUnread,
} from '../groupChat';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete' | 'upload', jest.Mock>;

beforeEach(() => {
  Object.values(mocked).forEach((m) => m.mockReset());
});

describe('chat mapping', () => {
  it('mapChatContact reads the list row', () => {
    const c = mapChatContact({
      user_id: 'u2',
      name: 'Asha',
      role_name: 'Staff',
      dept_name: 'Sales',
      branch_name: 'HQ',
      last_message: 'hi',
      last_message_type: 'IMAGE',
      last_message_time: '2026-10-01T10:00:00Z',
      unread_count: '3',
      is_online: false,
      profile_photo_url: 'https://x/p.png',
    });
    expect(c).toMatchObject({
      userId: 'u2',
      name: 'Asha',
      lastMessage: 'hi',
      lastMessageType: 'image',
      lastMessageAt: '2026-10-01T10:00:00Z',
      unreadCount: 3,
      isOnline: false,
      photoUrl: 'https://x/p.png',
    });
  });

  it('mapChatContact handles a contact without messages', () => {
    const c = mapChatContact({ user_id: 'u3', name: 'B', last_message: null, unread_count: null });
    expect(c.lastMessage).toBeNull();
    expect(c.lastMessageType).toBeNull();
    expect(c.photoUrl).toBeNull();
    expect(c.unreadCount).toBe(0);
  });

  it('mapChatMessage maps ids, kind and flags', () => {
    const m = mapChatMessage({
      message_id: 'm1',
      sender_id: 'a',
      receiver_id: 'b',
      message: 'doc.pdf',
      message_type: 'file',
      file_url: 'https://s3/x',
      timestamp: '2026-10-01T10:00:00Z',
      is_delivered: true,
      is_read: false,
      sender_name: 'Asha',
    });
    expect(m).toMatchObject({ id: 'm1', type: 'file', fileUrl: 'https://s3/x', isRead: false, isDelivered: true, senderName: 'Asha' });
  });

  it('sums unread counts', () => {
    expect(sumChatUnread([mapChatContact({ unread_count: 2 }), mapChatContact({ unread_count: 5 })])).toBe(7);
    expect(sumGroupUnread([])).toBe(0);
  });
});

describe('parseChatSocketEvent', () => {
  it('parses a JSON string new_message frame', () => {
    const ev = parseChatSocketEvent(
      JSON.stringify({ type: 'new_message', data: { message_id: 'm', sender_id: 'a', receiver_id: 'b', message: 'yo' } }),
    );
    expect(ev.type).toBe('new_message');
    if (ev.type === 'new_message') expect(ev.message).toMatchObject({ id: 'm', text: 'yo' });
  });

  it('parses group and read events', () => {
    const g = parseChatSocketEvent({ type: 'new_group_message', data: { message_id: 'g1', group_id: 'G', sender_name: 'X', message: 'hey' } });
    expect(g.type === 'new_group_message' && g.message.groupId).toBe('G');
    expect(parseChatSocketEvent({ type: 'read_update', data: { reader_id: 'u', sender_id: 's' } })).toEqual({
      type: 'read_update',
      readerId: 'u',
      senderId: 's',
      groupId: null,
    });
    expect(parseChatSocketEvent({ type: 'read_update', data: { reader_id: 'u', group_id: 'G' } })).toEqual({
      type: 'read_update',
      readerId: 'u',
      senderId: null,
      groupId: 'G',
    });
    expect(parseChatSocketEvent({ type: 'group_created', data: { group_id: 'G', group_name: 'Team', created_by: 'a' } })).toMatchObject({
      type: 'group_created',
      groupId: 'G',
      name: 'Team',
      createdBy: 'a',
    });
  });

  it('returns unknown for junk and unsupported types', () => {
    expect(parseChatSocketEvent('not json').type).toBe('unknown');
    expect(parseChatSocketEvent(42).type).toBe('unknown');
    expect(parseChatSocketEvent({ type: 'badge_update', data: {} })).toMatchObject({ type: 'unknown', rawType: 'badge_update' });
  });
});

describe('chat requests', () => {
  it('getChatList sends org_id and maps the bare array', async () => {
    mocked.get.mockResolvedValue([{ user_id: 'u2', name: 'A', unread_count: 1 }]);
    const list = await getChatList('me', 'org1');
    expect(mocked.get).toHaveBeenCalledWith('/chat/list/me', { org_id: 'org1' });
    expect(list).toHaveLength(1);
    mocked.get.mockResolvedValue([
      { user_id: 'u2', unread_count: 4 },
      { user_id: 'u3', unread_count: 1 },
    ]);
    expect(await getChatUnreadTotal('me', 'org1')).toBe(5);
  });

  it('searchChatStaff and getChatMessages', async () => {
    mocked.get.mockResolvedValueOnce([{ user_id: 'x', name: 'Xen' }]);
    expect(await searchChatStaff('me', 'xe')).toEqual([expect.objectContaining({ userId: 'x', name: 'Xen' })]);
    expect(mocked.get).toHaveBeenCalledWith('/chat/search/me', { q: 'xe' });
    mocked.get.mockResolvedValueOnce([{ message_id: '1', message: 'a' }]);
    expect((await getChatMessages('me', 'o/1'))[0].id).toBe('1');
    expect(mocked.get).toHaveBeenLastCalledWith('/chat/messages/me/o%2F1');
  });

  it('sendChatMessage posts the v1 field names', async () => {
    mocked.post.mockResolvedValue({ message_id: 'm9', sender_id: 'a', receiver_id: 'b', message: 'hello', message_type: 'text', timestamp: 't' });
    const m = await sendChatMessage({ senderId: 'a', receiverId: 'b', message: 'hello', senderName: 'Asha' });
    expect(mocked.post).toHaveBeenCalledWith('/chat/send', { sender_id: 'a', receiver_id: 'b', message: 'hello', sender_name: 'Asha' });
    expect(m.id).toBe('m9');
    await sendChatMessage({ senderId: 'a', receiverId: 'b', message: 'x' });
    expect(mocked.post).toHaveBeenLastCalledWith('/chat/send', { sender_id: 'a', receiver_id: 'b', message: 'x' });
  });

  it('sendChatMessage surfaces success:false', async () => {
    mocked.post.mockResolvedValue({ success: false, message: 'Not allowed' });
    await expect(sendChatMessage({ senderId: 'a', receiverId: 'b', message: 'x' })).rejects.toThrow('Not allowed');
  });

  it('sendChatFile uploads with fields, mime fallback and progress', async () => {
    mocked.upload.mockResolvedValue({ message_id: 'f1', message: 'doc.pdf', message_type: 'file', file_url: 'https://s3/f' });
    const onProgress = jest.fn();
    const m = await sendChatFile({
      senderId: 'a',
      receiverId: 'b',
      fileUri: 'file:///tmp/doc.pdf',
      fileName: 'doc.pdf',
      mimeType: null,
      onProgress,
    });
    expect(mocked.upload).toHaveBeenCalledWith(
      '/chat/send-file',
      {
        fileUri: 'file:///tmp/doc.pdf',
        fieldName: 'file',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        fields: { sender_id: 'a', receiver_id: 'b' },
      },
      { onProgress },
    );
    expect(m).toMatchObject({ id: 'f1', type: 'file' });
  });

  it('markChatRead sends sender_id / receiver_id', async () => {
    mocked.put.mockResolvedValue({ success: true, marked_count: 2 });
    await markChatRead('other', 'me');
    expect(mocked.put).toHaveBeenCalledWith('/chat/mark-read', { sender_id: 'other', receiver_id: 'me' });
  });

  it('deleteConversation calls the delete route', async () => {
    mocked.delete.mockResolvedValue({ success: true });
    await deleteConversation('me', 'o');
    expect(mocked.delete).toHaveBeenCalledWith('/chat/delete/me/o');
  });

  it('builds socket paths and URLs', () => {
    expect(chatSocketPath('u 1')).toBe('/ws/chat/u%201');
    expect(chatSocketUrl('u1')).toMatch(/^wss?:\/\/.+\/ws\/chat\/u1$/);
    expect(groupSocketUrl('g1', 'u1')).toMatch(/^wss?:\/\/.+\/ws\/group-chat\/g1\/u1$/);
  });
});

describe('group chat', () => {
  it('buildGroupMemberIds puts the creator first and removes duplicates', () => {
    expect(buildGroupMemberIds('me', ['a', 'me', 'b', 'a', ' '])).toEqual(['me', 'a', 'b']);
  });

  it('listGroups uses org_id (not organization_id)', async () => {
    mocked.get.mockResolvedValue([
      { group_id: 'G1', group_name: 'Team', created_by: 'me', member_count: 3, unread_count: 2, last_message_sender: 'Asha' },
    ]);
    const groups = await listGroups('me', 'org1');
    expect(mocked.get).toHaveBeenCalledWith('/group-chat/list/me', { org_id: 'org1' });
    expect(groups[0]).toMatchObject({
      groupId: 'G1',
      name: 'Team',
      memberCount: 3,
      unreadCount: 2,
      lastMessageSender: 'Asha',
      lastMessage: null,
    });
    expect(await getGroupUnreadTotal('me', 'org1')).toBe(2);
  });

  it('createGroup includes the creator, validates and maps the result', async () => {
    mocked.post.mockResolvedValue({ group_id: 'G2', group_name: 'Ops', created_by: 'me', member_count: 3, unread_count: 0 });
    const g = await createGroup({ name: ' Ops ', createdBy: 'me', memberIds: ['a', 'b'], orgId: 'org1' });
    expect(mocked.post).toHaveBeenCalledWith('/group-chat/create', {
      group_name: 'Ops',
      created_by: 'me',
      member_ids: ['me', 'a', 'b'],
      org_id: 'org1',
    });
    expect(g.groupId).toBe('G2');
    await expect(createGroup({ name: '  ', createdBy: 'me', memberIds: ['a'], orgId: 'o' })).rejects.toThrow('Enter a group name');
    await expect(createGroup({ name: 'X', createdBy: 'me', memberIds: [], orgId: 'o' })).rejects.toThrow('Select at least 1 member');
  });

  it('messages, send, members, add, mark-read', async () => {
    mocked.get.mockResolvedValueOnce([
      { message_id: 'm', group_id: 'G', sender_id: 's', sender_name: 'S', message: 'x', is_read: true, read_count: '2', total_members: 4 },
    ]);
    const [m] = await getGroupMessages('G', 'me');
    expect(mocked.get).toHaveBeenCalledWith('/group-chat/messages/G', { user_id: 'me' });
    expect(m).toMatchObject({ id: 'm', readCount: 2, totalMembers: 4, isRead: true });

    mocked.post.mockResolvedValueOnce({ message_id: 'n', group_id: 'G', message: 'yo' });
    await sendGroupMessage('G', 'me', 'yo');
    expect(mocked.post).toHaveBeenLastCalledWith('/group-chat/send', { group_id: 'G', sender_id: 'me', message: 'yo' });

    mocked.get.mockResolvedValueOnce([{ user_id: 'a', name: 'A', is_admin: true }]);
    expect((await getGroupMembers('G'))[0]).toMatchObject({ userId: 'a', isAdmin: true });

    mocked.post.mockResolvedValueOnce({ success: true, added: 1 });
    await addGroupMembers('G', ['x']);
    expect(mocked.post).toHaveBeenLastCalledWith('/group-chat/add-members', { group_id: 'G', member_ids: ['x'] });

    mocked.put.mockResolvedValueOnce({ success: true });
    await markGroupRead('G', 'me');
    expect(mocked.put).toHaveBeenCalledWith('/group-chat/mark-read', { group_id: 'G', user_id: 'me' });
  });

  it('sendGroupFile uploads to the group endpoint', async () => {
    mocked.upload.mockResolvedValue({ message_id: 'gf', group_id: 'G', message: 'p.png', message_type: 'image' });
    const msg = await sendGroupFile({ senderId: 'me', groupId: 'G', fileUri: 'file:///p.png', fileName: 'p.png' });
    expect(mocked.upload.mock.calls[0][0]).toBe('/group-chat/send-file');
    expect(mocked.upload.mock.calls[0][1]).toMatchObject({ fieldName: 'file', mimeType: 'image/png', fields: { sender_id: 'me', group_id: 'G' } });
    expect(msg.type).toBe('image');
  });

  it('mapGroupMessage tolerates socket payloads', () => {
    expect(mapGroupMessage({ message_id: 'x', group_id: 'G', sender_id: 's', message: 'm' })).toMatchObject({
      readCount: 0,
      totalMembers: 0,
      isRead: false,
      fileUrl: null,
    });
  });
});
