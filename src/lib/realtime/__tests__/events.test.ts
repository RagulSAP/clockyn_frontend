import { applyGlobalAction, classifyAnnouncementTarget, interpretPushData, interpretSocketFrame, realtimeBus, type BadgeSink } from '../events';
import { createDeduper } from '../socketCore';

const makeSink = (): jest.Mocked<BadgeSink> => ({ addChatMessage: jest.fn(), addAnnouncement: jest.fn(), addRequest: jest.fn() });
const fixedNow = () => new Date('2026-01-02T03:04:05.000Z');

describe('classifyAnnouncementTarget', () => {
  it.each([
    ['all', 'broadcast'],
    ['selected', 'broadcast'],
    ['broadcast', 'broadcast'],
    ['branch', 'targeted'],
    ['dept', 'targeted'],
    [undefined, 'targeted'],
  ])('%s -> %s', (input, expected) => {
    expect(classifyAnnouncementTarget(input)).toBe(expected);
  });
});

describe('interpretSocketFrame', () => {
  it('counts an individual message from someone else', () => {
    const a = interpretSocketFrame({ type: 'new_message', data: { sender_id: 'u2', message_id: 11, receiver_id: 'u1' } }, 'u1');
    expect(a).toEqual({ kind: 'chat_message', section: 'individual', messageId: '11' });
  });
  it('treats group_id messages as group', () => {
    const a = interpretSocketFrame({ type: 'new_chat_message', data: { sender_id: 'u2', message_id: 'm', group_id: 'g' } }, 'u1');
    expect(a).toEqual({ kind: 'chat_message', section: 'group', messageId: 'm' });
    const b = interpretSocketFrame({ type: 'new_group_message', data: { sender_id: 'u2', message_id: 'm2', group_id: 'g' } }, 'u1');
    expect(b).toEqual({ kind: 'chat_message', section: 'group', messageId: 'm2' });
  });
  it('accepts the flat shape (no data wrapper) and messageId spelling', () => {
    const a = interpretSocketFrame({ type: 'new_message', sender_id: 'u2', messageId: 'x' }, 'u1');
    expect(a).toEqual({ kind: 'chat_message', section: 'individual', messageId: 'x' });
  });
  it('ignores own messages and messages without sender / id', () => {
    expect(interpretSocketFrame({ type: 'new_message', data: { sender_id: 'u1', message_id: '1' } }, 'u1')).toBeNull();
    expect(interpretSocketFrame({ type: 'new_message', data: { message_id: '1' } }, 'u1')).toBeNull();
    expect(interpretSocketFrame({ type: 'new_message', data: { sender_id: 'u2' } }, 'u1')).toBeNull();
  });
  it('maps announcements', () => {
    expect(interpretSocketFrame({ type: 'announcement', target: 'all' }, 'u1')).toEqual({ kind: 'announcement', announcement: 'broadcast' });
    expect(interpretSocketFrame({ type: 'announcement', target: 'dept' }, 'u1')).toEqual({ kind: 'announcement', announcement: 'targeted' });
  });
  it('maps request_submitted', () => {
    expect(interpretSocketFrame({ type: 'request_submitted' }, 'u1')).toEqual({ kind: 'request_submitted' });
  });
  it('maps badge_update with and without a notification', () => {
    const withN = interpretSocketFrame({ type: 'badge_update', notification: { id: 5, title: 'T', body: 'B', image_url: 'http://x/y.png', type: 'punch_out' } }, 'u1', fixedNow);
    expect(withN).toEqual({
      kind: 'punch_notification',
      notification: { id: '5', title: 'T', body: 'B', imageUrl: 'http://x/y.png', type: 'punch_out', receivedAt: '2026-01-02T03:04:05.000Z' },
    });
    expect(interpretSocketFrame({ type: 'badge_update' }, 'u1')).toEqual({ kind: 'punch_notification', notification: null });
    const defaults = interpretSocketFrame({ type: 'badge_update', notification: { title: 'x' } }, 'u1', fixedNow);
    expect(defaults).toMatchObject({ notification: { id: String(fixedNow().getTime()), type: 'punch_in', imageUrl: null } });
  });
  it('ignores unknown / malformed frames', () => {
    expect(interpretSocketFrame({ type: 'read_update', data: {} }, 'u1')).toBeNull();
    expect(interpretSocketFrame('nope', 'u1')).toBeNull();
    expect(interpretSocketFrame(null, 'u1')).toBeNull();
    expect(interpretSocketFrame([1], 'u1')).toBeNull();
  });
});

