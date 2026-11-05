import { chatSocketUrl } from '@/api/chat';
import { groupSocketUrl } from '@/api/groupChat';
import { useAuthStore } from '@/store/auth';

import { buildSocketUrl, chatSocketPath, createSocket } from '../socketCore';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: ((e?: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  onclose: ((e?: { code?: number }) => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}
const Impl = FakeWebSocket as unknown as typeof WebSocket;
const last = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

beforeEach(() => {
  FakeWebSocket.instances = [];
  useAuthStore.setState({ session: null });
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('socket URLs carry ?token=', () => {
  it('buildSocketUrl appends the encoded token, with ? or &', () => {
    expect(buildSocketUrl('/ws/chat/1', 'wss://host.test', 'tok-1')).toBe('wss://host.test/ws/chat/1?token=tok-1');
    expect(buildSocketUrl('/ws/chat/1', 'wss://host.test', 'a b/c+d')).toBe('wss://host.test/ws/chat/1?token=a%20b%2Fc%2Bd');
    expect(buildSocketUrl('/ws/chat/1?x=1', 'wss://host.test', 't')).toBe('wss://host.test/ws/chat/1?x=1&token=t');
    expect(buildSocketUrl('/ws/chat/1', 'wss://host.test')).toBe('wss://host.test/ws/chat/1');
    expect(buildSocketUrl('/ws/chat/1', 'wss://host.test', undefined)).toBe('wss://host.test/ws/chat/1');
  });

  it('chat and group URL helpers', () => {
    expect(chatSocketUrl('u1', 'tok')).toMatch(/\/ws\/chat\/u1\?token=tok$/);
    expect(chatSocketUrl('u1')).toMatch(/\/ws\/chat\/u1$/);
    expect(groupSocketUrl('g1', 'u1', 'tok')).toMatch(/\/ws\/group-chat\/g1\/u1\?token=tok$/);
  });
});

describe('createSocket', () => {
  const make = (extra: Partial<Parameters<typeof createSocket>[0]> = {}) =>
    createSocket({ path: chatSocketPath('7'), baseUrl: 'wss://host.test', WebSocketImpl: Impl, onMessage: jest.fn(), backoff: { jitter: 0 }, random: () => 0, ...extra });

  it('uses the signed-in session token by default', () => {
    useAuthStore.setState({ session: { userId: '7', orgId: 'o', orgName: 'A', roleId: 3, managerPermissions: [], accessToken: 'tok-ws' } });
    const sock = make();
    expect(last().url).toBe('wss://host.test/ws/chat/7?token=tok-ws');
    sock.close();
  });

  it('no token (older server): the URL is unchanged', () => {
    const sock = make();
    expect(last().url).toBe('wss://host.test/ws/chat/7');
    sock.close();
  });

  it('re-reads the token on every reconnect', () => {
    let token: string | undefined = 'one';
    const sock = make({ getToken: () => token });
    expect(last().url).toContain('token=one');
    token = 'two';
    last().drop();
    jest.advanceTimersByTime(1500);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(last().url).toContain('token=two');
    sock.close();
  });
});
