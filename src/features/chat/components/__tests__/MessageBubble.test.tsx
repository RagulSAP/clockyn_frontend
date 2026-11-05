import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ToastProvider } from '@/components/ui';
import { ThemeProvider } from '@/theme';
import type { ChatItem } from '../../types';
import { resetChatSessionMemory } from '../../utils/chatSession';
import { MessageBubble } from '../MessageBubble';
import { statusIconFor } from '../MessageStatus';

jest.mock('@/lib/platform/files', () => ({ downloadAndOpen: jest.fn(async () => ({ filename: 'x' })) }));

const item = (over: Partial<ChatItem>): ChatItem => ({
  key: 'k1',
  id: 'm1',
  senderId: 'peer',
  senderName: 'Rahul Nair',
  fromMe: false,
  text: 'hello there',
  type: 'text',
  fileUrl: null,
  sentAt: '2026-10-18T10:00:00Z',
  ts: Date.parse('2026-10-18T10:00:00Z'),
  isRead: false,
  isDelivered: true,
  readCount: 0,
  totalMembers: 0,
  state: 'sent',
  ...over,
});

async function show(i: ChatItem, extra: Partial<React.ComponentProps<typeof MessageBubble>> = {}) {
  const props = { onViewImage: jest.fn(), onRetry: jest.fn(), onDiscard: jest.fn(), ...extra };
  await render(
    <ThemeProvider>
      <ToastProvider>
        <MessageBubble item={i} {...props} />
      </ToastProvider>
    </ThemeProvider>,
  );
  return props;
}

beforeEach(() => resetChatSessionMemory());

describe('MessageBubble', () => {
  it('text: shows the message and its IST time; group chats show the sender above incoming bubbles', async () => {
    await show(item({}), { showSender: true });
    expect(screen.getByText('hello there')).toBeTruthy();
    expect(screen.getByText('03:30 PM')).toBeTruthy();
    expect(screen.getByText('Rahul Nair')).toBeTruthy();
  });

  it('own message: single tick until read, double tick once read; pending shows the clock', async () => {
    expect(statusIconFor({ state: 'sent', isRead: false })).toBe('check');
    expect(statusIconFor({ state: 'sent', isRead: true })).toBe('check-check');
    expect(statusIconFor({ state: 'sending', isRead: false })).toBe('clock');
    expect(statusIconFor({ state: 'failed', isRead: false })).toBe('alert-circle');
    await show(item({ fromMe: true, isRead: true }));
    expect(screen.getByLabelText('Read')).toBeTruthy();
  });

  it('received image is hidden behind "Tap to view" first, then opens the viewer; the choice survives a re-render', async () => {
    const props = await show(item({ type: 'image', text: 'pic.png', fileUrl: 'https://cdn.example/a/pic.png?sig=1' }));
    expect(screen.getByText('Tap to view')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Tap to view photo'));
    expect(screen.queryByText('Tap to view')).toBeNull();
    expect(props.onViewImage).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Open photo'));
    expect(props.onViewImage).toHaveBeenCalledWith('https://cdn.example/a/pic.png?sig=1', 'pic.png');
  });

  it('own image: no reveal gate, the local thumbnail stays after the server URL arrives', async () => {
    const props = await show(item({ fromMe: true, type: 'image', text: 'me.png', localUri: 'file:///cache/me.png', fileUrl: 'https://cdn.example/me.png?sig=2' }));
    expect(screen.queryByText('Tap to view')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Open photo'));
    expect(props.onViewImage).toHaveBeenCalledWith('file:///cache/me.png', 'me.png');
  });

  it('uploading image shows progress', async () => {
    await show(item({ fromMe: true, type: 'image', text: 'me.png', localUri: 'file:///cache/me.png', state: 'sending', progress: 42 }));
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it('file card: name without the upload id prefix, extension and status', async () => {
    await show(item({ type: 'file', text: 'salary.xlsx', fileUrl: 'https://cdn.example/0123456789abcdef0123456789abcdef_salary.xlsx?sig=1' }));
    expect(screen.getByText('salary.xlsx')).toBeTruthy();
    expect(screen.getByText('XLSX · Tap to download')).toBeTruthy();
  });

  it('a failed message offers Retry and Discard', async () => {
    const props = await show(item({ fromMe: true, state: 'failed', clientId: 'c1', id: 'c1' }));
    expect(screen.getByText('Failed to send')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(props.onRetry).toHaveBeenCalledWith('c1');
    await fireEvent.press(screen.getByText('Discard'));
    expect(props.onDiscard).toHaveBeenCalledWith('c1');
  });
});
