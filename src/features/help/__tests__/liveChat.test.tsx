import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { LiveChatHistory, LiveChatMessage } from '@/types/api/liveChat';
import { liveChatSession } from '@/lib/realtime/liveChatSession';
import { badges, resetBadges } from '@/store/badges';

import { renderScreen, signInTestAdmin } from '../../settings/__tests__/testHelpers';
import LiveChatScreen from '../screens/LiveChatScreen';

const mockRedirect = jest.fn();
const mockFocus = { value: true, listeners: new Set<() => void>() };
const setScreenFocus = async (value: boolean) => {
  mockFocus.value = value;
  await act(async () => mockFocus.listeners.forEach((l) => l()));
};
const mockSockets: { chat?: (frame: unknown) => void; onReconnect?: () => void } = {};

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const R = require('react');
    const [focused, setFocused] = R.useState(mockFocus.value);
    R.useEffect(() => {
      const l = () => setFocused(mockFocus.value);
      mockFocus.listeners.add(l);
      return () => mockFocus.listeners.delete(l);
    }, []);
    R.useEffect(() => (focused ? cb() : undefined), [focused, cb]);
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/realtime/socket', () => ({
  useChatSocket: (_userId: unknown, fn: (frame: unknown) => void, opts?: { onReconnect?: () => void }) => {
    mockSockets.chat = fn;
    mockSockets.onReconnect = opts?.onReconnect;
  },
  useGroupSocket: jest.fn(),
}));

const mockGetMessages = jest.fn();
const mockSend = jest.fn();
const mockSendFile = jest.fn();
const mockMarkRead = jest.fn();
jest.mock('@/api', () => ({
  ...jest.requireActual('@/api'),
  liveChatApi: {
    getMessages: (...a: unknown[]) => mockGetMessages(...a),
    send: (...a: unknown[]) => mockSend(...a),
    sendFile: (...a: unknown[]) => mockSendFile(...a),
    markRead: (...a: unknown[]) => mockMarkRead(...a),
    getUnread: jest.fn(),
  },
}));
const mockPickImage = jest.fn();
jest.mock('@/lib/platform/media', () => ({
  ...jest.requireActual('@/lib/platform/media'),
  pickImage: (...a: unknown[]) => mockPickImage(...a),
  pickDocument: jest.fn(async () => null),
}));

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

const live = (over: Partial<LiveChatMessage> & { id: string }): LiveChatMessage => ({
  senderType: 'support',
  senderId: 'agent@clockyn.test',
  senderName: 'Priya',
  text: 'hello',
  type: 'text',
  fileUrl: null,
  fileName: null,
  contentType: null,
  sentAt: iso(5),
  isRead: false,
  isDelivered: true,
  raw: {},
  ...over,
});

const history = (messages: LiveChatMessage[], status: LiveChatHistory['status'] = 'open'): LiveChatHistory => ({ status, unread: 0, messages });

