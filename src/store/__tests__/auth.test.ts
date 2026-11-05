import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError } from '@/lib/api/errors';
import { queryClient } from '@/lib/query/queryClient';
import { STORAGE_KEYS, getString, setString, storageKeyFor } from '@/lib/storage';

import {
  ACCESS_DENIED_ADMIN,
  ACCESS_DENIED_STAFF,
  TEARDOWN_TIMEOUT_MS,
  getLastLoginAt,
  getLastOrg,
  getSession,
  hasPermission,
  logoFromLogin,
  patchSession,
  registerTeardown,
  sanitizeSession,
  sessionFromAdminLogin,
  sessionFromRegistration,
  sessionFromStaffLogin,
  setLastOrg,
  signIn,
  signOut,
  useAuthStore,
  type Session,
} from '../auth';
import { badges } from '../badges';
import { useUiStore } from '../ui';

const adminSession: Session = {
  userId: 'admin-1',
  orgId: 'org-1',
  orgName: 'Acme',
  roleId: 1,
  email: 'a@b.co',
  managerPermissions: [],
  planId: 2,
  isFreeTrial: false,
  freeTrialEnd: null,
};

const staffSession: Session = {
  userId: 'staff-1',
  orgId: 'org-1',
  orgName: 'Acme',
  roleId: 3,
  managerPermissions: [],
  deviceToken: 'dev-tok',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  useAuthStore.setState({ session: null });
  useUiStore.getState().clearSignOutNotice();
  badges.reset();
  queryClient.clear();
});

describe('sanitizeSession', () => {
  it('accepts a complete session', () => {
    expect(sanitizeSession(adminSession)).toEqual(adminSession);
  });
  it('defaults orgId to userId and fills arrays', () => {
    expect(sanitizeSession({ userId: 'u1', roleId: 3 })).toEqual({
      userId: 'u1',
      orgId: 'u1',
      orgName: '',
      roleId: 3,
      managerPermissions: [],
    });
  });
  it('coerces numeric strings and plan ids', () => {
    const s = sanitizeSession({ userId: 'u1', roleId: '2', planId: '3' });
    expect(s?.roleId).toBe(2);
    expect(s?.planId).toBe(3);
    expect(sanitizeSession({ userId: 'u1', roleId: 1, planId: 'abc' })?.planId).toBeNull();
    expect(sanitizeSession({ userId: 'u1', roleId: 1, planId: null })?.planId).toBeNull();
  });
  it('rejects unusable sessions', () => {
    expect(sanitizeSession(null)).toBeNull();
    expect(sanitizeSession('x')).toBeNull();
    expect(sanitizeSession({})).toBeNull();
    expect(sanitizeSession({ userId: '', roleId: 1 })).toBeNull();
    expect(sanitizeSession({ userId: 'u', roleId: 9 })).toBeNull();
    expect(sanitizeSession({ roleId: 1 })).toBeNull();
  });
  it('drops garbage manager permissions', () => {
    expect(sanitizeSession({ userId: 'u', roleId: 2, managerPermissions: ['a', 3, null, 'b'] })?.managerPermissions).toEqual(['a', 'b']);
  });
});

