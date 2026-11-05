import { env } from '@/config/env';

import {
  api,
  buildFormData,
  buildQueryString,
  buildUrl,
  configureApi,
  resetApiConfig,
  safeParseBody,
} from '../client';
import { ApiError } from '../errors';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit & { signal?: AbortSignal }]>;

function jsonResponse(status: number, body: unknown, rawText?: string): Response {
  const text = rawText ?? (body === undefined ? '' : JSON.stringify(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    blob: async () => ({ size: text.length }) as unknown as Blob,
  } as unknown as Response;
}

let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = jest.fn();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  resetApiConfig();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('buildQueryString / buildUrl', () => {
  it('skips undefined and null, encodes values, repeats arrays', () => {
    expect(buildQueryString({ a: 1, b: undefined, c: null, d: 'x y', e: false, f: 0, g: '' })).toBe('a=1&d=x%20y&e=false&f=0&g=');
    expect(buildQueryString({ id: ['a', 'b'] })).toBe('id=a&id=b');
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString(undefined)).toBe('');
    expect(buildQueryString({ 'a&b': 'c=d' })).toBe('a%26b=c%3Dd');
  });
  it('joins base url, path and query', () => {
    expect(buildUrl('/x')).toBe(`${env.apiBaseUrl}/x`);
    expect(buildUrl('x')).toBe(`${env.apiBaseUrl}/x`);
    expect(buildUrl('/x', { a: 1 })).toBe(`${env.apiBaseUrl}/x?a=1`);
    expect(buildUrl('/x?z=1', { a: 1 })).toBe(`${env.apiBaseUrl}/x?z=1&a=1`);
    expect(buildUrl('/x', { a: undefined })).toBe(`${env.apiBaseUrl}/x`);
    expect(buildUrl('https://example.com/y', { a: 1 })).toBe('https://example.com/y?a=1');
  });
  it('honours a configured base url', () => {
    configureApi({ baseUrl: 'http://localhost:8080/' });
    expect(buildUrl('/ping')).toBe('http://localhost:8080/ping');
  });
});

describe('safeParseBody', () => {
  it('never throws', () => {
    expect(safeParseBody('')).toBeNull();
    expect(safeParseBody('  ')).toBeNull();
    expect(safeParseBody('{"a":1}')).toEqual({ a: 1 });
    expect(safeParseBody('[1,2]')).toEqual([1, 2]);
    expect(safeParseBody('<html>')).toBe('<html>');
    expect(safeParseBody('{broken')).toBe('{broken');
  });
});

describe('api.get', () => {
  it('sends a GET with Accept JSON, no body and no auth header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [{ id: 1 }]));
    const data = await api.get<{ id: number }[]>('/home/branches', { org_id: 'o1', skip: undefined });
    expect(data).toEqual([{ id: 1 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${env.apiBaseUrl}/home/branches?org_id=o1`);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
    expect(Object.keys(init.headers as Record<string, string>).map((k) => k.toLowerCase())).not.toContain('authorization');
  });
  it('merges opts.query with the query argument', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.get('/x', { a: 1 }, { query: { b: 2 } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${env.apiBaseUrl}/x?b=2&a=1`);
  });
  it('returns null for an empty body and the text for non-JSON success bodies', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, undefined, ''));
    expect(await api.get('/empty')).toBeNull();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, undefined, 'pong'));
    expect(await api.get('/text')).toBe('pong');
  });
  it('supports text and blob response types', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, undefined, 'a,b'));
    expect(await api.get('/csv', undefined, { responseType: 'text' })).toBe('a,b');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, undefined, 'abc'));
    expect(await api.get<{ size: number }>('/pdf', undefined, { responseType: 'blob' })).toEqual({ size: 3 });
  });
});

