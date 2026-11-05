import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { badges } from '@/store/badges';
import type { GroupMember, GroupMessage, GroupSummary } from '@/types/api/groupChat';
import AdminGroupChatScreen from '../screens/AdminGroupChatScreen';
import StaffGroupChatScreen from '../screens/StaffGroupChatScreen';
import { isoMinutesAgo, renderChat, signInAs } from '../testing/testHarness';

const mockParams: { current: Record<string, string | undefined> } = { current: {} };
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockSockets: { chat?: (frame: unknown) => void; group?: (frame: unknown) => void } = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true, dismissAll: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
  useFocusEffect: jest.fn(),
}));
jest.mock('@/lib/realtime/socket', () => ({
  useChatSocket: (_userId: unknown, fn: (frame: unknown) => void) => {
    mockSockets.chat = fn;
  },
  useGroupSocket: (_groupId: unknown, _userId: unknown, fn: (frame: unknown) => void) => {
    mockSockets.group = fn;
  },
}));

const mockListGroups = jest.fn();
const mockGetMessages = jest.fn();
const mockGetMembers = jest.fn();
const mockMarkRead = jest.fn();
const mockSend = jest.fn();
const mockCreate = jest.fn();
const mockAddMembers = jest.fn();
jest.mock('@/api/groupChat', () => ({
  ...jest.requireActual('@/api/groupChat'),
  listGroups: (...a: unknown[]) => mockListGroups(...a),
  getGroupMessages: (...a: unknown[]) => mockGetMessages(...a),
  getGroupMembers: (...a: unknown[]) => mockGetMembers(...a),
  markGroupRead: (...a: unknown[]) => mockMarkRead(...a),
  sendGroupMessage: (...a: unknown[]) => mockSend(...a),
  createGroup: (...a: unknown[]) => mockCreate(...a),
  addGroupMembers: (...a: unknown[]) => mockAddMembers(...a),
}));
const mockGetAllStaff = jest.fn();
jest.mock('@/api/home', () => ({ getAllStaff: (...a: unknown[]) => mockGetAllStaff(...a), getOrgAdmin: jest.fn(async () => null) }));
jest.mock('@/api/chat', () => ({ ...jest.requireActual('@/api/chat'), getChatList: jest.fn(async () => []) }));

const group = (over: Partial<GroupSummary> & { groupId: string; name: string }): GroupSummary => ({
  createdBy: 'adm',
  memberCount: 3,
  lastMessage: null,
  lastMessageSender: null,
  lastMessageAt: null,
  unreadCount: 0,
  raw: {},
  ...over,
});

const gmsg = (over: Partial<GroupMessage> & { id: string }): GroupMessage => ({
  groupId: 'g1',
  senderId: 'u2',
  senderName: 'Rahul Nair',
  text: 'Shift swap?',
  type: 'text',
  fileUrl: null,
  sentAt: isoMinutesAgo(8),
  isRead: true,
  readCount: 0,
  totalMembers: 0,
  raw: {},
  ...over,
});

const member = (over: Partial<GroupMember> & { userId: string; name: string }): GroupMember => ({
  empId: '',
  roleName: 'Staff',
  deptName: 'Ops',
  branchName: 'Pune',
  isAdmin: false,
  ...over,
});

const staffRow = (userId: string, name: string, extra: Record<string, unknown> = {}) => ({
  userId,
  name,
  empId: '',
  mobile: '',
  email: '',
  department: 'Sales',
  branch: 'Pune',
  status: 'unknown',
  statusLabel: '',
  isActive: true,
  roleId: 3,
  raw: {},
  ...extra,
});

const groupFrame = (m: GroupMessage) =>
  ({
    type: 'new_group_message',
    data: { message_id: m.id, group_id: m.groupId, sender_id: m.senderId, sender_name: m.senderName, message: m.text, message_type: 'text', timestamp: m.sentAt },
  }) as const;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockParams.current = {};
  mockSockets.chat = undefined;
  mockSockets.group = undefined;
  mockListGroups.mockResolvedValue([
    group({ groupId: 'g1', name: 'Ops Team', lastMessage: 'Shift swap?', lastMessageSender: 'Rahul Nair', lastMessageAt: isoMinutesAgo(8), unreadCount: 2, memberCount: 3 }),
    group({ groupId: 'g2', name: 'Pune Branch', memberCount: 12 }),
  ]);
  mockGetMessages.mockResolvedValue([
    gmsg({ id: 'g-m1' }),
    gmsg({ id: 'g-m2', senderId: 'me', senderName: 'Me', text: 'Sure, noted', readCount: 1, totalMembers: 2 }),
  ]);
  mockGetMembers.mockResolvedValue([member({ userId: 'adm', name: 'Boss', isAdmin: true, roleName: 'Admin' }), member({ userId: 'me', name: 'Me Myself' }), member({ userId: 'u2', name: 'Rahul Nair' })]);
  mockMarkRead.mockResolvedValue(undefined);
  mockGetAllStaff.mockResolvedValue([staffRow('u2', 'Rahul Nair'), staffRow('u3', 'Kiran Rao'), staffRow('u4', 'Meera Shah')]);
});