describe('sessionFromAdminLogin', () => {
  const res = {
    success: true,
    user_id: 'admin-1',
    email: 'a@b.co',
    org_name: 'Acme',
    org_id: 'org-9',
    role_id: 1,
    org_logo: 'https://logo',
    plan_id: '2',
    is_free_trial: false,
    free_trial_end: '2025-03-01',
    redirect: 'home',
  };
  it('maps the admin body', () => {
    expect(sessionFromAdminLogin(res)).toEqual({
      userId: 'admin-1',
      orgId: 'org-9',
      orgName: 'Acme',
      roleId: 1,
      email: 'a@b.co',
      managerPermissions: [],
      planId: 2,
      isFreeTrial: false,
      freeTrialEnd: '2025-03-01',
    });
  });
  it('falls back to current_org_id then user_id for the org', () => {
    expect(sessionFromAdminLogin({ ...res, org_id: undefined, current_org_id: 'cur-1' }).orgId).toBe('cur-1');
    expect(sessionFromAdminLogin({ ...res, org_id: null }).orgId).toBe('admin-1');
  });
  it('applies the last-org override (admins only)', () => {
    const s = sessionFromAdminLogin(res, { orgOverride: { orgId: 'org-2', orgName: 'Second Co' } });
    expect(s.orgId).toBe('org-2');
    expect(s.orgName).toBe('Second Co');
    expect(sessionFromAdminLogin(res, { orgOverride: { orgId: 'org-2' } }).orgName).toBe('Acme');
  });
  it('handles trial / missing plan data', () => {
    const s = sessionFromAdminLogin({ ...res, plan_id: null, is_free_trial: true, free_trial_end: undefined });
    expect(s.planId).toBeNull();
    expect(s.isFreeTrial).toBe(true);
    expect(s.freeTrialEnd).toBeNull();
  });
  it('validates the role BEFORE a session exists', () => {
    expect(() => sessionFromAdminLogin({ ...res, role_id: 3 })).toThrow(ACCESS_DENIED_ADMIN);
    expect(() => sessionFromAdminLogin({ ...res, role_id: 2 })).toThrow(ApiError);
    expect(getSession()).toBeNull();
  });
  it('surfaces success:false and malformed bodies', () => {
    expect(() => sessionFromAdminLogin({ success: false, message: 'User not found' })).toThrow('User not found');
    expect(() => sessionFromAdminLogin({ success: true })).toThrow('Login failed');
  });
  it('never carries a device token for admins', () => {
    expect(sessionFromAdminLogin(res, { deviceToken: 'x' }).deviceToken).toBeUndefined();
  });
});

describe('sessionFromStaffLogin', () => {
  const res = { success: true, user_id: 'staff-1', org_name: 'Acme', org_id: 'org-1', role_id: 3, org_logo: null };
  it('maps staff and attaches the device token', () => {
    expect(sessionFromStaffLogin(res, { deviceToken: 'tok' })).toEqual({
      userId: 'staff-1',
      orgId: 'org-1',
      orgName: 'Acme',
      roleId: 3,
      managerPermissions: [],
      deviceToken: 'tok',
    });
  });
  it('keeps manager permissions for role 2 only', () => {
    const perms = ['Staff Management', 'Attendance Reports'];
    expect(sessionFromStaffLogin({ ...res, role_id: 2, manager_permissions: perms }).managerPermissions).toEqual(perms);
    expect(sessionFromStaffLogin({ ...res, role_id: 3, manager_permissions: perms }).managerPermissions).toEqual([]);
  });
  it('does not carry plan fields (plan comes from the plan-status query)', () => {
    const s = sessionFromStaffLogin({ ...res, plan_id: 3 } as never);
    expect(s.planId).toBeUndefined();
  });
  it('rejects admins on the staff portal', () => {
    expect(() => sessionFromStaffLogin({ ...res, role_id: 1 })).toThrow(ACCESS_DENIED_STAFF);
  });
  it('ignores an org override', () => {
    expect(sessionFromStaffLogin(res, { orgOverride: { orgId: 'other' } }).orgId).toBe('org-1');
  });
});

describe('registration / logo helpers', () => {
  it('sessionFromRegistration', () => {
    expect(sessionFromRegistration({ userId: 'u1', orgName: 'New Co', orgId: 'o1' })).toEqual({
      userId: 'u1',
      orgId: 'o1',
      orgName: 'New Co',
      roleId: 1,
      managerPermissions: [],
    });
    expect(sessionFromRegistration({ userId: 'u1', orgName: 'New Co' }).orgId).toBe('u1');
    expect(() => sessionFromRegistration({ userId: '', orgName: 'x' })).toThrow(ApiError);
  });
  it('logoFromLogin', () => {
    expect(logoFromLogin({ org_logo: 'https://l' })).toBe('https://l');
    expect(logoFromLogin({ org_logo: null })).toBeNull();
    expect(logoFromLogin({})).toBeNull();
  });
});

describe('hasPermission', () => {
  it('admins have all, managers only granted, staff none', () => {
    expect(hasPermission(adminSession, 'anything')).toBe(true);
    expect(hasPermission({ ...adminSession, roleId: 2, managerPermissions: ['Reports'] }, 'Reports')).toBe(true);
    expect(hasPermission({ ...adminSession, roleId: 2, managerPermissions: ['Reports'] }, 'Payroll')).toBe(false);
    expect(hasPermission(staffSession, 'Reports')).toBe(false);
    expect(hasPermission(null, 'Reports')).toBe(false);
  });
});

