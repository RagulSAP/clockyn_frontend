import { env } from '@/config/env';
import { useAuthStore, type Session } from '@/store/auth';

import { api, authHeadersFor, configureApi, isPublicPath, resetApiConfig } from '../client';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit]>;

function jsonResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, blob: async () => ({}) as Blob } as unknown as Response;
}

const session = (over: Partial<Session> = {}): Session => ({
  userId: 'u1',
  orgId: 'o1',
  orgName: 'Acme',
  roleId: 1,
  managerPermissions: [],
  accessToken: 'tok-1',
  ...over,
});

let fetchMock: FetchMock;
const sentHeaders = (call = 0): Record<string, string> => (fetchMock.mock.calls[call][1].headers ?? {}) as Record<string, string>;

beforeEach(() => {
  fetchMock = jest.fn();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  resetApiConfig();
  useAuthStore.setState({ session: null });
});

describe('public paths', () => {
  it.each([
    '/auth/config',
    '/auth/generate-otp',
    '/auth/validate-otp',
    '/auth/verify-device-token',
    '/auth/login',
    '/auth/employee-login',
    '/auth/register',
    '/auth/check-mobile/9876543210',
    '/auth/check-email/a%40b.co',
    '/auth/org-logo/org-1',
    '/version/check',
    '/health',
    '/ready',
    '/webhook/razorpay',
    '/auth/login?x=1',
    '/auth/login/',
  ])('%s is public', (p) => expect(isPublicPath(p)).toBe(true));

  it.each(['/home/branches', '/auth/logout', '/auth/update-push-token', '/auth/user-mobile/u1', '/auth/upload-org-logo/o1', '/chat/send', '/profile-photos', '/profile-photo/u1'])(
    '%s is protected',
    (p) => expect(isPublicPath(p)).toBe(false),
  );

  it('absolute URLs: the API host follows the same rules, foreign hosts are never ours', () => {
    expect(isPublicPath(`${env.apiBaseUrl}/home/branches`)).toBe(false);
    expect(isPublicPath(`${env.apiBaseUrl}/auth/login`)).toBe(true);
    expect(isPublicPath('https://cdn.example.com/report.pdf')).toBe(true);
  });
});

describe('Authorization header', () => {
  it('is sent on protected paths when the session has a token (every method, query kept)', async () => {
    useAuthStore.setState({ session: session() });
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.get('/home/branches', { user_id: 'o1' });
    await api.post('/chat/send', { a: 1 });
    await api.put('/x', {});
    await api.patch('/x', {});
    await api.delete('/x');
    for (let i = 0; i < 5; i += 1) expect(sentHeaders(i).Authorization).toBe('Bearer tok-1');
  });

  it('is not sent on public paths, without a session, or when the session has no token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.get('/home/branches');
    expect(sentHeaders(0).Authorization).toBeUndefined(); // signed out

    useAuthStore.setState({ session: session() });
    await api.post('/auth/validate-otp', {});
    await api.get('/auth/org-logo/o1');
    expect(sentHeaders(1).Authorization).toBeUndefined();
    expect(sentHeaders(2).Authorization).toBeUndefined();

    useAuthStore.setState({ session: session({ accessToken: undefined }) });
    await api.get('/home/branches');
    expect(sentHeaders(3).Authorization).toBeUndefined(); // older server: nothing issued, nothing sent
  });

  it('reads the token at call time (a new login is picked up) and never for foreign hosts', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    useAuthStore.setState({ session: session({ accessToken: 'a' }) });
    await api.get('/x');
    useAuthStore.setState({ session: session({ accessToken: 'b' }) });
    await api.get('/x');
    await api.get('https://cdn.example.com/y');
    expect(sentHeaders(0).Authorization).toBe('Bearer a');
    expect(sentHeaders(1).Authorization).toBe('Bearer b');
    expect(sentHeaders(2).Authorization).toBeUndefined();
  });

  it('an explicit accessToken is used before the session exists; per-call headers still win', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.get('/company/details/o1', undefined, { accessToken: 'early' });
    await api.get('/x', undefined, { headers: { Authorization: 'Bearer custom' } });
    expect(sentHeaders(0).Authorization).toBe('Bearer early');
    expect(sentHeaders(1).Authorization).toBe('Bearer custom');
  });

  it('authHeadersFor serves downloads made outside the client', () => {
    expect(authHeadersFor(`${env.apiBaseUrl}/reports/x`)).toEqual({});
    useAuthStore.setState({ session: session() });
    expect(authHeadersFor(`${env.apiBaseUrl}/reports/x`)).toEqual({ Authorization: 'Bearer tok-1' });
    expect(authHeadersFor('https://s3.example.com/f.pdf')).toEqual({});
  });
});

describe('401 handling', () => {
  it('calls onUnauthorized once for several simultaneous 401s and still throws the ApiError', async () => {
    const onUnauthorized = jest.fn();
    configureApi({ onUnauthorized });
    useAuthStore.setState({ session: session() });
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Token expired' }));
    const results = await Promise.allSettled([api.get('/a'), api.get('/b'), api.post('/c', {}), api.get('/d')]);
    expect(results.every((r) => r.status === 'rejected' && (r.reason as { status: number }).status === 401)).toBe(true);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await api.get('/e').catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('fires again for a NEW session (new token), not for a stale answer to an old one', async () => {
    const onUnauthorized = jest.fn();
    configureApi({ onUnauthorized });
    useAuthStore.setState({ session: session({ accessToken: 'old' }) });
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Token expired' }));
    await api.get('/a').catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    useAuthStore.setState({ session: session({ accessToken: 'new' }) });
    await api.get('/a').catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(2);

    // a request started with 'new' that answers 401 AFTER the user signed in again with another token: ignored
    let release: (r: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
    const inflight = api.get('/slow').catch(() => undefined);
    await Promise.resolve();
    await Promise.resolve();
    useAuthStore.setState({ session: session({ accessToken: 'newer' }) });
    release(jsonResponse(401, { detail: 'Token expired' }));
    await inflight;
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('ignores 401 from public paths, from /auth/logout, with no session, and 403s', async () => {
    const onUnauthorized = jest.fn();
    configureApi({ onUnauthorized });
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'User not found' }));
    await api.post('/auth/login', {}).catch(() => undefined);
    await api.get('/home/x').catch(() => undefined); // no session
    useAuthStore.setState({ session: session() });
    await api.post('/auth/login', {}).catch(() => undefined);
    await api.post('/auth/logout', {}).catch(() => undefined);
    fetchMock.mockResolvedValue(jsonResponse(403, { detail: 'Forbidden' }));
    await api.get('/home/x').catch(() => undefined);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does nothing without a registered handler (and a throwing handler never breaks the request)', async () => {
    useAuthStore.setState({ session: session() });
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    await expect(api.get('/a')).rejects.toMatchObject({ status: 401 });
    configureApi({ onUnauthorized: () => { throw new Error('boom'); } });
    useAuthStore.setState({ session: session({ accessToken: 'again' }) });
    await expect(api.get('/a')).rejects.toMatchObject({ status: 401 });
  });
});