describe('admin group list', () => {
  beforeEach(() => signInAs(1));

  it('lists groups with sender-prefixed preview, member count and unread, and syncs the group badge (org_id sent)', async () => {
    await renderChat(<AdminGroupChatScreen />);
    expect(await screen.findByText('Ops Team')).toBeTruthy();
    expect(screen.getByText('Rahul Nair: Shift swap?')).toBeTruthy();
    expect(screen.getByText('3 members')).toBeTruthy();
    expect(screen.getByText('Tap to start chatting')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(mockListGroups).toHaveBeenCalledWith('me', 'org1');
    await waitFor(() => expect(badges.get().chat).toBe(2));
  });

  it('filters by name and shows the empty state with Create Group', async () => {
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Ops Team');
    await fireEvent.changeText(screen.getByTestId('group-search'), 'pune');
    await waitFor(() => expect(screen.queryByText('Ops Team')).toBeNull());
    expect(screen.getByText('Pune Branch')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('group-search'), 'zzz');
    expect(await screen.findByText('No groups yet')).toBeTruthy();
    expect(screen.getByText('Create a group to chat with your team')).toBeTruthy();
    expect(screen.getByText('Create Group')).toBeTruthy();
  });

  it('opens a group with its id as the route param', async () => {
    await renderChat(<AdminGroupChatScreen />);
    await fireEvent.press(await screen.findByTestId('group-row-g1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/admin/chat/groups', params: { groupId: 'g1' } });
  });

  it('creates a group: needs a name and a member, creator is added by the API, toast and list refresh', async () => {
    mockCreate.mockResolvedValue(group({ groupId: 'g9', name: 'Night Crew' }));
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Ops Team');
    await fireEvent.press(screen.getByTestId('create-group'));
    expect(await screen.findByText('Kiran Rao')).toBeTruthy();
    expect(screen.getByTestId('create-group-submit').props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.changeText(screen.getByPlaceholderText('Group name'), '  Night Crew ');
    await fireEvent.press(screen.getByTestId('staff-pick-u3'));
    await fireEvent.press(screen.getByTestId('staff-pick-u4'));
    expect(await screen.findByText('2 members selected')).toBeTruthy();
    await fireEvent.press(screen.getByText('Create'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ name: '  Night Crew ', createdBy: 'me', memberIds: ['u3', 'u4'], orgId: 'org1' });
    expect(await screen.findByText('Group created!')).toBeTruthy();
    await waitFor(() => expect(mockListGroups.mock.calls.length).toBeGreaterThan(1));
  });

  it('a failed create keeps the sheet open and shows the error', async () => {
    mockCreate.mockRejectedValue(new Error('Plan limit reached'));
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Ops Team');
    await fireEvent.press(screen.getByTestId('create-group'));
    await screen.findByText('Kiran Rao');
    await fireEvent.changeText(screen.getByPlaceholderText('Group name'), 'X');
    await fireEvent.press(screen.getByTestId('staff-pick-u3'));
    await fireEvent.press(screen.getByText('Create'));
    expect(await screen.findByText('Plan limit reached')).toBeTruthy();
    expect(screen.getByPlaceholderText('Group name')).toBeTruthy();
  });
});

describe('admin group conversation', () => {
  beforeEach(() => {
    signInAs(1);
    mockParams.current = { groupId: 'g1' };
  });

  it('shows history with sender names, a Today separator, the member count and marks the group read', async () => {
    await renderChat(<AdminGroupChatScreen />);
    expect(await screen.findByText('Shift swap?')).toBeTruthy();
    expect(screen.getByText('Sure, noted')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getAllByText('Rahul Nair').length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('3 members')).toBeTruthy();
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('g1', 'me'));
    // my message: one of two other members read it -> not all read
    expect(screen.getByLabelText('Sent')).toBeTruthy();
  });

  it('only appends messages of THIS group; other groups never leak in; the open group is marked read once per message', async () => {
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await act(async () => mockSockets.group?.(groupFrame(gmsg({ id: 'x1', groupId: 'g2', text: 'Other group chatter' }))));
    expect(screen.queryByText('Other group chatter')).toBeNull();
    mockMarkRead.mockClear();
    await act(async () => mockSockets.group?.(groupFrame(gmsg({ id: 'x2', text: 'Fresh in g1' }))));
    expect(await screen.findByText('Fresh in g1')).toBeTruthy();
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('g1', 'me'));
    mockMarkRead.mockClear();
    await act(async () => mockSockets.group?.(groupFrame(gmsg({ id: 'x2', text: 'Fresh in g1' }))));
    expect(screen.getAllByText('Fresh in g1')).toHaveLength(1);
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('read receipts: all members read -> read tick; another group or a 1:1 receipt is ignored', async () => {
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Sure, noted');
    await act(async () => mockSockets.group?.({ type: 'read_update', data: { reader_id: 'u2', group_id: 'g2', message_id: 'g-m2', read_count: 2, total_members: 2 } }));
    expect(screen.queryByLabelText('Read')).toBeNull();
    await act(async () => mockSockets.group?.({ type: 'read_update', data: { reader_id: 'u2', sender_id: 'me' } }));
    expect(screen.queryByLabelText('Read')).toBeNull();
    await act(async () => mockSockets.group?.({ type: 'read_update', data: { reader_id: 'u2', group_id: 'g1', message_id: 'g-m2', read_count: 2, total_members: 2 } }));
    expect(await screen.findByLabelText('Read')).toBeTruthy();
  });

  it('sends optimistically with the group API and a failed send can be retried', async () => {
    mockSend.mockRejectedValueOnce(new Error('Not a member'));
    mockSend.mockResolvedValueOnce(gmsg({ id: 'srv', senderId: 'me', senderName: 'Me', text: 'On it' }));
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'On it');
    await fireEvent.press(screen.getByLabelText('Send message'));
    expect(await screen.findByText('Failed to send')).toBeTruthy();
    expect(mockSend).toHaveBeenCalledWith('g1', 'me', 'On it');
    expect(await screen.findByText('Not a member')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(screen.queryByText('Failed to send')).toBeNull());
    expect(screen.getAllByText('On it')).toHaveLength(1);
  });

  it('members sheet shows You, the Admin tag and department / branch', async () => {
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.press(screen.getByLabelText('Ops Team details'));
    expect(await screen.findByText('You')).toBeTruthy();
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pune').length).toBeGreaterThanOrEqual(1);
  });

  it('adds staff who are not members yet and shows the toast inside the conversation', async () => {
    mockAddMembers.mockResolvedValue(undefined);
    mockGetMembers.mockResolvedValueOnce([member({ userId: 'me', name: 'Me' }), member({ userId: 'u2', name: 'Rahul Nair' })]);
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-add'));
    expect(await screen.findByText('Kiran Rao')).toBeTruthy();
    expect(screen.queryByTestId('staff-pick-u2')).toBeNull(); // already a member
    await fireEvent.press(screen.getByTestId('staff-pick-u3'));
    await fireEvent.press(screen.getByTestId('staff-pick-u4'));
    await fireEvent.press(screen.getByText('Add 2 Staff'));
    await waitFor(() => expect(mockAddMembers).toHaveBeenCalledWith('g1', ['u3', 'u4']));
    expect(await screen.findByText('2 staff added!')).toBeTruthy();
  });

  it('a failed add shows an error and keeps the sheet open', async () => {
    mockAddMembers.mockRejectedValue(new Error('Server says no'));
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-add'));
    await fireEvent.press(await screen.findByTestId('staff-pick-u3'));
    await fireEvent.press(screen.getByText('Add 1 Staff'));
    expect(await screen.findByText('Server says no')).toBeTruthy();
    expect(screen.getByText('Add 1 Staff')).toBeTruthy();
  });

  it('remembers the chosen colour theme per group on this device', async () => {
    const first = await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-theme'));
    await fireEvent.press(await screen.findByTestId('chat-theme-2'));
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('@clockyn/group-themes:me')) ?? '{}')).toEqual({ g1: 2 }));
    await first.unmount();

    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-theme'));
    const tile = await screen.findByTestId('chat-theme-2');
    await waitFor(() => expect(tile.props.accessibilityState).toMatchObject({ selected: true }));
  });

  it('in-chat search filters the messages of the group', async () => {
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-search'));
    await fireEvent.changeText(await screen.findByPlaceholderText('Search messages...'), 'noted');
    await waitFor(() => expect(screen.queryByText('Shift swap?')).toBeNull());
    expect(screen.getByText('Sure, noted')).toBeTruthy();
  });
});

