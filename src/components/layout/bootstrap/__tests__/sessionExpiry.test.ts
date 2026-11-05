import { api, resetApiConfig } from '@/lib/api/client';
import { useAuthStore, type Session, type TeardownContext } from '@/store/auth';

import { logoutOnServer, type ServerLogoutDeps } from '../serverLogout';
import { handleSessionExpired, registerSessionExpiry, SESSION_EXPIRED_MESSAGE, type SessionExpiryDeps } from '../sessionExpiry';

jest.mock('@/lib/navigation', () => ({ goToWelcome: jest.fn() }));
jest.mock('@/components/ui/internal/toastStore', () => ({ toast: { error: jest.fn() } }));

const session: Session = { userId: 'u1', orgId: 'o1', orgName: 'A', roleId: 3, managerPermissions: [], deviceToken: 'dev-1', accessToken: 'tok-1' };

const makeDeps = (over: Partial<SessionExpiryDeps> = {}): jest.Mocked<SessionExpiryDeps> =>
  ({
    getSession: jest.fn(() => session),
    signOut: jest.fn(async () => undefined),
    goToWelcome: jest.fn(),
    notify: jest.fn(),
    ...over,
  }) as jest.Mocked<SessionExpiryDeps>;

describe('handleSessionExpired', () => {
  it('signs out with reason expired, goes to the welcome screen, then shows the toast', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      signOut: jest.fn(async () => void order.push('signOut')),
      goToWelcome: jest.fn(() => void order.push('welcome')),
      notify: jest.fn(() => void order.push('toast')),
    });
    await expect(handleSessionExpired(deps)).resolves.toBe(true);
    expect(deps.signOut).toHaveBeenCalledWith({ reason: 'expired' });
    expect(deps.notify).toHaveBeenCalledWith('Your session expired. Please sign in again.');
    expect(SESSION_EXPIRED_MESSAGE).toBe('Your session expired. Please sign in again.');
    expect(order).toEqual(['signOut', 'welcome', 'toast']);
  });

  it('does nothing when nobody is signed in', async () => {
    const deps = makeDeps({ getSession: jest.fn(() => null) });
    await expect(handleSessionExpired(deps)).resolves.toBe(false);
    expect(deps.signOut).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('a failing signOut or navigation still ends on the welcome flow with the toast', async () => {
    const deps = makeDeps({ signOut: jest.fn(async () => { throw new Error('x'); }), goToWelcome: jest.fn(() => { throw new Error('y'); }) });
    await expect(handleSessionExpired(deps)).resolves.toBe(true);
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });
});

describe('registerSessionExpiry (wired to the HTTP client)', () => {
  beforeEach(() => {
    resetApiConfig();
    useAuthStore.setState({ session });
  });
  afterEach(() => useAuthStore.setState({ session: null }));

  it('several simultaneous 401s sign out exactly once; unregister detaches the handler', async () => {
    const deps = makeDeps();
    const unregister = registerSessionExpiry(deps);
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '{"detail":"Token expired"}' });
    await Promise.allSettled([api.get('/a'), api.get('/b'), api.get('/c')]);
    await Promise.resolve();
    expect(deps.signOut).toHaveBeenCalledTimes(1);
    expect(deps.signOut).toHaveBeenCalledWith({ reason: 'expired' });

    unregister();
    useAuthStore.setState({ session: { ...session, accessToken: 'tok-2' } });
    await api.get('/a').catch(() => undefined);
    expect(deps.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('logoutOnServer (sign-out teardown)', () => {
  const ctx = (reason: TeardownContext['reason'], s: Session | null = session): TeardownContext => ({ reason, session: s });
  const makeLogoutDeps = (pushToken: string | null = 'push-1'): jest.Mocked<ServerLogoutDeps> => ({
    logout: jest.fn(async (_input: Parameters<ServerLogoutDeps['logout']>[0]) => undefined),
    readPushToken: jest.fn(async () => pushToken),
  });

  it('explicit sign-out: calls logout with user id, device token and the cached push token', async () => {
    const deps = makeLogoutDeps();
    await logoutOnServer(ctx('logout'), deps);
    expect(deps.logout).toHaveBeenCalledWith({ userId: 'u1', deviceToken: 'dev-1', pushToken: 'push-1' });
  });

  it('works without a device / push token (admins) and survives a storage failure', async () => {
    const deps = makeLogoutDeps(null);
    await logoutOnServer(ctx('logout', { ...session, deviceToken: undefined }), deps);
    expect(deps.logout).toHaveBeenCalledWith({ userId: 'u1', deviceToken: undefined, pushToken: undefined });
    const broken = makeLogoutDeps();
    broken.readPushToken.mockRejectedValue(new Error('storage'));
    await expect(logoutOnServer(ctx('logout'), broken)).resolves.toBeUndefined();
    expect(broken.logout).toHaveBeenCalledTimes(1);
  });

  it('is skipped for expired / forced / deleted sign-outs and when there is no session', async () => {
    for (const reason of ['expired', 'forced', 'deleted'] as const) {
      const deps = makeLogoutDeps();
      await logoutOnServer(ctx(reason), deps);
      expect(deps.logout).not.toHaveBeenCalled();
    }
    const deps = makeLogoutDeps();
    await logoutOnServer(ctx('logout', null), deps);
    expect(deps.logout).not.toHaveBeenCalled();
  });
});