describe('api.post / put / patch / delete', () => {
  it('POST sends JSON with Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));
    await api.post('/auth/login', { login_id: '9876543210' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"login_id":"9876543210"}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
  it('does not set Content-Type for FormData and passes the body through', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const form = new FormData();
    form.append('a', 'b');
    await api.post('/up', form);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    expect(Object.keys(init.headers as Record<string, string>).map((k) => k.toLowerCase())).not.toContain('content-type');
  });
  it('POST without a body sends none; query works on POST', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.post('/x', undefined, { query: { user_id: 'u' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${env.apiBaseUrl}/x?user_id=u`);
    expect(init.body).toBeUndefined();
  });
  it('PUT, PATCH and DELETE use the right methods', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.put('/a', { x: 1 });
    await api.patch('/b', { y: 2 });
    await api.delete('/c', { id: 3 });
    expect(fetchMock.mock.calls.map((c) => c[1].method)).toEqual(['PUT', 'PATCH', 'DELETE']);
    expect(fetchMock.mock.calls[2][0]).toBe(`${env.apiBaseUrl}/c?id=3`);
    expect(fetchMock.mock.calls[2][1].body).toBeUndefined();
  });
  it('DELETE can carry a body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.delete('/c', undefined, { body: { ids: [1] } });
    expect(fetchMock.mock.calls[0][1].body).toBe('{"ids":[1]}');
  });
  it('caller headers win; custom Content-Type is kept', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.post('/x', { a: 1 }, { headers: { 'content-type': 'application/x-custom', 'X-Test': '1' } });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/x-custom');
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['X-Test']).toBe('1');
  });
});

describe('error handling', () => {
  it('maps a 400 detail to ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { detail: 'Invalid OTP format' }));
    const err = await api.post('/auth/validate-otp', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: 'Invalid OTP format', detail: 'Invalid OTP format', isNetwork: false });
  });
  it('maps a 422 array detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse(422, { detail: [{ loc: ['query', 'user_id'], msg: 'Field required' }] }));
    const err = (await api.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(422);
    expect(err.message).toBe('Field required');
  });
  it('unwraps 500 "403: message"', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: '403: Your plan has expired. Please renew your plan to continue using this feature.' }));
    const err = (await api.get('/chat/list/u').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(403);
    expect(err.wrapped).toBe(true);
    expect(err.message).toBe('Your plan has expired. Please renew your plan to continue using this feature.');
  });
  it('handles non-JSON error bodies', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, undefined, '<html>Bad Gateway</html>'));
    const err = (await api.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.detail).toBeUndefined();
    expect(err.message).toBe('Server error. Please try again later.');
  });
  it('turns fetch rejections into network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const err = (await api.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isNetwork).toBe(true);
    expect(err.status).toBe(0);
    expect(err.isTimeout).toBe(false);
  });
  it('does not leak request data into the error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const err = (await api.post('/auth/login', { login_id: '9876543210' }).catch((e: unknown) => e)) as ApiError;
    expect(JSON.stringify([err.message, err.raw, err.detail])).not.toContain('9876543210');
  });
  it('notifies the onError observer and survives observer failures', async () => {
    const seen: ApiError[] = [];
    configureApi({ onError: (e) => { seen.push(e); throw new Error('observer bug'); } });
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: 'nope' }));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 404 });
    expect(seen).toHaveLength(1);
  });
});

describe('timeouts and aborts', () => {
  it('aborts after the timeout and reports isTimeout', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const p = api.get('/slow', undefined, { timeoutMs: 5000 }).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(4999);
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(2);
    const err = (await p) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isTimeout).toBe(true);
    expect(err.isNetwork).toBe(true);
  });
  it('uses a 30s default timeout', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const p = api.get('/slow').catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(29_999);
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(2);
    expect(((await p) as ApiError).isTimeout).toBe(true);
  });
  it('timeoutMs: 0 disables the timeout', async () => {
    jest.useFakeTimers();
    let resolveFetch: (r: Response) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { resolveFetch = r; }));
    const p = api.get('/x', undefined, { timeoutMs: 0 });
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    resolveFetch(jsonResponse(200, { ok: true }));
    await expect(p).resolves.toEqual({ ok: true });
  });
  it('clears the timer after a successful request', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.get('/x');
    expect(jest.getTimerCount()).toBe(0);
  });
  it('caller abort yields isAborted (not a network error)', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          if (init.signal?.aborted) reject(new Error('aborted'));
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const ctrl = new AbortController();
    const p = api.get('/x', undefined, { signal: ctrl.signal }).catch((e: unknown) => e);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalled();
    ctrl.abort();
    const err = (await p) as ApiError;
    expect(err.isAborted).toBe(true);
    expect(err.isNetwork).toBe(false);
  });
  it('an already-aborted signal short-circuits', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          if (init.signal?.aborted) reject(new Error('aborted'));
        }),
    );
    const ctrl = new AbortController();
    ctrl.abort();
    const err = (await api.get('/x', undefined, { signal: ctrl.signal }).catch((e: unknown) => e)) as ApiError;
    expect(err.isAborted).toBe(true);
  });
});

describe('getHeaders hook', () => {
  it('adds async headers to every request', async () => {
    configureApi({ getHeaders: async () => ({ Authorization: 'Bearer abc' }) });
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.get('/x');
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });
  it('a failing hook does not break the request', async () => {
    configureApi({ getHeaders: () => { throw new Error('boom'); } });
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: 1 }));
    await expect(api.get('/x')).resolves.toEqual({ ok: 1 });
  });
});

describe('buildFormData', () => {
  it('appends fields (skipping null/undefined) and a native file descriptor', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    try {
      await buildFormData({
        fileUri: 'file:///tmp/a.jpg',
        fieldName: 'photo',
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        fields: { user_id: 'u1', n: 3, skip: undefined, nul: null, flag: false },
      });
      const calls = append.mock.calls.map((c) => [c[0], c[1]]);
      expect(calls).toContainEqual(['user_id', 'u1']);
      expect(calls).toContainEqual(['n', '3']);
      expect(calls).toContainEqual(['flag', 'false']);
      expect(calls.find((c) => c[0] === 'skip')).toBeUndefined();
      expect(calls.find((c) => c[0] === 'nul')).toBeUndefined();
      expect(calls).toContainEqual(['photo', { uri: 'file:///tmp/a.jpg', name: 'a.jpg', type: 'image/jpeg' }]);
    } finally {
      append.mockRestore();
    }
  });
  it('supports several files under the same field', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');
    try {
      await buildFormData({
        files: [1, 2, 3, 4].map((i) => ({ fileUri: `file:///f${i}.jpg`, fieldName: 'faces', fileName: `f${i}.jpg`, mimeType: 'image/jpeg' })),
        fields: { user_id: 'u' },
      });
      expect(append.mock.calls.filter((c) => c[0] === 'faces')).toHaveLength(4);
    } finally {
      append.mockRestore();
    }
  });
  it('passes FormData through untouched', async () => {
    const form = new FormData();
    expect(await buildFormData(form)).toBe(form);
  });
});

