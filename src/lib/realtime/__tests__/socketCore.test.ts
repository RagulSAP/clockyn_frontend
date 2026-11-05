import { buildSocketUrl, chatSocketPath, computeBackoff, createDeduper, createSocket, groupSocketPath } from '../socketCore';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static throwOnConstruct = false;
  readyState = 0;
  sent: string[] = [];
  closedByClient = false;
  onopen: ((e?: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  onclose: ((e?: { code?: number }) => void) | null = null;
  constructor(public url: string) {
    if (FakeWebSocket.throwOnConstruct) throw new Error('boom');
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closedByClient = true;
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(data: unknown) {
    this.onmessage?.({ data });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}

const Impl = FakeWebSocket as unknown as typeof WebSocket;
const last = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

beforeEach(() => {
  jest.useFakeTimers();
  FakeWebSocket.instances = [];
  FakeWebSocket.throwOnConstruct = false;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('computeBackoff', () => {
  const noJitter = { jitter: 0 };
  it('grows exponentially from the base delay', () => {
    expect([0, 1, 2, 3].map((n) => computeBackoff(n, noJitter))).toEqual([1000, 2000, 4000, 8000]);
  });
  it('is capped at maxMs', () => {
    expect(computeBackoff(20, noJitter)).toBe(30000);
    expect(computeBackoff(20, { jitter: 0, maxMs: 5000 })).toBe(5000);
  });
  it('applies jitter within +-20 % and never exceeds the cap', () => {
    expect(computeBackoff(2, { jitter: 0.2 }, () => 0)).toBe(3200);
    expect(computeBackoff(2, { jitter: 0.2 }, () => 1)).toBe(4800);
    expect(computeBackoff(20, { jitter: 0.2 }, () => 1)).toBe(30000);
  });
  it('treats negative attempts as zero', () => {
    expect(computeBackoff(-3, noJitter)).toBe(1000);
  });
});

describe('url helpers', () => {
  it('joins base and path with a single slash', () => {
    expect(buildSocketUrl('/ws/chat/1', 'wss://host.test')).toBe('wss://host.test/ws/chat/1');
    expect(buildSocketUrl('ws/chat/1', 'wss://host.test/')).toBe('wss://host.test/ws/chat/1');
  });
  it('builds chat and group paths', () => {
    expect(chatSocketPath('u 1')).toBe('/ws/chat/u%201');
    expect(groupSocketPath('g1', 'u1')).toBe('/ws/group-chat/g1/u1');
  });
});

describe('createSocket', () => {
  const make = (extra: Partial<Parameters<typeof createSocket>[0]> = {}) => {
    const onMessage = jest.fn();
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const sock = createSocket({
      path: '/ws/chat/7',
      baseUrl: 'wss://host.test',
      WebSocketImpl: Impl,
      onMessage,
      onOpen,
      onClose,
      backoff: { jitter: 0 },
      ...extra,
    });
    return { sock, onMessage, onOpen, onClose };
  };

  it('connects to the built URL and reports open', () => {
    const { sock, onOpen } = make();
    expect(last().url).toBe('wss://host.test/ws/chat/7');
    last().open();
    expect(onOpen).toHaveBeenCalledWith({ reconnected: false });
    expect(sock.isOpen()).toBe(true);
  });

  it('parses JSON frames and ignores pong / non-JSON / non-string frames', () => {
    const { onMessage } = make();
    last().open();
    last().message(JSON.stringify({ type: 'new_message', data: { message_id: '1' } }));
    last().message('pong');
    last().message(new ArrayBuffer(2));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ type: 'new_message', data: { message_id: '1' } });
  });

  it('keeps going if the message handler throws', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { onMessage } = make();
    onMessage.mockImplementation(() => {
      throw new Error('bad handler');
    });
    last().open();
    expect(() => last().message('{"a":1}')).not.toThrow();
    warn.mockRestore();
  });

  it('pings every pingMs while open', () => {
    make({ pingMs: 1000 });
    last().open();
    jest.advanceTimersByTime(3000);
    expect(last().sent).toEqual(['ping', 'ping', 'ping']);
  });

  it('does not ping when pingMs is 0', () => {
    make({ pingMs: 0 });
    last().open();
    jest.advanceTimersByTime(60000);
    expect(last().sent).toEqual([]);
  });

  it('reconnects with exponential backoff after drops and resets after a successful open', () => {
    const { onOpen, onClose } = make();
    last().open();
    last().drop();
    expect(onClose).toHaveBeenLastCalledWith(expect.objectContaining({ willReconnect: true }));
    expect(FakeWebSocket.instances).toHaveLength(1);

    jest.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2); // 1 s

    last().drop(); // never opened -> attempt 1 => 2 s
    jest.advanceTimersByTime(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);

    last().open();
    expect(onOpen).toHaveBeenLastCalledWith({ reconnected: true });
    last().drop(); // attempt counter reset by the open -> 1 s again
    jest.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(4);
  });

  it('turns an error into a single close + reconnect', () => {
    const { onClose } = make();
    last().open();
    const first = last();
    first.onerror?.();
    expect(first.closedByClient).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('retries when the WebSocket constructor throws', () => {
    FakeWebSocket.throwOnConstruct = true;
    make();
    expect(FakeWebSocket.instances).toHaveLength(0);
    FakeWebSocket.throwOnConstruct = false;
    jest.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('close() stops reconnects and pings and detaches handlers', () => {
    const { sock, onClose, onMessage } = make({ pingMs: 1000 });
    const ws = last();
    ws.open();
    sock.close();
    expect(ws.closedByClient).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    jest.advanceTimersByTime(120000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(ws.sent).toEqual([]);
    ws.message('{"x":1}');
    expect(onMessage).not.toHaveBeenCalled();
    expect(() => sock.close()).not.toThrow();
    expect(sock.send('hi')).toBe(false);
  });

  it('close() while a reconnect is pending cancels it', () => {
    const { sock } = make();
    last().open();
    last().drop();
    sock.close();
    jest.advanceTimersByTime(60000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('reconnectNow() does nothing while CONNECTING or OPEN and reconnects immediately when closed', () => {
    const { sock } = make();
    sock.reconnectNow(); // still CONNECTING
    expect(FakeWebSocket.instances).toHaveLength(1);
    last().open();
    sock.reconnectNow();
    expect(FakeWebSocket.instances).toHaveLength(1);
    last().drop();
    sock.reconnectNow();
    expect(FakeWebSocket.instances).toHaveLength(2);
    jest.advanceTimersByTime(60000); // the pending timer was cancelled: no third socket
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('send() encodes objects and reports availability', () => {
    const { sock } = make();
    expect(sock.send({ a: 1 })).toBe(false); // not open yet
    last().open();
    expect(sock.send({ a: 1 })).toBe(true);
    expect(sock.send('raw')).toBe(true);
    expect(last().sent).toEqual(['{"a":1}', 'raw']);
  });

  it('ignores events from a stale socket after reconnecting', () => {
    const { onMessage } = make();
    const first = last();
    first.open();
    first.drop();
    jest.advanceTimersByTime(1000);
    const second = last();
    second.open();
    first.message('{"stale":true}');
    second.message('{"fresh":true}');
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ fresh: true });
  });
});

describe('createDeduper', () => {
  it('reports repeats', () => {
    const d = createDeduper();
    expect(d.seen('a')).toBe(false);
    expect(d.seen('a')).toBe(true);
    expect(d.seen('b')).toBe(false);
    expect(d.has('a')).toBe(true);
  });
  it('evicts the oldest ids beyond maxSize', () => {
    const d = createDeduper(2);
    d.seen('a');
    d.seen('b');
    d.seen('c'); // evicts a
    expect(d.size()).toBe(2);
    expect(d.has('a')).toBe(false);
    expect(d.seen('a')).toBe(false);
  });
  it('clear() forgets everything', () => {
    const d = createDeduper();
    d.seen('x');
    d.clear();
    expect(d.seen('x')).toBe(false);
  });
});