const messageFrame = (m: LiveChatMessage, orgId = 'org-1') => ({
  type: 'live_chat_message',
  data: {
    org_id: orgId,
    message_id: m.id,
    timestamp: m.sentAt,
    message_type: m.type,
    message: m.text,
    file_url: m.fileUrl,
    sender_type: m.senderType,
    sender_id: m.senderId,
    sender_name: m.senderName,
    is_read: m.isRead,
    is_delivered: true,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSockets.chat = undefined;
  mockSockets.onReconnect = undefined;
  liveChatSession.setOpen(false);
  mockFocus.value = true;
  resetBadges();
  signInTestAdmin();
  mockGetMessages.mockResolvedValue(history([live({ id: 'm1', text: 'Hi, how can we help?' })]));
  mockMarkRead.mockResolvedValue(undefined);
});

describe('LiveChatScreen', () => {
  it('shows the history with the agent name above support messages', async () => {
    mockGetMessages.mockResolvedValue(
      history([live({ id: 'm1', text: 'Hi, how can we help?', senderName: 'Priya' }), live({ id: 'm2', senderType: 'org', senderId: 'user-1', senderName: 'Owner', text: 'Payroll question' })]),
    );
    await renderScreen(<LiveChatScreen />);
    expect(await screen.findByText('Hi, how can we help?')).toBeTruthy();
    expect(screen.getByText('Priya')).toBeTruthy();
    expect(screen.getByText('Payroll question')).toBeTruthy();
    expect(mockGetMessages).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('shows the empty state when nothing was written yet', async () => {
    mockGetMessages.mockResolvedValue(history([], null));
    await renderScreen(<LiveChatScreen />);
    expect(await screen.findByText('Start a conversation')).toBeTruthy();
    expect(screen.getByText('Our support team will reply here.')).toBeTruthy();
  });

  it('marks the conversation open and read: clears the Support badge and tells the server', async () => {
    badges.set('liveChat', 3);
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    expect(liveChatSession.isOpen()).toBe(true);
    expect(badges.get().liveChat).toBe(0);
    expect(mockMarkRead).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('is no longer "open" once left', async () => {
    const view = await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    await view.unmount();
    expect(liveChatSession.isOpen()).toBe(false);
  });

  it('sends optimistically and shows the server message exactly once (the socket echo adds nothing)', async () => {
    let resolveSend: (m: LiveChatMessage) => void = () => undefined;
    mockSend.mockImplementation(() => new Promise<LiveChatMessage>((r) => { resolveSend = r; }));
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    await fireEvent.changeText(screen.getByTestId('chat-input'), '  Need a hand  ');
    await fireEvent.press(screen.getByLabelText('Send message'));
    expect(await screen.findByText('Need a hand')).toBeTruthy();
    expect(screen.getByLabelText('Sending')).toBeTruthy();
    expect(mockSend).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1', message: 'Need a hand' });
    const sent = live({ id: 'srv1', senderType: 'org', senderId: 'user-1', senderName: 'Owner', text: 'Need a hand' });
    await act(async () => resolveSend(sent));
    await waitFor(() => expect(screen.queryByLabelText('Sending')).toBeNull());
    await act(async () => mockSockets.chat?.(messageFrame(sent)));
    expect(screen.getAllByText('Need a hand')).toHaveLength(1);
  });

  it('a failed send shows Retry and the retry goes through', async () => {
    mockSend.mockRejectedValueOnce(new Error('Server says no'));
    mockSend.mockResolvedValueOnce(live({ id: 'srv2', senderType: 'org', senderId: 'user-1', text: 'Try again' }));
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Try again');
    await fireEvent.press(screen.getByLabelText('Send message'));
    expect(await screen.findByText('Failed to send')).toBeTruthy();
    expect(await screen.findByText('Server says no')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(screen.queryByText('Failed to send')).toBeNull());
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('Try again')).toHaveLength(1);
  });

  it('a failed send can be discarded', async () => {
    mockSend.mockRejectedValueOnce(new Error('nope'));
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Discard me');
    await fireEvent.press(screen.getByLabelText('Send message'));
    await screen.findByText('Failed to send');
    await fireEvent.press(screen.getByLabelText('Discard message'));
    await waitFor(() => expect(screen.queryByText('Discard me')).toBeNull());
  });

  it('shows a support reply that arrives live (once) and marks it read', async () => {
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    mockMarkRead.mockClear();
    const reply = live({ id: 'm9', text: 'Fixed on our side', senderName: 'Arjun' });
    await act(async () => mockSockets.chat?.(messageFrame(reply)));
    expect(await screen.findByText('Fixed on our side')).toBeTruthy();
    expect(screen.getByText('Arjun')).toBeTruthy();
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('org-1', 'user-1'));
    mockMarkRead.mockClear();
    await act(async () => mockSockets.chat?.(messageFrame(reply)));
    expect(screen.getAllByText('Fixed on our side')).toHaveLength(1);
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('a reply that lands while the screen is mounted but hidden is not marked read; coming back clears it', async () => {
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    await setScreenFocus(false); // another tab is showing; this screen stays mounted
    expect(liveChatSession.isOpen()).toBe(false);
    mockMarkRead.mockClear();
    await act(async () => mockSockets.chat?.(messageFrame(live({ id: 'm10', text: 'While you were away' }))));
    expect(mockMarkRead).not.toHaveBeenCalled();
    badges.set('liveChat', 1); // what the global socket does while the screen is not focused
    await setScreenFocus(true);
    expect(liveChatSession.isOpen()).toBe(true);
    expect(badges.get().liveChat).toBe(0);
    expect(mockMarkRead).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('ignores a frame of another organisation', async () => {
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    await act(async () => mockSockets.chat?.(messageFrame(live({ id: 'x1', text: 'Not for us' }), 'other-org')));
    expect(screen.queryByText('Not for us')).toBeNull();
  });

  it('turns my ticks to Read when support reads (live_chat_read)', async () => {
    mockGetMessages.mockResolvedValue(history([live({ id: 'm2', senderType: 'org', senderId: 'user-1', senderName: 'Owner', text: 'Question' })]));
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Question');
    expect(screen.getAllByLabelText('Sent')).toHaveLength(1);
    await act(async () => mockSockets.chat?.({ type: 'live_chat_read', data: { org_id: 'org-1', reader: 'support' } }));
    expect(await screen.findByLabelText('Read')).toBeTruthy();
  });

  it('reloads the history and marks read again after a reconnect', async () => {
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    mockGetMessages.mockClear();
    mockMarkRead.mockClear();
    await act(async () => mockSockets.onReconnect?.());
    await waitFor(() => expect(mockGetMessages).toHaveBeenCalledTimes(1));
    expect(mockMarkRead).toHaveBeenCalledTimes(1);
  });

  it('sends a photo as an attachment and reports the upload', async () => {
    mockPickImage.mockResolvedValue({ uri: 'file:///tmp/p.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg' });
    mockSendFile.mockResolvedValue(live({ id: 'f1', senderType: 'org', senderId: 'user-1', type: 'image', text: 'p.jpg', fileUrl: 'https://s3/p.jpg' }));
    await renderScreen(<LiveChatScreen />);
    await screen.findByText('Hi, how can we help?');
    await fireEvent.press(screen.getByLabelText('Take a photo'));
    await waitFor(() => expect(mockSendFile).toHaveBeenCalled());
    expect(mockSendFile).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', userId: 'user-1', fileUri: 'file:///tmp/p.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg' }));
  });

  it('shows the closed banner until the admin writes (sending reopens the thread)', async () => {
    mockGetMessages.mockResolvedValue(history([live({ id: 'm1', text: 'Resolved, closing this.' })], 'closed'));
    mockSend.mockResolvedValue(live({ id: 'srv3', senderType: 'org', senderId: 'user-1', text: 'One more thing' }));
    await renderScreen(<LiveChatScreen />);
    expect(await screen.findByTestId('live-chat-closed-banner')).toBeTruthy();
    expect(screen.getByText('This conversation was closed by support. Send a message to reopen it.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'One more thing');
    await fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(screen.queryByTestId('live-chat-closed-banner')).toBeNull());
  });

  it('shows an error state with retry when the history cannot be loaded', async () => {
    mockGetMessages.mockRejectedValueOnce(new Error('Server is down'));
    await renderScreen(<LiveChatScreen />);
    expect(await screen.findByText('Server is down')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Hi, how can we help?')).toBeTruthy();
  });
});

describe('Live Chat access', () => {
  it.each([2, 3])('sends role %i away and never loads the conversation', async (roleId) => {
    signInTestAdmin({ roleId: roleId as 2 | 3 });
    await renderScreen(<LiveChatScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/staff/home');
    expect(mockGetMessages).not.toHaveBeenCalled();
    expect(screen.queryByTestId('chat-input')).toBeNull();
    expect(liveChatSession.isOpen()).toBe(false);
  });
});
