import { badges, hasSeenMessageId, registerMessageId, resetBadges, useBadgeStore } from '../badges';

beforeEach(() => {
  resetBadges();
});

describe('registerMessageId (de-dup helper)', () => {
  it('accepts a new id once', () => {
    expect(registerMessageId('m1')).toBe(true);
    expect(registerMessageId('m1')).toBe(false);
    expect(hasSeenMessageId('m1')).toBe(true);
  });
  it('normalises numbers and whitespace', () => {
    expect(registerMessageId(42)).toBe(true);
    expect(registerMessageId('42')).toBe(false);
    expect(registerMessageId(' 7 ')).toBe(true);
    expect(registerMessageId('7')).toBe(false);
  });
  it('rejects missing ids', () => {
    expect(registerMessageId(undefined)).toBe(false);
    expect(registerMessageId(null)).toBe(false);
    expect(registerMessageId('')).toBe(false);
    expect(registerMessageId('undefined')).toBe(false);
  });
  it('is bounded: the oldest ids are evicted', () => {
    for (let i = 0; i < 1100; i += 1) registerMessageId(`bulk-${i}`);
    expect(hasSeenMessageId('bulk-0')).toBe(false);
    expect(hasSeenMessageId('bulk-1099')).toBe(true);
    expect(registerMessageId('bulk-0')).toBe(true);
  });
  it('reset forgets seen ids', () => {
    registerMessageId('m9');
    resetBadges();
    expect(registerMessageId('m9')).toBe(true);
  });
});

describe('chat counting', () => {
  it('counts a message exactly once across sources', () => {
    const s = useBadgeStore.getState();
    expect(s.incrementChatForMessage('individual', 'm1')).toBe(true);
    expect(s.incrementChatForMessage('individual', 'm1')).toBe(false); // same id from push / chat-screen socket
    expect(useBadgeStore.getState().chat).toBe(1);
    expect(s.incrementChatForMessage('group', 'm2')).toBe(true);
    expect(useBadgeStore.getState()).toMatchObject({ chat: 2, chatIndividual: 1, chatGroup: 1 });
  });
  it('ignores messages without an id', () => {
    expect(badges.incrementChatForMessage('individual', undefined)).toBe(false);
    expect(badges.get().chat).toBe(0);
  });
  it('markChatRead subtracts a conversation unread (min 0) or zeroes the section', () => {
    badges.setChatSection('individual', 5);
    badges.setChatSection('group', 2);
    badges.markChatRead('individual', 3);
    expect(badges.get().chat).toBe(4);
    badges.markChatRead('individual', 10);
    expect(useBadgeStore.getState()).toMatchObject({ chatIndividual: 0, chat: 2 });
    badges.markChatRead('group');
    expect(badges.get().chat).toBe(0);
  });
  it('setChatSection syncs absolute values from lists', () => {
    badges.setChatSection('individual', 4);
    badges.setChatSection('group', 3);
    expect(badges.get().chat).toBe(7);
    badges.setChatSection('individual', 1);
    expect(badges.get().chat).toBe(4);
  });
  it('generic set/increment/markRead keep chat = group + individual', () => {
    badges.setChatSection('group', 2);
    badges.set('chat', 5);
    expect(useBadgeStore.getState()).toMatchObject({ chat: 5, chatGroup: 2, chatIndividual: 3 });
    badges.set('chat', 1); // less than the group part
    expect(useBadgeStore.getState()).toMatchObject({ chat: 2, chatGroup: 2, chatIndividual: 0 });
    badges.increment('chat');
    expect(badges.get().chat).toBe(3);
    badges.markRead('chat', 2);
    expect(badges.get().chat).toBe(1);
    badges.markRead('chat');
    expect(badges.get().chat).toBe(0);
  });
});

describe('live chat counter', () => {
  it('counts a support message once per id and ignores a missing id', () => {
    expect(badges.incrementLiveChatForMessage('m1')).toBe(true);
    expect(badges.incrementLiveChatForMessage('m1')).toBe(false);
    expect(badges.incrementLiveChatForMessage(undefined)).toBe(false);
    expect(badges.incrementLiveChatForMessage('m2')).toBe(true);
    expect(badges.get().liveChat).toBe(2);
  });
  it('is independent from the chat counters, set / markRead work and never go below zero', () => {
    badges.setChatSection('individual', 3);
    badges.set('liveChat', 5);
    expect(badges.get()).toMatchObject({ chat: 3, liveChat: 5 });
    badges.markRead('liveChat', 2);
    expect(badges.get().liveChat).toBe(3);
    badges.markRead('liveChat');
    badges.markRead('liveChat', 9);
    expect(badges.get()).toMatchObject({ chat: 3, liveChat: 0 });
  });
  it('a live-chat message id does not collide with a chat message id', () => {
    expect(badges.incrementChatForMessage('individual', 'same')).toBe(true);
    expect(badges.incrementLiveChatForMessage('same')).toBe(true);
  });
});

describe('other counters', () => {
  it('increment / set / markRead for announcements, crm, requests', () => {
    badges.increment('announcements');
    badges.increment('announcements', 2);
    badges.increment('crm', 4);
    badges.set('requests', 7);
    expect(badges.get()).toEqual({ chat: 0, announcements: 3, crm: 4, requests: 7, liveChat: 0 });
    badges.markRead('announcements', 1);
    badges.markRead('crm');
    badges.markRead('requests', 100);
    expect(badges.get()).toEqual({ chat: 0, announcements: 2, crm: 0, requests: 0, liveChat: 0 });
  });
  it('rejects negative / NaN amounts', () => {
    badges.increment('crm', -5);
    badges.increment('crm', Number.NaN);
    badges.set('requests', -3);
    badges.set('announcements', Number.NaN);
    badges.increment('liveChat', -1);
    expect(badges.get()).toEqual({ chat: 0, announcements: 0, crm: 0, requests: 0, liveChat: 0 });
  });
  it('floors fractional values', () => {
    badges.set('crm', 2.9);
    expect(badges.get().crm).toBe(2);
  });
  it('reset zeroes everything', () => {
    badges.increment('crm', 3);
    badges.setChatSection('group', 2);
    badges.increment('liveChat', 4);
    badges.reset();
    expect(badges.get()).toEqual({ chat: 0, announcements: 0, crm: 0, requests: 0, liveChat: 0 });
    expect(useBadgeStore.getState()).toMatchObject({ chatGroup: 0, chatIndividual: 0 });
  });
});
