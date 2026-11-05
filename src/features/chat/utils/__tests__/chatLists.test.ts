import type { ChatContact, ChatMessage } from '@/types/api/chat';
import type { GroupMessage, GroupSummary } from '@/types/api/groupChat';
import type { StaffMember } from '@/types/api/staff';
import {
  applyIncomingToChatList,
  applyIncomingToGroupList,
  applySentToChatList,
  applySentToGroupList,
  chatContactFromAdmin,
  filterChatContacts,
  filterGroups,
  filterSearchResults,
  groupCandidates,
  mergeAdminFirst,
  searchStaffLocally,
  setGroupMemberCount,
  totalUnread,
  zeroChatUnread,
  zeroGroupUnread,
} from '../chatLists';

const contact = (over: Partial<ChatContact> & { userId: string }): ChatContact => ({
  name: over.userId,
  roleName: 'Staff',
  deptName: 'Sales',
  branchName: 'Pune',
  lastMessage: null,
  lastMessageType: null,
  lastMessageAt: null,
  unreadCount: 0,
  isOnline: false,
  photoUrl: null,
  raw: {},
  ...over,
});

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1',
  senderId: 'a',
  receiverId: 'me',
  text: 'hey',
  type: 'text',
  fileUrl: null,
  sentAt: '2026-10-18T05:00:00Z',
  isRead: false,
  isDelivered: true,
  raw: {},
  ...over,
});

const staff = (over: Partial<StaffMember> & { userId: string }): StaffMember => ({
  name: over.userId,
  empId: '',
  mobile: '',
  email: '',
  department: 'Ops',
  branch: 'Chennai',
  status: 'unknown',
  statusLabel: '',
  isActive: true,
  raw: {},
  ...over,
});

describe('direct list unread bookkeeping', () => {
  const list = [contact({ userId: 'a', unreadCount: 1 }), contact({ userId: 'b', unreadCount: 2 })];

  it('an incoming message from a conversation that is not open adds one unread and moves the row to the top', () => {
    const out = applyIncomingToChatList(list, msg({ senderId: 'b' }), 'me', 'a');
    expect(out.needsRefetch).toBe(false);
    expect(out.list.map((c) => [c.userId, c.unreadCount])).toEqual([
      ['b', 3],
      ['a', 1],
    ]);
    expect(out.list[0]).toMatchObject({ lastMessage: 'hey', lastMessageType: 'text' });
  });

  it('the open conversation is never counted and shows zero', () => {
    const out = applyIncomingToChatList(list, msg({ senderId: 'a' }), 'me', 'a');
    expect(out.list.find((c) => c.userId === 'a')?.unreadCount).toBe(0);
  });

  it('my own messages never add unread; an unknown partner asks for a refetch', () => {
    const own = applyIncomingToChatList(list, msg({ senderId: 'me', receiverId: 'b' }), 'me', null);
    expect(own.list.find((c) => c.userId === 'b')?.unreadCount).toBe(2);
    const unknown = applyIncomingToChatList(list, msg({ senderId: 'zed' }), 'me', null);
    expect(unknown.needsRefetch).toBe(true);
    expect(unknown.list).toHaveLength(2);
  });

  it('zeroChatUnread touches one row; totalUnread sums the rest (badge section value)', () => {
    const zeroed = zeroChatUnread(list, 'b');
    expect(totalUnread(zeroed)).toBe(1);
    expect(totalUnread(list)).toBe(3);
  });

  it('sending refreshes the preview and inserts a first conversation', () => {
    const out = applySentToChatList(list, contact({ userId: 'new', name: 'New One' }), { text: 'yo', type: 'text', at: '2026-10-18T05:00:00Z' });
    expect(out[0]).toMatchObject({ userId: 'new', lastMessage: 'yo', unreadCount: 0 });
    expect(out).toHaveLength(3);
    const existing = applySentToChatList(list, list[1], { text: 'again', type: 'image', at: 'x' });
    expect(existing[0]).toMatchObject({ userId: 'b', lastMessage: 'again', lastMessageType: 'image', unreadCount: 0 });
    expect(existing).toHaveLength(2);
  });
});