// ─── upload via XHR ──────────────────────────────────────────────────────────────────────────

class FakeXHR {
  static last: FakeXHR | null = null;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  timeout = 0;
  status = 0;
  responseText = '';
  body: unknown;
  aborted = false;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXHR.last = this;
  }
  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string): void {
    this.headers[k] = v;
  }
  send(body: unknown): void {
    this.body = body;
  }
  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, text: string): void {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
}

describe('api.upload', () => {
  const original = (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest;
  beforeEach(() => {
    FakeXHR.last = null;
    (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
  });
  afterEach(() => {
    (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = original;
  });

  const file = { fileUri: 'file:///a.jpg', fieldName: 'file', fileName: 'a.jpg', mimeType: 'image/jpeg' };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('posts multipart, reports progress and resolves with parsed JSON', async () => {
    const progress: number[] = [];
    const p = api.upload<{ url: string }>('/chat/send-file', file, {
      onProgress: (pct) => progress.push(pct),
      query: { user_id: 'u1' },
    });
    await tick();
    const xhr = FakeXHR.last!;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe(`${env.apiBaseUrl}/chat/send-file?user_id=u1`);
    expect(xhr.timeout).toBe(60_000);
    expect(xhr.body).toBeInstanceOf(FormData);
    expect(Object.keys(xhr.headers).map((k) => k.toLowerCase())).not.toContain('content-type');
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    xhr.respond(200, '{"url":"https://x/y"}');
    await expect(p).resolves.toEqual({ url: 'https://x/y' });
    expect(progress).toEqual([25, 100]);
  });

  it('honours method and timeout options', async () => {
    const p = api.upload('/x', file, { method: 'PUT', timeoutMs: 1234 });
    await tick();
    expect(FakeXHR.last!.method).toBe('PUT');
    expect(FakeXHR.last!.timeout).toBe(1234);
    FakeXHR.last!.respond(204, '');
    await expect(p).resolves.toBeNull();
  });

  it('maps non-2xx to ApiError (incl. wrapped 500)', async () => {
    const p = api.upload('/x', file).catch((e: unknown) => e);
    await tick();
    FakeXHR.last!.respond(400, '{"detail":"File too large"}');
    expect(await p).toMatchObject({ status: 400, message: 'File too large' });

    const p2 = api.upload('/x', file).catch((e: unknown) => e);
    await tick();
    FakeXHR.last!.respond(500, '{"detail":"403: Plan blocked"}');
    expect(await p2).toMatchObject({ status: 403, wrapped: true, message: 'Plan blocked' });
  });

  it('maps network error, timeout and abort', async () => {
    const p1 = api.upload('/x', file).catch((e: unknown) => e);
    await tick();
    FakeXHR.last!.onerror?.();
    expect(await p1).toMatchObject({ isNetwork: true, isTimeout: false });

    const p2 = api.upload('/x', file).catch((e: unknown) => e);
    await tick();
    FakeXHR.last!.ontimeout?.();
    expect(await p2).toMatchObject({ isNetwork: true, isTimeout: true });

    const ctrl = new AbortController();
    const p3 = api.upload('/x', file, { signal: ctrl.signal }).catch((e: unknown) => e);
    await tick();
    ctrl.abort();
    expect(await p3).toMatchObject({ isAborted: true });
    expect(FakeXHR.last!.aborted).toBe(true);
  });

  it('accepts a prepared FormData', async () => {
    const form = new FormData();
    form.append('a', 'b');
    const p = api.upload('/x', form);
    await tick();
    expect(FakeXHR.last!.body).toBe(form);
    FakeXHR.last!.respond(200, '{}');
    await expect(p).resolves.toEqual({});
  });
});