describe('signIn / patchSession', () => {
  it('stores the session and the login time', async () => {
    const before = Date.now();
    signIn(staffSession);
    expect(getSession()).toEqual(staffSession);
    await new Promise((r) => setTimeout(r, 0));
    const at = await getLastLoginAt();
    expect(at).toBeGreaterThanOrEqual(before);
  });
  it('persists the session under the auth key', async () => {
    signIn(adminSession);
    await new Promise((r) => setTimeout(r, 10));
    const raw = await getString(STORAGE_KEYS.auth);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).state.session.userId).toBe('admin-1');
    expect(JSON.parse(raw as string).state.hydrated).toBeUndefined();
  });
  it('rejects an invalid session', () => {
    expect(() => signIn({ ...staffSession, userId: '' })).toThrow('Invalid session');
    expect(getSession()).toBeNull();
  });
  it('remembers the admin org on sign-in and when switching company', async () => {
    signIn(adminSession);
    await new Promise((r) => setTimeout(r, 0));
    expect(await getLastOrg('admin-1')).toBe('org-1');
    patchSession({ orgId: 'org-2', orgName: 'Second' });
    await new Promise((r) => setTimeout(r, 0));
    expect(getSession()).toMatchObject({ orgId: 'org-2', orgName: 'Second', userId: 'admin-1' });
    expect(await getLastOrg('admin-1')).toBe('org-2');
  });
  it('patchSession merges, validates and is a no-op when signed out', () => {
    patchSession({ planId: 3 });
    expect(getSession()).toBeNull();
    signIn(staffSession);
    patchSession({ isActive: 0, name: 'Ravi' });
    expect(getSession()).toMatchObject({ isActive: 0, name: 'Ravi', userId: 'staff-1' });
    patchSession({ roleId: 9 as never });
    expect(getSession()?.roleId).toBe(3);
  });
  it('switching accounts without sign-out purges the previous user data', () => {
    signIn(staffSession);
    queryClient.setQueryData(['x', 'staff-1'], { secret: true });
    badges.increment('crm', 3);
    signIn({ ...staffSession, userId: 'staff-2' });
    expect(queryClient.getQueryData(['x', 'staff-1'])).toBeUndefined();
    expect(badges.get().crm).toBe(0);
  });
  it('clears a pending sign-out notice', () => {
    useUiStore.getState().setSignOutNotice('forced');
    signIn(staffSession);
    expect(useUiStore.getState().signOutNotice).toBeNull();
  });
});

