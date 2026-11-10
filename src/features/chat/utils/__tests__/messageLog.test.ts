import type { ChatMessage } from '@/types/api/chat';
import type { GroupMessage } from '@/types/api/groupChat';
import type { ChatItem } from '../../types';
import {
  chatItemFromDirect,
  chatItemFromGroup,
  createOptimisticItem,
  directBelongs,
  groupAllRead,
  groupBelongs,
  messageLogReducer,
  newClientId,
  normalizeItems,
  peerOfMessage,
  type LogAction,
} from '../messageLog';

const ME = 'me';
const PEER = 'peer';

function direct(over: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    senderId: PEER,
    receiverId: ME,
    text: 'hi',
    type: 'text',
    fileUrl: null,
    sentAt: '2026-10-18T05:00:00Z',
    isRead: false,
    isDelivered: true,
    raw: {},
    ...over,
  };
}

function group(over: Partial<GroupMessage> & { id: string }): GroupMessage {
  return {
    groupId: 'g1',
    senderId: PEER,
    senderName: 'Peer',
    text: 'hello',
    type: 'text',
    fileUrl: null,
    sentAt: '2026-10-18T05:00:00Z',
    isRead: true,
    readCount: 0,
    totalMembers: 0,
    raw: {},
    ...over,
  };
}

const run = (items: ChatItem[], ...actions: LogAction[]): ChatItem[] => actions.reduce(messageLogReducer, items);
const ids = (items: ChatItem[]): string[] => items.map((i) => i.id);

describe('ordering and de-duplication', () => {
  it('sorts confirmed messages by server time and drops duplicates / id-less rows', () => {
    const a = chatItemFromDirect(direct({ id: 'a', sentAt: '2026-10-18T05:02:00Z' }), ME);
    const b = chatItemFromDirect(direct({ id: 'b', sentAt: '2026-10-18T05:01:00Z' }), ME);
    const dup = chatItemFromDirect(direct({ id: 'a', text: 'edited', sentAt: '2026-10-18T05:02:00Z' }), ME);
    const noId = chatItemFromDirect(direct({ id: '' }), ME);
    const out = normalizeItems([a, b, dup, noId]);
    expect(ids(out)).toEqual(['b', 'a']);
    expect(out[1].text).toBe('edited');
  });

  it('keeps messages pending on this device after every confirmed one (no clock-skew mis-ordering)', () => {
    const server = chatItemFromDirect(direct({ id: 's1', sentAt: '2099-01-01T00:00:00Z' }), ME);
    const pending = createOptimisticItem({ clientId: 'c1', senderId: ME, text: 'now', type: 'text', retry: { kind: 'text' }, now: 1 });
    expect(ids(normalizeItems([pending, server]))).toEqual(['s1', 'c1']);
  });
});