describe('staff / manager group chat', () => {
  beforeEach(() => signInAs(3));

  it('lists only the groups returned for the user; the empty state explains groups are added by the admin (no create)', async () => {
    mockListGroups.mockResolvedValueOnce([]);
    const first = await renderChat(<StaffGroupChatScreen />);
    expect(await screen.findByText("You'll see groups here when added by admin")).toBeTruthy();
    expect(screen.queryByText('Create Group')).toBeNull();
    expect(screen.queryByTestId('create-group')).toBeNull();
    await first.unmount();

    await renderChat(<StaffGroupChatScreen />);
    await fireEvent.press(await screen.findByTestId('group-row-g1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/staff/chat/groups', params: { groupId: 'g1' } });
  });

  it('the conversation has View Members and Add Staff only, and "Tap to view" in the header', async () => {
    mockParams.current = { groupId: 'g1' };
    await renderChat(<StaffGroupChatScreen />);
    await screen.findByText('Shift swap?');
    expect(await screen.findByText('3 members · Tap to view')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('chat-menu'));
    expect(await screen.findByTestId('chat-action-members')).toBeTruthy();
    expect(screen.getByTestId('chat-action-add')).toBeTruthy();
    expect(screen.queryByTestId('chat-action-theme')).toBeNull();
    expect(screen.queryByTestId('chat-action-search')).toBeNull();
    await fireEvent.press(screen.getByTestId('chat-action-members'));
    expect((await screen.findAllByText('Admin')).length).toBeGreaterThanOrEqual(1);
  });
});
