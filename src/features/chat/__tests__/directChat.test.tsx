import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { badges } from '@/store/badges';
import type { ChatContact, ChatMessage, ChatSearchResult } from '@/types/api/chat';
import AdminDirectChatScreen from '../screens/AdminDirectChatScreen';
import StaffDirectChatScreen from '../screens/StaffDirectChatScreen';
import { isoMinutesAgo, renderChat, signInAs } from '../testing/testHarness';

const mockParams: { current: Record<string, string | undefined> } = { current: {} };
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockSockets: { chat?: (frame: unknown) => void } = {};

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
  useGroupSocket: jest.fn(),
}));

const mockGetChatList = jest.fn();
const mockGetMessages = jest.fn();
const mockSearch = jest.fn();
const mockMarkRead = jest.fn();
const mockSend = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/chat', () => ({
  ...jest.requireActual('@/api/chat'),
  getChatList: (...a: unknown[]) => mockGetChatList(...a),
  getChatMessages: (...a: unknown[]) => mockGetMessages(...a),
  searchChatStaff: (...a: unknown[]) => mockSearch(...a),
  markChatRead: (...a: unknown[]) => mockMarkRead(...a),
  sendChatMessage: (...a: unknown[]) => mockSend(...a),
  deleteConversation: (...a: unknown[]) => mockDelete(...a),
}));
const mockGetAllStaff = jest.fn();
const mockGetOrgAdmin = jest.fn();
jest.mock('@/api/home', () => ({
  getAllStaff: (...a: unknown[]) => mockGetAllStaff(...a),
  getOrgAdmin: (...a: unknown[]) => mockGetOrgAdmin(...a),
}));
const mockPhoto = jest.fn();
jest.mock('@/api/auth', () => ({ getProfilePhotoUrl: (...a: unknown[]) => mockPhoto(...a) }));
const mockPickImage = jest.fn();
jest.mock('@/lib/platform/media', () => ({
  ...jest.requireActual('@/lib/platform/media'),
  pickImage: (...a: unknown[]) => mockPickImage(...a),
  pickDocument: jest.fn(async () => null),
}));

const contact = (over: Partial<ChatContact> & { userId: string; name: string }): ChatContact => ({
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

const message = (over: Partial<ChatMessage> & { id: string }): ChatMessage => ({
  senderId: 'u1',
  receiverId: 'me',
  text: 'hello',
  type: 'text',
  fileUrl: null,
  sentAt: isoMinutesAgo(5),
  isRead: false,
  isDelivered: true,
  raw: {},
  ...over,
});

const frame = (data: ChatMessage) =>
  ({
    type: 'new_message',
    data: { message_id: data.id, sender_id: data.senderId, receiver_id: data.receiverId, message: data.text, message_type: 'text', timestamp: data.sentAt },
  }) as const;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
  mockSockets.chat = undefined;
  mockGetChatList.mockResolvedValue([
    contact({ userId: 'u1', name: 'Asha Verma', lastMessage: 'See you', lastMessageType: 'text', lastMessageAt: isoMinutesAgo(10), unreadCount: 3 }),
    contact({ userId: 'u2', name: 'Rahul Nair', roleName: 'Manager', lastMessage: 'photo.png', lastMessageType: 'image', lastMessageAt: isoMinutesAgo(120) }),
  ]);
  mockGetMessages.mockResolvedValue([message({ id: 'm1', text: 'Good morning' }), message({ id: 'm2', senderId: 'me', receiverId: 'u1', text: 'Hi Asha', isRead: false })]);
  mockSearch.mockResolvedValue([]);
  mockMarkRead.mockResolvedValue(undefined);
  mockGetAllStaff.mockResolvedValue([]);
  mockGetOrgAdmin.mockResolvedValue(null);
  mockPhoto.mockResolvedValue(null);
});