describe('optimistic send state machine', () => {
  const optimistic = () => createOptimisticItem({ clientId: 'c1', senderId: ME, text: 'hello', type: 'text', retry: { kind: 'text' } });

  it('sending -> sent by the REST response keeps the React key and adopts the server id', () => {
    const sent = chatItemFromDirect(direct({ id: 'srv1', senderId: ME, receiverId: PEER, text: 'hello' }), ME);
    const out = run([], { type: 'optimistic', item: optimistic() }, { type: 'confirmed', clientId: 'c1', item: sent });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'srv1', key: 'c1', state: 'sent' });
  });

  it('the socket echo arriving first settles the bubble; the later REST response does not duplicate it', () => {
    const echo = chatItemFromDirect(direct({ id: 'srv1', senderId: ME, receiverId: PEER, text: 'hello' }), ME);
    const afterEcho = run([], { type: 'optimistic', item: optimistic() }, { type: 'incoming', item: echo });
    expect(afterEcho).toHaveLength(1);
    expect(afterEcho[0]).toMatchObject({ id: 'srv1', key: 'c1', state: 'sent' });
    const afterRest = run(afterEcho, { type: 'confirmed', clientId: 'c1', item: echo });
    expect(afterRest).toHaveLength(1);
  });

  it('REST first, echo later: the echo is ignored (same id)', () => {
    const sent = chatItemFromDirect(direct({ id: 'srv1', senderId: ME, receiverId: PEER, text: 'hello' }), ME);
    const out = run([], { type: 'optimistic', item: optimistic() }, { type: 'confirmed', clientId: 'c1', item: sent }, { type: 'incoming', item: sent });
    expect(out).toHaveLength(1);
  });

  it('an echo that cannot be matched and an id that already exists never produce twins', () => {
    const sent = chatItemFromDirect(direct({ id: 'srv1', senderId: ME, receiverId: PEER, text: 'renamed.pdf', type: 'file' }), ME);
    const file = createOptimisticItem({ clientId: 'c2', senderId: ME, text: 'orig.pdf', type: 'file', localUri: 'file:///x', retry: { kind: 'file', uri: 'file:///x', fileName: 'orig.pdf', mimeType: 'application/pdf' } });
    // unmatched echo is appended, then the REST response removes the temp (the server id is already present)
    const out = run([], { type: 'optimistic', item: file }, { type: 'incoming', item: sent }, { type: 'confirmed', clientId: 'c2', item: sent });
    expect(ids(out)).toEqual(['srv1']);
  });

  it('sending -> failed -> retrying -> sent, and discard removes only failed messages', () => {
    const sent = chatItemFromDirect(direct({ id: 'srv1', senderId: ME, receiverId: PEER, text: 'hello' }), ME);
    const failed = run([], { type: 'optimistic', item: optimistic() }, { type: 'failed', clientId: 'c1' });
    expect(failed[0].state).toBe('failed');
    expect(run(failed, { type: 'retrying', clientId: 'c1' })[0].state).toBe('sending');
    expect(run(failed, { type: 'retrying', clientId: 'c1' }, { type: 'confirmed', clientId: 'c1', item: sent })[0]).toMatchObject({ state: 'sent', id: 'srv1' });
    expect(run(failed, { type: 'discard', clientId: 'c1' })).toHaveLength(0);
    // a sending message cannot be discarded
    expect(run([optimistic()], { type: 'discard', clientId: 'c1' })).toHaveLength(1);
    // a failure report for a message that already settled is ignored
    expect(run(run([], { type: 'optimistic', item: optimistic() }, { type: 'confirmed', clientId: 'c1', item: sent }), { type: 'failed', clientId: 'c1' })[0].state).toBe('sent');
  });

  it('upload progress is tracked on the sending message only', () => {
    const file = createOptimisticItem({ clientId: 'c3', senderId: ME, text: 'a.png', type: 'image', localUri: 'file:///a.png', retry: { kind: 'file', uri: 'file:///a.png', fileName: 'a.png', mimeType: 'image/png' } });
    const out = run([], { type: 'optimistic', item: file }, { type: 'progress', clientId: 'c3', progress: 42 });
    expect(out[0].progress).toBe(42);
    expect(out[0].localUri).toBe('file:///a.png');
  });

  it('keeps the local thumbnail after confirmation (no flicker)', () => {
    const file = createOptimisticItem({ clientId: 'c3', senderId: ME, text: 'a.png', type: 'image', localUri: 'file:///a.png', retry: { kind: 'file', uri: 'file:///a.png', fileName: 'a.png', mimeType: 'image/png' } });
    const server = chatItemFromDirect(direct({ id: 's9', senderId: ME, receiverId: PEER, text: 'a.png', type: 'image', fileUrl: 'https://cdn/x/a.png?sig=1' }), ME);
    const out = run([], { type: 'optimistic', item: file }, { type: 'confirmed', clientId: 'c3', item: server });
    expect(out[0]).toMatchObject({ key: 'c3', localUri: 'file:///a.png', fileUrl: 'https://cdn/x/a.png?sig=1' });
  });
});

describe('history merge', () => {
  it('replaces confirmed messages, keeps pending ones and the keys of known messages', () => {
    const known = { ...chatItemFromDirect(direct({ id: 'a' }), ME), key: 'stable' };
    const pending = createOptimisticItem({ clientId: 'c1', senderId: ME, text: 'typing', type: 'text', retry: { kind: 'text' } });
    const fresh = chatItemFromDirect(direct({ id: 'a', text: 'hi again' }), ME);
    const other = chatItemFromDirect(direct({ id: 'b', sentAt: '2026-10-18T06:00:00Z' }), ME);
    const out = run([known, pending], { type: 'history', items: [fresh, other] });
    expect(ids(out)).toEqual(['a', 'b', 'c1']);
    expect(out[0]).toMatchObject({ key: 'stable', text: 'hi again' });
  });

  it('never loses a message that landed after the history request was made', () => {
    const recent = createOptimisticItem({ clientId: 'c1', senderId: ME, text: 'late', type: 'text', retry: { kind: 'text' } });
    const sent = chatItemFromDirect(direct({ id: 'srv', senderId: ME, receiverId: PEER, text: 'late', sentAt: new Date().toISOString() }), ME);
    const settled = run([], { type: 'optimistic', item: recent }, { type: 'confirmed', clientId: 'c1', item: sent });
    const stale = chatItemFromDirect(direct({ id: 'old', sentAt: '2026-10-18T05:00:00Z' }), ME);
    expect(ids(run(settled, { type: 'history', items: [stale] }))).toEqual(['old', 'srv']);
  });
});

