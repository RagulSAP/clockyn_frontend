import AsyncStorage from '@react-native-async-storage/async-storage';

import { queryClient } from '@/lib/query/queryClient';
import { STORAGE_KEYS } from '@/lib/storage';

import {
  getAccessToken,
  patchSession,
  sanitizeSession,
  sessionFromAdminLogin,
  sessionFromRegistration,
  sessionFromStaffLogin,
  signIn,
  signOut,
  tokenFields,
  useAuthStore,
  type Session,
} from '../auth';
import { badges } from '../badges';
import { useUiStore } from '../ui';

const base: Session = { userId: 'u1', orgId: 'o1', orgName: 'Acme', roleId: 1, managerPermissions: [] };
const adminBody = { success: true, user_id: 'u1', org_id: 'o1', org_name: 'Acme', role_id: 1, plan_id: 2 };
const staffBody = { success: true, user_id: 's1', org_id: 'o1', org_name: 'Acme', role_id: 3 };

beforeEach(async () => {
  await AsyncStorage.clear();
  useAuthStore.setState({ session: null });
  useUiStore.getState().clearSignOutNotice();
  badges.reset();
  queryClient.clear();
});

describe('tokenFields', () => {
  it('computes the expiry from expires_in (seconds) and tolerates missing values', () => {
    expect(tokenFields('t', 60, 1_000)).toEqual({ accessToken: 't', tokenExpiresAt: 61_000 });
    expect(tokenFields('t', undefined)).toEqual({ accessToken: 't' });
    expect(tokenFields('t', 0)).toEqual({ accessToken: 't' });
    expect(tokenFields('  ', 60)).toEqual({});
    expect(tokenFields(undefined, 60)).toEqual({});
    expect(tokenFields(null, null)).toEqual({});
  });
});

describe('sanitizeSession keeps the token', () => {
  it('accessToken and tokenExpiresAt survive; junk is dropped; a session without a token stays valid', () => {
    expect(sanitizeSession({ ...base, accessToken: 'tok', tokenExpiresAt: 123 })).toMatchObject({ accessToken: 'tok', tokenExpiresAt: 123 });
    const s = sanitizeSession({ ...base, accessToken: '  ', tokenExpiresAt: 5 });
    expect(s).not.toHaveProperty('accessToken');
    expect(s).not.toHaveProperty('tokenExpiresAt');
    expect(sanitizeSession({ ...base, accessToken: 'tok', tokenExpiresAt: 'x' })).not.toHaveProperty('tokenExpiresAt');
    expect(sanitizeSession(base)).toEqual(base);
  });
});

describe('sessions built from login / registration carry the token', () => {
  it('admin / staff login: token from the OTP step (the lookup body has none)', () => {
    const now = Date.now();
    const admin = sessionFromAdminLogin(adminBody, { accessToken: 'tok-a', expiresIn: 3600 });
    expect(admin.accessToken).toBe('tok-a');
    expect(admin.tokenExpiresAt).toBeGreaterThanOrEqual(now + 3_600_000);
    const staff = sessionFromStaffLogin(staffBody, { deviceToken: 'dev', accessToken: 'tok-s' });
    expect(staff).toMatchObject({ deviceToken: 'dev', accessToken: 'tok-s' });
    expect(staff.tokenExpiresAt).toBeUndefined();
  });

  it('a body that carries the token itself (verify-device-token) is honoured; explicit options win', () => {
    expect(sessionFromStaffLogin({ ...staffBody, access_token: 'from-body', expires_in: 10 }).accessToken).toBe('from-body');
    expect(sessionFromStaffLogin({ ...staffBody, access_token: 'from-body' }, { accessToken: 'explicit' }).accessToken).toBe('explicit');
  });

  it('no token -> no token fields (older server)', () => {
    const s = sessionFromAdminLogin(adminBody);
    expect(s).not.toHaveProperty('accessToken');
    expect(s).not.toHaveProperty('tokenExpiresAt');
  });

  it('registration', () => {
    const s = sessionFromRegistration({ userId: 'a1', orgName: 'N', accessToken: 'tok-r', expiresIn: 100 });
    expect(s).toMatchObject({ userId: 'a1', roleId: 1, accessToken: 'tok-r' });
    expect(typeof s.tokenExpiresAt).toBe('number');
    expect(sessionFromRegistration({ userId: 'a1', orgName: 'N' })).not.toHaveProperty('accessToken');
  });
});

describe('persistence (same storage as the session)', () => {
  it('signIn stores the token inside the persisted auth blob and getAccessToken reads it', async () => {
    signIn({ ...base, accessToken: 'tok-p', tokenExpiresAt: 99 });
    expect(getAccessToken()).toBe('tok-p');
    await new Promise((r) => setTimeout(r, 0));
    const raw = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.auth)) as string) as { state: { session: Session } };
    expect(raw.state.session).toMatchObject({ userId: 'u1', accessToken: 'tok-p', tokenExpiresAt: 99 });
  });

  it('hydration restores it; a corrupt value is ignored without losing the session', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.auth, JSON.stringify({ state: { session: { ...base, accessToken: 'tok-h' } }, version: 1 }));
    await useAuthStore.persist.rehydrate();
    expect(getAccessToken()).toBe('tok-h');
    await AsyncStorage.setItem(STORAGE_KEYS.auth, JSON.stringify({ state: { session: { ...base, accessToken: 7 } }, version: 1 }));
    await useAuthStore.persist.rehydrate();
    expect(getAccessToken()).toBeUndefined();
    expect(useAuthStore.getState().session?.userId).toBe('u1');
  });

  it('patchSession keeps the token; signOut drops it', async () => {
    signIn({ ...base, accessToken: 'tok-k' });
    patchSession({ orgName: 'Renamed' });
    expect(getAccessToken()).toBe('tok-k');
    await signOut();
    expect(getAccessToken()).toBeUndefined();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('signOut with reason expired leaves no welcome-screen notice (the app shows a toast) and keeps the device token', async () => {
    await AsyncStorage.setItem(`${STORAGE_KEYS.deviceToken}:9876543210`, 'trusted');
    signIn({ ...base, accessToken: 'tok-x' });
    await signOut({ reason: 'expired' });
    expect(useUiStore.getState().signOutNotice).toBeNull();
    expect(await AsyncStorage.getItem(`${STORAGE_KEYS.deviceToken}:9876543210`)).toBe('trusted');
  });
});
