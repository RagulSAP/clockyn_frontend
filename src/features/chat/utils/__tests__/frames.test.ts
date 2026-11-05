import { interpretChatFrame, readAppliesToDirect, readAppliesToGroup, type ReadFrame } from '../frames';

const read = (over: Partial<ReadFrame>): ReadFrame => ({ readerId: null, senderId: null, groupId: null, messageId: null, readCount: null, totalMembers: null, ...over });

describe('interpretChatFrame', () => {
  it('decodes strings and objects, ignores garbage', () => {
    expect(interpretChatFrame('not json').kind).toBe('other');
    expect(interpretChatFrame(42).kind).toBe('other');
    expect(interpretChatFrame({ type: 'whatever' }).kind).toBe('other');
  });

  it('maps a 1:1 message', () => {
    const f = interpretChatFrame(JSON.stringify({ type: 'new_message', data: { message_id: 'm1', sender_id: 'a', receiver_id: 'b', message: 'hi', timestamp: '2026-10-18T05:00:00Z' } }));
    expect(f.kind).toBe('direct_message');
    if (f.kind === 'direct_message') expect(f.message).toMatchObject({ id: 'm1', senderId: 'a', receiverId: 'b', text: 'hi' });
  });

  it('a group message under either event name is a group message', () => {
    const named = interpretChatFrame({ type: 'new_group_message', data: { message_id: 'g1', group_id: 'G', sender_id: 'a', sender_name: 'A', message: 'x' } });
    const legacy = interpretChatFrame({ type: 'new_message', data: { message_id: 'g2', group_id: 'G', sender_id: 'a', sender_name: 'A', message: 'x' } });
    expect(named.kind).toBe('group_message');
    expect(legacy.kind).toBe('group_message');
  });

  it('maps read_update, delivered and group_created', () => {
    const r = interpretChatFrame({ type: 'read_update', data: { reader_id: 'peer', sender_id: 'me' } });
    expect(r).toEqual({ kind: 'read', read: expect.objectContaining({ readerId: 'peer', senderId: 'me', groupId: null }) });
    const g = interpretChatFrame({ type: 'read_update', data: { reader_id: 'u', group_id: 'G', message_id: 'm', read_count: '2', total_members: 3 } });
    expect(g.kind === 'read' && g.read).toMatchObject({ groupId: 'G', messageId: 'm', readCount: 2, totalMembers: 3 });
    expect(interpretChatFrame({ type: 'delivered', data: { message_id: 'm9' } })).toEqual({ kind: 'delivered', messageId: 'm9' });
    expect(interpretChatFrame({ type: 'delivered', data: {} }).kind).toBe('other');
    expect(interpretChatFrame({ type: 'group_created', data: { group_id: 'G' } }).kind).toBe('group_created');
  });
});

describe('read receipts only touch the right conversation', () => {
  it('1:1: only when the open peer is the reader and the receipt is about my messages', () => {
    expect(readAppliesToDirect(read({ readerId: 'peer', senderId: 'me' }), 'me', 'peer')).toBe(true);
    expect(readAppliesToDirect(read({ readerId: 'peer' }), 'me', 'peer')).toBe(true);
    expect(readAppliesToDirect(read({ readerId: 'someone', senderId: 'me' }), 'me', 'peer')).toBe(false);
    expect(readAppliesToDirect(read({ readerId: 'peer', senderId: 'other' }), 'me', 'peer')).toBe(false);
    expect(readAppliesToDirect(read({ readerId: 'peer', groupId: 'G' }), 'me', 'peer')).toBe(false);
  });

  it('group: only the open group; a 1:1-shaped receipt on the group socket is ignored; my own read is ignored', () => {
    expect(readAppliesToGroup(read({ readerId: 'u', groupId: 'G' }), 'me', 'G')).toBe(true);
    expect(readAppliesToGroup(read({ readerId: 'u', groupId: 'H' }), 'me', 'G')).toBe(false);
    expect(readAppliesToGroup(read({ readerId: 'me', groupId: 'G' }), 'me', 'G')).toBe(false);
    expect(readAppliesToGroup(read({ readerId: 'u', senderId: 'me' }), 'me', 'G')).toBe(false);
    expect(readAppliesToGroup(read({ readCount: 2 }), 'me', 'G')).toBe(true);
    expect(readAppliesToGroup(read({}), 'me', 'G')).toBe(false);
  });
});