describe('interpretPushData', () => {
  it('counts chat pushes that carry a message id (deduplicable)', () => {
    expect(interpretPushData({ type: 'new_message', message_id: '9' }, { selfId: 'u1', socketOpen: true })).toEqual({
      kind: 'chat_message',
      section: 'individual',
      messageId: '9',
    });
    expect(interpretPushData({ type: 'new_group_message', message_id: '9' }, { selfId: 'u1', socketOpen: true })).toMatchObject({ section: 'group' });
  });
  it('without a message id the socket is authoritative while open', () => {
    expect(interpretPushData({ type: 'new_message' }, { selfId: 'u1', socketOpen: true })).toBeNull();
    expect(interpretPushData({ type: 'new_message' }, { selfId: 'u1', socketOpen: false, now: () => 42 })).toEqual({
      kind: 'chat_message',
      section: 'individual',
      messageId: 'push_42',
    });
  });
  it('ignores own messages', () => {
    expect(interpretPushData({ type: 'new_message', message_id: '1', sender_id: 'u1' }, { selfId: 'u1', socketOpen: false })).toBeNull();
  });
  it('maps punch pushes to a punch notification (null without a notification payload)', () => {
    const withN = interpretPushData(
      { type: 'punch_in', image_url: 'http://x/i.png', user_id: 's1' },
      { selfId: 'a1', socketOpen: true, now: () => Date.parse('2026-01-02T03:04:05.000Z'), notification: { title: 'T', body: 'B' } },
    );
    expect(withN).toEqual({
      kind: 'punch_notification',
      notification: { id: String(Date.parse('2026-01-02T03:04:05.000Z')), title: 'T', body: 'B', imageUrl: 'http://x/i.png', type: 'punch_in', receivedAt: '2026-01-02T03:04:05.000Z' },
    });
    expect(interpretPushData({ type: 'punch_out' }, { selfId: 'a1', socketOpen: true })).toEqual({ kind: 'punch_notification', notification: null });
  });
  it('maps announcement targets and ignores unrelated types', () => {
    expect(interpretPushData({ type: 'announcement', target: 'branch' }, { selfId: 'u1', socketOpen: true })).toEqual({ kind: 'announcement', announcement: 'targeted' });
    expect(interpretPushData({ type: 'force_logout' }, { selfId: 'u1', socketOpen: true })).toBeNull();
    expect(interpretPushData(undefined, { selfId: 'u1', socketOpen: true })).toBeNull();
  });
});

describe('applyGlobalAction', () => {
  it('counts a chat message once even if the global socket, a chat socket and a push deliver it', () => {
    const sink = makeSink();
    const dedupe = createDeduper();
    const fromSocket = interpretSocketFrame({ type: 'new_message', data: { sender_id: 'u2', message_id: '1' } }, 'u1')!;
    const fromChatSocket = interpretSocketFrame({ type: 'new_message', data: { sender_id: 'u2', message_id: '1' } }, 'u1')!;
    const fromPush = interpretPushData({ type: 'new_message', message_id: '1' }, { selfId: 'u1', socketOpen: true })!;
    expect(applyGlobalAction(fromSocket, sink, dedupe)).toBe(true);
    expect(applyGlobalAction(fromChatSocket, sink, dedupe)).toBe(false);
    expect(applyGlobalAction(fromPush, sink, dedupe)).toBe(false);
    expect(sink.addChatMessage).toHaveBeenCalledTimes(1);
    expect(sink.addChatMessage).toHaveBeenCalledWith('individual', '1');
  });
  it('does not confuse the same id in different sections', () => {
    const sink = makeSink();
    const dedupe = createDeduper();
    applyGlobalAction({ kind: 'chat_message', section: 'group', messageId: '1' }, sink, dedupe);
    applyGlobalAction({ kind: 'chat_message', section: 'individual', messageId: '1' }, sink, dedupe);
    expect(sink.addChatMessage).toHaveBeenCalledTimes(2);
  });
  it('forwards announcements and requests and publishes on the bus', () => {
    const sink = makeSink();
    const seen: string[] = [];
    const off = realtimeBus.subscribe((e) => seen.push(e.type));
    applyGlobalAction({ kind: 'announcement', announcement: 'targeted' }, sink, createDeduper());
    applyGlobalAction({ kind: 'request_submitted' }, sink, createDeduper());
    applyGlobalAction({ kind: 'punch_notification', notification: null }, sink, createDeduper());
    off();
    expect(sink.addAnnouncement).toHaveBeenCalledWith('targeted');
    expect(sink.addRequest).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['announcement', 'request_submitted', 'punch_notification']);
  });
  it('a throwing bus listener does not break the others', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = jest.fn();
    const off1 = realtimeBus.subscribe(() => {
      throw new Error('x');
    });
    const off2 = realtimeBus.subscribe(ok);
    applyGlobalAction({ kind: 'request_submitted' }, makeSink(), createDeduper());
    off1();
    off2();
    expect(ok).toHaveBeenCalled();
    warn.mockRestore();
  });
});
