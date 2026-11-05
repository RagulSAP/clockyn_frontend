import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GroupMember, GroupMessage, GroupSummary } from '@/types/api/groupChat';
import AdminGroupChatScreen from '../screens/AdminGroupChatScreen';
import { isoMinutesAgo, renderChat, signInAs } from '../testing/testHarness';

/**
 * A failed staff / members load must say so (with a retry) instead of showing a misleading "No staff found" /
 * "All staff are already members" / "No members found".
 */

const mockParams: { current: Record<string, string | undefined> } = { current: {} };

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
  useFocusEffect: jest.fn(),
}));
jest.mock('@/lib/realtime/socket', () => ({
  useChatSocket: jest.fn(),
  useGroupSocket: jest.fn(),
}));

const mockListGroups = jest.fn();
const mockGetMessages = jest.fn();
const mockGetMembers = jest.fn();
jest.mock('@/api/groupChat', () => ({
  ...jest.requireActual('@/api/groupChat'),
  listGroups: (...a: unknown[]) => mockListGroups(...a),
  getGroupMessages: (...a: unknown[]) => mockGetMessages(...a),
  getGroupMembers: (...a: unknown[]) => mockGetMembers(...a),
  markGroupRead: jest.fn(async () => undefined),
}));
const mockGetAllStaff = jest.fn();
jest.mock('@/api/home', () => ({ getAllStaff: (...a: unknown[]) => mockGetAllStaff(...a), getOrgAdmin: jest.fn(async () => null) }));
jest.mock('@/api/chat', () => ({ ...jest.requireActual('@/api/chat'), getChatList: jest.fn(async () => []) }));

// the first render of a file pays the module-loading cost, which can be slow when the whole suite runs in parallel
jest.setTimeout(30000);

const group: GroupSummary = {
  groupId: 'g1',
  name: 'Ops Team',
  createdBy: 'adm',
  memberCount: 3,
  lastMessage: 'Shift swap?',
  lastMessageSender: 'Rahul Nair',
  lastMessageAt: isoMinutesAgo(8),
  unreadCount: 0,
  raw: {},
};
const message: GroupMessage = {
  id: 'g-m1',
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
};
const member = (userId: string, name: string): GroupMember => ({ userId, name, empId: '', roleName: 'Staff', deptName: 'Ops', branchName: 'Pune', isAdmin: false });
const staffRow = (userId: string, name: string) => ({
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
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  signInAs(1);
  mockListGroups.mockResolvedValue([group]);
  mockGetMessages.mockResolvedValue([message]);
  mockGetMembers.mockResolvedValue([member('me', 'Me Myself'), member('u2', 'Rahul Nair')]);
  mockGetAllStaff.mockResolvedValue([staffRow('u3', 'Kiran Rao')]);
});

describe('group chat: failed loads are reported, not shown as empty lists', () => {
  it('Create Group: a failed staff load shows the error with a retry that recovers', async () => {
    mockParams.current = {};
    mockGetAllStaff.mockRejectedValueOnce(new Error('Staff service down'));
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Ops Team');
    await fireEvent.press(screen.getByTestId('create-group'));
    expect(await screen.findByText('Staff service down')).toBeTruthy();
    expect(screen.queryByText('No staff found')).toBeNull();

    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Kiran Rao')).toBeTruthy();
  });

  it('Add Staff: a failed staff load does not claim that everyone is already a member', async () => {
    mockParams.current = { groupId: 'g1' };
    mockGetAllStaff.mockRejectedValueOnce(new Error('Staff service down'));
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-add'));
    expect(await screen.findByText('Staff service down')).toBeTruthy();
    expect(screen.queryByText('All staff are already members')).toBeNull();
  });

  it('Members: a failed members load shows the error with a retry', async () => {
    mockParams.current = { groupId: 'g1' };
    mockGetMembers.mockRejectedValue(new Error('Members unavailable'));
    await renderChat(<AdminGroupChatScreen />);
    await screen.findByText('Shift swap?');
    await fireEvent.press(screen.getByLabelText('Ops Team details'));
    expect(await screen.findByText('Members unavailable')).toBeTruthy();
    expect(screen.queryByText('No members found')).toBeNull();

    mockGetMembers.mockResolvedValue([member('me', 'Me Myself'), member('u2', 'Rahul Nair')]);
    await fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.getByText('You')).toBeTruthy());
  });
});
