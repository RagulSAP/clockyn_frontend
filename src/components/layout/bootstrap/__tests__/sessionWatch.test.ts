import { isForceLogoutPush, isSessionWatched, LOGIN_GRACE_MS, runSessionCheck, withinLoginGrace, type SessionCheckDeps } from '../sessionWatch';

const NOW = 1_700_000_000_000;
const staff = { userId: 'u1', roleId: 3, deviceToken: 'dev-1' };

const makeDeps = (over: Partial<SessionCheckDeps> = {}): jest.Mocked<SessionCheckDeps> =>
  ({
    getSession: jest.fn(() => staff),
    readLastLoginAt: jest.fn(async () => null),
    checkSession: jest.fn(async () => ({ valid: true, forceLogout: false })),
    signOut: jest.fn(async () => {}),
    now: () => NOW,
    ...over,
  }) as jest.Mocked<SessionCheckDeps>;

describe('isSessionWatched', () => {
  it('only roles 2 and 3 with a device token', () => {
    expect(isSessionWatched(staff)).toBe(true);
    expect(isSessionWatched({ ...staff, roleId: 2 })).toBe(true);
    expect(isSessionWatched({ ...staff, roleId: 1 })).toBe(false); // admins have no device token
    expect(isSessionWatched({ ...staff, deviceToken: undefined })).toBe(false);
    expect(isSessionWatched({ ...staff, deviceToken: '' })).toBe(false);
    expect(isSessionWatched(null)).toBe(false);
  });
});

describe('withinLoginGrace', () => {
  it('is true for 5 minutes after login', () => {
    expect(withinLoginGrace(String(NOW - 1000), NOW)).toBe(true);
    expect(withinLoginGrace(NOW - (LOGIN_GRACE_MS - 1), NOW)).toBe(true);
  });
  it('expires at exactly 5 minutes', () => {
    expect(withinLoginGrace(String(NOW - LOGIN_GRACE_MS), NOW)).toBe(false);
  });
  it('ignores missing / garbage / future timestamps', () => {
    expect(withinLoginGrace(null, NOW)).toBe(false);
    expect(withinLoginGrace('', NOW)).toBe(false);
    expect(withinLoginGrace('abc', NOW)).toBe(false);
    expect(withinLoginGrace(String(NOW + 60_000), NOW)).toBe(false);
  });
});

describe('runSessionCheck', () => {
  it('does nothing for admins / signed-out', async () => {
    const d = makeDeps({ getSession: jest.fn(() => ({ userId: 'a', roleId: 1 })) });
    expect(await runSessionCheck(d)).toBe('not-watched');
    expect(d.checkSession).not.toHaveBeenCalled();
    const d2 = makeDeps({ getSession: jest.fn(() => null) });
    expect(await runSessionCheck(d2)).toBe('not-watched');
  });

  it('skips the check inside the 5-minute post-login grace window', async () => {
    const d = makeDeps({ readLastLoginAt: jest.fn(async () => String(NOW - 60_000)) });
    expect(await runSessionCheck(d)).toBe('grace');
    expect(d.checkSession).not.toHaveBeenCalled();
  });

  it('checks with the session user and device token after the grace window', async () => {
    const d = makeDeps({ readLastLoginAt: jest.fn(async () => String(NOW - LOGIN_GRACE_MS - 1)) });
    expect(await runSessionCheck(d)).toBe('ok');
    expect(d.checkSession).toHaveBeenCalledWith('u1', 'dev-1');
    expect(d.signOut).not.toHaveBeenCalled();
  });

  it('signs out with reason forced when the server says force_logout', async () => {
    const d = makeDeps({ checkSession: jest.fn(async () => ({ valid: false, forceLogout: true, reason: 'logged_in_on_another_device' })) });
    expect(await runSessionCheck(d)).toBe('forced');
    expect(d.signOut).toHaveBeenCalledWith({ reason: 'forced' });
  });

  it('fails open when the check throws', async () => {
    const d = makeDeps({
      checkSession: jest.fn(async () => {
        throw new Error('network');
      }),
    });
    expect(await runSessionCheck(d)).toBe('error');
    expect(d.signOut).not.toHaveBeenCalled();
  });

  it('does not sign out a different user who signed in while the check was in flight', async () => {
    let current: { userId: string; roleId: number; deviceToken: string } = staff;
    const d = makeDeps({
      getSession: jest.fn(() => current),
      checkSession: jest.fn(async () => {
        current = { userId: 'u2', roleId: 3, deviceToken: 'dev-2' };
        return { valid: false, forceLogout: true };
      }),
    });
    expect(await runSessionCheck(d)).toBe('stale');
    expect(d.signOut).not.toHaveBeenCalled();
  });

  it('does not sign out when the user signed out meanwhile', async () => {
    let current: typeof staff | null = staff;
    const d = makeDeps({
      getSession: jest.fn(() => current),
      checkSession: jest.fn(async () => {
        current = null;
        return { valid: false, forceLogout: true };
      }),
    });
    expect(await runSessionCheck(d)).toBe('stale');
    expect(d.signOut).not.toHaveBeenCalled();
  });
});

describe('isForceLogoutPush', () => {
  it('applies to roles 2/3 only and only for type force_logout', () => {
    expect(isForceLogoutPush({ type: 'force_logout' }, staff)).toBe(true);
    expect(isForceLogoutPush({ type: 'force_logout' }, { userId: 'a', roleId: 1 })).toBe(false);
    expect(isForceLogoutPush({ type: 'new_message' }, staff)).toBe(false);
    expect(isForceLogoutPush(undefined, staff)).toBe(false);
    expect(isForceLogoutPush({ type: 'force_logout' }, null)).toBe(false);
  });
});