describe('signOut', () => {
  beforeEach(() => {
    signIn(staffSession);
  });

  it('runs teardowns with context, then clears session, badges, query cache and persisted data', async () => {
    const order: string[] = [];
    const teardown = jest.fn(async (ctx: { reason: string; session: Session | null }) => {
      order.push(`teardown:${ctx.session?.userId}:${ctx.reason}:${getSession() ? 'session-present' : 'session-gone'}`);
    });
    const off = registerTeardown(teardown);
    queryClient.setQueryData(['chat', 'staff-1'], [1]);
    badges.increment('crm', 2);
    await setString(storageKeyFor(STORAGE_KEYS.crmSeenLeadIds, 'staff-1'), '[1]');
    await setString(STORAGE_KEYS.pushToken, 'push');
    await setString(storageKeyFor(STORAGE_KEYS.deviceToken, '9876543210'), 'device');
    await setString(STORAGE_KEYS.themePreference, 'dark');

    await signOut({ reason: 'logout' });
    off();

    expect(order).toEqual(['teardown:staff-1:logout:session-present']); // teardown runs while the session is still readable
    expect(getSession()).toBeNull();
    expect(badges.get().crm).toBe(0);
    expect(queryClient.getQueryData(['chat', 'staff-1'])).toBeUndefined();
    expect(await getString(STORAGE_KEYS.auth)).toBeNull();
    expect(await getString(storageKeyFor(STORAGE_KEYS.crmSeenLeadIds, 'staff-1'))).toBeNull();
    expect(await getString(STORAGE_KEYS.pushToken)).toBeNull();
    expect(await getString(STORAGE_KEYS.lastLoginAt)).toBeNull();
    // preserved
    expect(await getString(storageKeyFor(STORAGE_KEYS.deviceToken, '9876543210'))).toBe('device');
    expect(await getString(STORAGE_KEYS.themePreference)).toBe('dark');
  });

  it('preserves lastOrg per user', async () => {
    patchSession({ orgId: 'org-77' });
    await signOut();
    expect(await getLastOrg('staff-1')).toBe('org-77');
    await setLastOrg('other', 'o2');
    expect(await getLastOrg('other')).toBe('o2');
    expect(await getLastOrg('nobody')).toBeNull();
  });

  it('records why the user was signed out (forced / deleted show a notice, logout does not)', async () => {
    await signOut({ reason: 'forced' });
    expect(useUiStore.getState().signOutNotice).toBe('forced');
    signIn(staffSession);
    await signOut({ reason: 'logout' });
    expect(useUiStore.getState().signOutNotice).toBeNull();
    signIn(staffSession);
    await signOut({ reason: 'deleted' });
    expect(useUiStore.getState().signOutNotice).toBe('deleted');
  });

  it('a failing teardown does not block sign-out; the others still run', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ok = jest.fn();
    const offs = [
      registerTeardown(() => {
        throw new Error('boom');
      }),
      registerTeardown(async () => {
        throw new Error('async boom');
      }),
      registerTeardown(ok),
    ];
    await signOut();
    offs.forEach((o) => o());
    expect(ok).toHaveBeenCalledTimes(1);
    expect(getSession()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('a hanging teardown is time-boxed', async () => {
    jest.useFakeTimers();
    try {
      const off = registerTeardown(() => new Promise<void>(() => undefined));
      let done = false;
      const p = signOut().then(() => {
        done = true;
      });
      await jest.advanceTimersByTimeAsync(TEARDOWN_TIMEOUT_MS - 100);
      expect(done).toBe(false);
      await jest.advanceTimersByTimeAsync(200);
      await p;
      off();
      expect(done).toBe(true);
      expect(getSession()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('concurrent calls share one run (session poll + push force_logout)', async () => {
    const teardown = jest.fn();
    const off = registerTeardown(teardown);
    const a = signOut({ reason: 'forced' });
    const b = signOut({ reason: 'forced' });
    expect(a).toBe(b);
    await Promise.all([a, b]);
    off();
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('is safe when already signed out and can run again later', async () => {
    await signOut();
    await expect(signOut()).resolves.toBeUndefined();
    signIn(staffSession);
    await signOut();
    expect(getSession()).toBeNull();
  });

  it('unregistered teardowns are not called', async () => {
    const fn = jest.fn();
    registerTeardown(fn)();
    await signOut();
    expect(fn).not.toHaveBeenCalled();
  });

  it('teardown receives the signed-out session (e.g. to stop tracking for that user)', async () => {
    let seen: Session | null = null;
    const off = registerTeardown((ctx) => {
      seen = ctx.session;
    });
    await signOut();
    off();
    expect(seen).toEqual(staffSession);
  });
});

describe('hydration', () => {
  it('a corrupt persisted blob still ends hydration with no session', async () => {
    useAuthStore.setState({ hydrated: false }); // (state writes go to storage, so seed the blob afterwards)
    await AsyncStorage.setItem(STORAGE_KEYS.auth, '{not json');
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().hydrated).toBe(true);
    expect(getSession()).toBeNull();
  });

  it('sanitises a persisted session (drops invalid role)', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.auth,
      JSON.stringify({ state: { session: { userId: 'u1', roleId: 7 } }, version: 1 }),
    );
    await useAuthStore.persist.rehydrate();
    expect(getSession()).toBeNull();
  });

  it('restores a valid persisted session', async () => {
    useAuthStore.setState({ hydrated: false });
    await AsyncStorage.setItem(
      STORAGE_KEYS.auth,
      JSON.stringify({ state: { session: { userId: 'u1', orgId: 'o1', orgName: 'Co', roleId: 2, managerPermissions: ['x'] } }, version: 1 }),
    );
    await useAuthStore.persist.rehydrate();
    expect(getSession()).toEqual({ userId: 'u1', orgId: 'o1', orgName: 'Co', roleId: 2, managerPermissions: ['x'] });
    expect(useAuthStore.getState().hydrated).toBe(true);
  });
});