describe('conversation filtering', () => {
  const list = [
    contact({ userId: '1', name: 'Asha Verma', roleName: 'Admin', deptName: '', branchName: '' }),
    contact({ userId: '2', name: 'Rahul Nair', roleName: 'Staff', deptName: 'Sales', branchName: 'Pune' }),
    contact({ userId: '3', name: 'Meera', roleName: 'Manager', deptName: 'Ops', branchName: 'Chennai' }),
  ];

  it('matches name, role, department and (admin list) branch, case-insensitively', () => {
    expect(filterChatContacts(list, { query: 'rahul' }).map((c) => c.userId)).toEqual(['2']);
    expect(filterChatContacts(list, { query: 'OPS' }).map((c) => c.userId)).toEqual(['3']);
    expect(filterChatContacts(list, { query: 'chennai' }).map((c) => c.userId)).toEqual(['3']);
    expect(filterChatContacts(list, { query: 'chennai', matchBranch: false })).toEqual([]);
    expect(filterChatContacts(list, { query: '' })).toHaveLength(3);
  });

  it('managers / staff on the admin screens only see admin conversations and admin search results', () => {
    expect(filterChatContacts(list, { adminOnly: true }).map((c) => c.userId)).toEqual(['1']);
    const results = [
      { userId: '1', name: 'A', roleName: 'Admin', deptName: '', branchName: '', photoUrl: null },
      { userId: '2', name: 'B', roleName: 'Staff', deptName: '', branchName: '', photoUrl: null },
    ];
    expect(filterSearchResults(results, true).map((r) => r.userId)).toEqual(['1']);
    expect(filterSearchResults(results, false)).toHaveLength(2);
  });

  it('local staff search excludes me and inactive staff, labels roles, and honours the admin gate', () => {
    const pool = [
      staff({ userId: 'me', name: 'Me Myself', roleId: 3 }),
      staff({ userId: 'x1', name: 'Rita Rao', roleId: 2 }),
      staff({ userId: 'x2', name: 'Ria Off', roleId: 3, isActive: false }),
      staff({ userId: 'ad', name: 'Rina Admin', roleId: 1 }),
    ];
    const all = searchStaffLocally(pool, 'ri', { selfId: 'me' });
    expect(all.map((r) => [r.userId, r.roleName])).toEqual([
      ['x1', 'Manager'],
      ['ad', 'Admin'],
    ]);
    expect(searchStaffLocally(pool, 'ri', { selfId: 'me', adminOnly: true }).map((r) => r.userId)).toEqual(['ad']);
    expect(searchStaffLocally(pool, '   ', { selfId: 'me' })).toEqual([]);
  });
});

describe('admin pinned first (staff / manager list)', () => {
  const admin = chatContactFromAdmin(staff({ userId: 'ad', name: 'Boss', roleId: 1 }));

  it('synthesises the admin card when there is no conversation yet', () => {
    const out = mergeAdminFirst([contact({ userId: 'a' })], admin);
    expect(out.map((c) => c.userId)).toEqual(['ad', 'a']);
    expect(out[0]).toMatchObject({ roleName: 'Admin', name: 'Boss' });
  });

  it('moves an existing admin conversation to the top and leaves the list alone without an admin', () => {
    const list = [contact({ userId: 'a' }), contact({ userId: 'ad', unreadCount: 4, roleName: 'Admin' })];
    expect(mergeAdminFirst(list, admin).map((c) => c.userId)).toEqual(['ad', 'a']);
    expect(mergeAdminFirst(list, admin)[0].unreadCount).toBe(4);
    expect(mergeAdminFirst(list, null)).toEqual(list);
  });
});

describe('group list bookkeeping', () => {
  const g = (over: Partial<GroupSummary> & { groupId: string }): GroupSummary => ({
    name: over.groupId,
    createdBy: 'adm',
    memberCount: 3,
    lastMessage: null,
    lastMessageSender: null,
    lastMessageAt: null,
    unreadCount: 0,
    raw: {},
    ...over,
  });
  const gm = (over: Partial<GroupMessage>): GroupMessage => ({
    id: 'gm',
    groupId: 'g1',
    senderId: 'x',
    senderName: 'Xena',
    text: 'update',
    type: 'text',
    fileUrl: null,
    sentAt: '2026-10-18T05:00:00Z',
    isRead: true,
    readCount: 0,
    totalMembers: 0,
    raw: {},
    ...over,
  });
  const groups = [g({ groupId: 'g1', unreadCount: 1 }), g({ groupId: 'g2' })];

  it('a message for another group adds unread and updates the preview / sender', () => {
    const out = applyIncomingToGroupList(groups, gm({ groupId: 'g2' }), 'me', 'g1');
    expect(out.list[0]).toMatchObject({ groupId: 'g2', unreadCount: 1, lastMessage: 'update', lastMessageSender: 'Xena' });
  });

  it('the open group and my own messages do not add unread; an unknown group asks for a refetch', () => {
    expect(applyIncomingToGroupList(groups, gm({ groupId: 'g1' }), 'me', 'g1').list[0].unreadCount).toBe(0);
    expect(applyIncomingToGroupList(groups, gm({ groupId: 'g2', senderId: 'me' }), 'me', null).list[0]).toMatchObject({ unreadCount: 0, lastMessageSender: 'You' });
    expect(applyIncomingToGroupList(groups, gm({ groupId: 'nope' }), 'me', null).needsRefetch).toBe(true);
  });

  it('zeroing, sending, member count and filtering', () => {
    expect(totalUnread(zeroGroupUnread(groups, 'g1'))).toBe(0);
    expect(applySentToGroupList(groups, 'g2', 'hi', 'x')[0]).toMatchObject({ groupId: 'g2', lastMessageSender: 'You', lastMessage: 'hi' });
    expect(setGroupMemberCount(groups, 'g2', 9).find((x) => x.groupId === 'g2')?.memberCount).toBe(9);
    expect(filterGroups(groups, 'G2').map((x) => x.groupId)).toEqual(['g2']);
  });

  it('group candidates exclude me, members and inactive staff', () => {
    const pool = [staff({ userId: 'me' }), staff({ userId: 'm1' }), staff({ userId: 'n1', name: 'Nina' }), staff({ userId: 'n2', name: 'Off', isActive: false })];
    expect(groupCandidates(pool, { selfId: 'me', excludeIds: ['m1'] }).map((s) => s.userId)).toEqual(['n1']);
    expect(groupCandidates(pool, { selfId: 'me', query: 'nin' }).map((s) => s.userId)).toEqual(['n1']);
  });
});