describe('conversation guards and read receipts', () => {
  it('directBelongs only accepts messages between me and the open peer', () => {
    expect(directBelongs({ senderId: PEER, receiverId: ME }, ME, PEER)).toBe(true);
    expect(directBelongs({ senderId: ME, receiverId: PEER }, ME, PEER)).toBe(true);
    expect(directBelongs({ senderId: 'other', receiverId: ME }, ME, PEER)).toBe(false);
    expect(directBelongs({ senderId: ME, receiverId: 'other' }, ME, PEER)).toBe(false);
    expect(directBelongs({ senderId: PEER, receiverId: '' }, ME, PEER)).toBe(true);
    expect(directBelongs({ senderId: PEER, receiverId: ME }, ME, '')).toBe(false);
    expect(peerOfMessage({ senderId: ME, receiverId: PEER }, ME)).toBe(PEER);
    expect(peerOfMessage({ senderId: PEER, receiverId: ME }, ME)).toBe(PEER);
  });

  it('groupBelongs compares the group id', () => {
    expect(groupBelongs({ groupId: 'g1' }, 'g1')).toBe(true);
    expect(groupBelongs({ groupId: 'g2' }, 'g1')).toBe(false);
    expect(groupBelongs({ groupId: 'g1' }, '')).toBe(false);
  });

  it('own_read marks only my confirmed messages, never received or pending ones', () => {
    const mine = chatItemFromDirect(direct({ id: 'm1', senderId: ME, receiverId: PEER }), ME);
    const theirs = chatItemFromDirect(direct({ id: 't1' }), ME);
    const pending = createOptimisticItem({ clientId: 'c1', senderId: ME, text: 'x', type: 'text', retry: { kind: 'text' } });
    const out = run([mine, theirs, pending], { type: 'own_read' });
    expect(out.find((i) => i.id === 'm1')?.isRead).toBe(true);
    expect(out.find((i) => i.id === 't1')?.isRead).toBe(false);
    expect(out.find((i) => i.id === 'c1')?.isRead).toBe(false);
  });

  it('remove drops the message with that id and ignores unknown ids', () => {
    const a = chatItemFromDirect(direct({ id: 'a' }), ME);
    const b = chatItemFromDirect(direct({ id: 'b', sentAt: '2026-10-18T05:01:00Z' }), ME);
    const out = run([a, b], { type: 'remove', messageId: 'a' });
    expect(out.map((i) => i.id)).toEqual(['b']);
    const same = [a, b];
    expect(messageLogReducer(same, { type: 'remove', messageId: 'zzz' })).toBe(same);
    expect(messageLogReducer(same, { type: 'remove', messageId: '' })).toBe(same);
  });

  it('delivered flags exactly one message', () => {
    const a = { ...chatItemFromDirect(direct({ id: 'a', senderId: ME }), ME), isDelivered: false };
    const b = { ...chatItemFromDirect(direct({ id: 'b', senderId: ME }), ME), isDelivered: false };
    const out = run([a, b], { type: 'delivered', messageId: 'b' });
    expect(out.map((i) => i.isDelivered)).toEqual([false, true]);
  });
});

describe('group receipts', () => {
  it('my own group messages are read only when every other member has read them (not the server is_read)', () => {
    expect(groupAllRead(0, 3)).toBe(false);
    expect(groupAllRead(2, 3)).toBe(false);
    expect(groupAllRead(3, 3)).toBe(true);
    expect(groupAllRead(0, 0)).toBe(false);
    expect(chatItemFromGroup(group({ id: 'x', senderId: ME, isRead: true, readCount: 1, totalMembers: 3 }), ME).isRead).toBe(false);
    expect(chatItemFromGroup(group({ id: 'y', senderId: ME, isRead: true, readCount: 3, totalMembers: 3 }), ME).isRead).toBe(true);
  });

  it('group_read updates the named message only; without a message id it updates my messages', () => {
    const a = chatItemFromGroup(group({ id: 'a', senderId: ME, readCount: 0, totalMembers: 2 }), ME);
    const b = chatItemFromGroup(group({ id: 'b', senderId: ME, readCount: 0, totalMembers: 2 }), ME);
    const theirs = chatItemFromGroup(group({ id: 'c' }), ME);
    const one = run([a, b, theirs], { type: 'group_read', messageId: 'b', readCount: 2, totalMembers: 2, fallbackTotal: 0 });
    expect(one.map((i) => [i.id, i.isRead, i.readCount])).toEqual([
      ['a', false, 0],
      ['b', true, 2],
      ['c', true, 0],
    ]);
    const all = run([a, b], { type: 'group_read', readCount: 1, fallbackTotal: 1 });
    expect(all.every((i) => i.readCount === 1)).toBe(true);
  });

  it('uses the live member count as the fallback total, so a stale closure cannot cause false ticks', () => {
    const a = chatItemFromGroup(group({ id: 'a', senderId: ME, readCount: 0, totalMembers: 0 }), ME);
    expect(run([a], { type: 'group_read', readCount: 1, fallbackTotal: 3 })[0].isRead).toBe(false);
    expect(run([a], { type: 'group_read', readCount: 3, fallbackTotal: 3 })[0].isRead).toBe(true);
  });
});

describe('ids', () => {
  it('client ids are unique', () => {
    expect(newClientId(1)).not.toBe(newClientId(1));
  });
});