describe('admin individual chat list', () => {
  beforeEach(() => signInAs(1));

  it('lists conversations with preview, relative time and unread count, and syncs the chat badge', async () => {
    await renderChat(<AdminDirectChatScreen />);
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
    expect(screen.getByText('See you')).toBeTruthy();
    expect(screen.getByText('10m ago')).toBeTruthy();
    expect(screen.getByText('Photo')).toBeTruthy();
    expect(screen.getByText('2h ago')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    await waitFor(() => expect(badges.get().chat).toBe(3));
    expect(mockGetChatList).toHaveBeenCalledWith('me', 'org1');
  });

  it('filters the list locally and shows the empty states', async () => {
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Asha Verma');
    await fireEvent.changeText(screen.getByTestId('chat-search'), 'rahul');
    await waitFor(() => expect(screen.queryByText('Asha Verma')).toBeNull());
    expect(screen.getByText('Rahul Nair')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('chat-search'), 'zzzz');
    expect(await screen.findByText('No matching chats')).toBeTruthy();
    expect(screen.getByText('Search for a staff member to start chatting')).toBeTruthy();
  });

  it('shows "No chats yet" and an error state with retry', async () => {
    mockGetChatList.mockResolvedValueOnce([]);
    const first = await renderChat(<AdminDirectChatScreen />);
    expect(await screen.findByText('No chats yet')).toBeTruthy();
    await first.unmount();

    mockGetChatList.mockRejectedValueOnce(new Error('Your plan has expired'));
    await renderChat(<AdminDirectChatScreen />);
    expect(await screen.findByText('Your plan has expired')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
  });

  it('searches staff on the backend (debounced), tags people without a chat as New and opens the conversation', async () => {
    const results: ChatSearchResult[] = [
      { userId: 'u1', name: 'Asha Verma', roleName: 'Staff', deptName: 'Sales', branchName: 'Pune', photoUrl: null },
      { userId: 'u9', name: 'Neha Iyer', roleName: 'Manager', deptName: 'Ops', branchName: 'Goa', photoUrl: null },
    ];
    mockSearch.mockResolvedValue(results);
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Asha Verma');
    await fireEvent.changeText(screen.getByTestId('chat-search'), 'neha');
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('me', 'neha'));
    const row = await screen.findByTestId('search-result-u9');
    expect(screen.getByText('Manager · Ops · Goa')).toBeTruthy();
    expect(screen.getAllByText('New')).toHaveLength(1);
    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/admin/chat/direct', params: { userId: 'u9' } });
  });

  it('opening a conversation from the list pushes the route with the user id', async () => {
    await renderChat(<AdminDirectChatScreen />);
    await fireEvent.press(await screen.findByTestId('chat-row-u1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/admin/chat/direct', params: { userId: 'u1' } });
  });

  it('a manager on the admin screens only sees admin conversations', async () => {
    signInAs(2);
    mockGetChatList.mockResolvedValue([
      contact({ userId: 'ad', name: 'The Admin', roleName: 'Admin' }),
      contact({ userId: 'u2', name: 'Rahul Nair' }),
    ]);
    await renderChat(<AdminDirectChatScreen />);
    expect(await screen.findByText('The Admin')).toBeTruthy();
    expect(screen.queryByText('Rahul Nair')).toBeNull();
  });
});

describe('admin individual conversation', () => {
  beforeEach(() => {
    signInAs(1);
    mockParams.current = { userId: 'u1' };
  });

  it('loads history oldest first with a Today separator, zeroes the unread badge and marks the conversation read', async () => {
    badges.setChatSection('individual', 3);
    await renderChat(<AdminDirectChatScreen />);
    expect(await screen.findByText('Good morning')).toBeTruthy();
    expect(screen.getByText('Hi Asha')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Asha Verma')).toBeTruthy();
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('u1', 'me'));
    await waitFor(() => expect(badges.get().chat).toBeLessThanOrEqual(3));
    // the list row has no photo, so the profile photo endpoint is asked (admin screen)
    await waitFor(() => expect(mockPhoto).toHaveBeenCalledWith('u1'));
  });

  it('sends optimistically, then shows the server message exactly once', async () => {
    let resolveSend: (m: ChatMessage) => void = () => undefined;
    mockSend.mockImplementation(() => new Promise<ChatMessage>((r) => { resolveSend = r; }));
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Good morning');
    await fireEvent.changeText(screen.getByTestId('chat-input'), '  On my way  ');
    await fireEvent.press(screen.getByLabelText('Send message'));
    expect(await screen.findByText('On my way')).toBeTruthy();
    expect(screen.getByLabelText('Sending')).toBeTruthy();
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ senderId: 'me', receiverId: 'u1', message: 'On my way' }));
    expect(screen.getByTestId('chat-input').props.value).toBe('');
    await act(async () => resolveSend(message({ id: 'srv1', senderId: 'me', receiverId: 'u1', text: 'On my way' })));
    await waitFor(() => expect(screen.queryByLabelText('Sending')).toBeNull());
    expect(screen.getAllByText('On my way')).toHaveLength(1);
    // the socket echo of the same message adds nothing
    await act(async () => mockSockets.chat?.(frame(message({ id: 'srv1', senderId: 'me', receiverId: 'u1', text: 'On my way' }))));
    expect(screen.getAllByText('On my way')).toHaveLength(1);
  });

  it('a failed send shows a failed marker with Retry, a toast, and retrying succeeds', async () => {
    mockSend.mockRejectedValueOnce(new Error('Server says no'));
    mockSend.mockResolvedValueOnce(message({ id: 'srv2', senderId: 'me', receiverId: 'u1', text: 'Try again please' }));
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Good morning');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Try again please');
    await fireEvent.press(screen.getByLabelText('Send message'));
    expect(await screen.findByText('Failed to send')).toBeTruthy();
    expect(await screen.findByText('Server says no')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(screen.queryByText('Failed to send')).toBeNull());
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('Try again please')).toHaveLength(1);
  });

  it('only appends incoming messages of THIS conversation (v1 appended every message)', async () => {
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Good morning');
    await act(async () => mockSockets.chat?.(frame(message({ id: 'x1', senderId: 'u2', receiverId: 'me', text: 'For another chat' }))));
    expect(screen.queryByText('For another chat')).toBeNull();
    mockMarkRead.mockClear();
    await act(async () => mockSockets.chat?.(frame(message({ id: 'x2', senderId: 'u1', receiverId: 'me', text: 'Right here' }))));
    expect(await screen.findByText('Right here')).toBeTruthy();
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('u1', 'me'));
    // a repeated delivery is neither duplicated nor marked read twice
    mockMarkRead.mockClear();
    await act(async () => mockSockets.chat?.(frame(message({ id: 'x2', senderId: 'u1', receiverId: 'me', text: 'Right here' }))));
    expect(screen.getAllByText('Right here')).toHaveLength(1);
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('read receipts only mark my messages when the open peer is the reader', async () => {
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Hi Asha');
    expect(screen.getAllByLabelText('Sent')).toHaveLength(1);
    await act(async () => mockSockets.chat?.({ type: 'read_update', data: { reader_id: 'u2', sender_id: 'me' } }));
    expect(screen.queryByLabelText('Read')).toBeNull();
    await act(async () => mockSockets.chat?.({ type: 'read_update', data: { reader_id: 'u1', sender_id: 'me' } }));
    expect(await screen.findByLabelText('Read')).toBeTruthy();
  });

  it('a refused camera permission is reported instead of being swallowed', async () => {
    const { MediaPermissionError } = jest.requireActual('@/lib/platform/media');
    mockPickImage.mockRejectedValueOnce(new MediaPermissionError('camera'));
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Good morning');
    await fireEvent.press(screen.getByLabelText('Take a photo'));
    expect(await screen.findByText('Camera permission is required.')).toBeTruthy();
  });

  it('in-chat search filters messages; delete chat asks for confirmation and calls the API', async () => {
    mockDelete.mockResolvedValue(undefined);
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Good morning');
    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-search'));
    await fireEvent.changeText(await screen.findByPlaceholderText('Search in chat...'), 'morning');
    await waitFor(() => expect(screen.queryByText('Hi Asha')).toBeNull());
    expect(screen.getByText('Good morning')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-delete'));
    expect(await screen.findByText(/Are you sure you want to delete this chat with Asha Verma/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('me', 'u1'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows the contact details with "-" for missing values', async () => {
    mockGetAllStaff.mockResolvedValue([
      { userId: 'u1', name: 'Asha Verma', empId: 'E-17', mobile: '9876543210', email: '', department: 'Sales', branch: 'Pune', status: 'unknown', statusLabel: '', isActive: true, roleId: 2, raw: {} },
    ]);
    await renderChat(<AdminDirectChatScreen />);
    await screen.findByText('Good morning');
    await fireEvent.press(screen.getByTestId('chat-menu'));
    await fireEvent.press(await screen.findByTestId('chat-action-contact'));
    expect(await screen.findByText('E-17')).toBeTruthy();
    expect(screen.getByText('9876543210')).toBeTruthy();
    expect(screen.getByText('Manager')).toBeTruthy();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
  });
});

describe('staff / manager individual chat', () => {
  beforeEach(() => signInAs(3));

  it('pins the admin conversation first even when it has no messages', async () => {
    mockGetOrgAdmin.mockResolvedValue({ userId: 'ad', name: 'The Admin', empId: '', mobile: '', email: '', department: '', branch: '', status: 'unknown', statusLabel: '', isActive: true, roleId: 1, raw: {} });
    await renderChat(<StaffDirectChatScreen />);
    expect(await screen.findByText('The Admin')).toBeTruthy();
    const rows = screen.getAllByTestId(/^chat-row-/);
    expect(rows[0].props.testID).toBe('chat-row-ad');
    await fireEvent.press(rows[0]);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/staff/chat/direct', params: { userId: 'ad' } });
  });

  it('searches the staff directory locally (any colleague, not only the admin)', async () => {
    mockGetAllStaff.mockResolvedValue([
      { userId: 'u7', name: 'Kiran Rao', empId: '', mobile: '', email: '', department: 'Ops', branch: 'Chennai', status: 'unknown', statusLabel: '', isActive: true, roleId: 3, raw: {} },
    ]);
    await renderChat(<StaffDirectChatScreen />);
    await screen.findByText('Asha Verma');
    await fireEvent.changeText(screen.getByTestId('chat-search'), 'kiran');
    expect(await screen.findByTestId('search-result-u7')).toBeTruthy();
    expect(screen.getByText('Staff · Ops · Chennai')).toBeTruthy();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('a notification tap (userId param) opens the admin conversation even before any chat exists, named from the org admin', async () => {
    mockParams.current = { userId: 'ad' };
    mockGetMessages.mockResolvedValue([message({ id: 'a1', senderId: 'ad', receiverId: 'me', text: 'Welcome aboard' })]);
    mockGetOrgAdmin.mockResolvedValue({ userId: 'ad', name: 'The Admin', empId: '', mobile: '', email: '', department: '', branch: '', status: 'unknown', statusLabel: '', isActive: true, roleId: 1, raw: {} });
    await renderChat(<StaffDirectChatScreen />);
    expect(await screen.findByText('Welcome aboard')).toBeTruthy();
    expect(await screen.findByText('The Admin')).toBeTruthy();
    expect(mockGetMessages).toHaveBeenCalledWith('me', 'ad');
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('ad', 'me'));
  });

  it('the conversation has no menu (back only) and sends like the admin one', async () => {
    mockParams.current = { userId: 'u1' };
    mockSend.mockResolvedValue(message({ id: 'srv3', senderId: 'me', receiverId: 'u1', text: 'Noted' }));
    await renderChat(<StaffDirectChatScreen />);
    await screen.findByText('Good morning');
    expect(screen.queryByTestId('chat-menu')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Noted');
    await fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    await fireEvent.press(screen.getByLabelText('Back to conversations'));
    expect(mockBack).toHaveBeenCalled();
  });
});
