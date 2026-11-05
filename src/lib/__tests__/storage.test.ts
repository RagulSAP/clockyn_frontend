import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  STORAGE_KEYS,
  SESSION_SCOPED_KEYS,
  baseOfStorageKey,
  clearSessionStorage,
  getJSON,
  getString,
  keysWithPrefix,
  multiRemove,
  remove,
  setJSON,
  setString,
  storageKeyFor,
} from '../storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('STORAGE_KEYS', () => {
  it('every key is prefixed with @clockyn/ and unique', () => {
    const values = Object.values(STORAGE_KEYS);
    for (const v of values) expect(v.startsWith('@clockyn/')).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
  it('session-scoped keys are known keys', () => {
    const values: string[] = Object.values(STORAGE_KEYS);
    for (const k of SESSION_SCOPED_KEYS) expect(values).toContain(k);
  });
  it('device token and last org survive sign-out', () => {
    expect(SESSION_SCOPED_KEYS).not.toContain(STORAGE_KEYS.deviceToken);
    expect(SESSION_SCOPED_KEYS).not.toContain(STORAGE_KEYS.lastOrg);
  });
});

describe('storageKeyFor / baseOfStorageKey', () => {
  it('scopes keys', () => {
    expect(storageKeyFor(STORAGE_KEYS.lastOrg, 'u1')).toBe('@clockyn/last-org:u1');
    expect(storageKeyFor(STORAGE_KEYS.lastOrg, 42)).toBe('@clockyn/last-org:42');
    expect(storageKeyFor(STORAGE_KEYS.lastOrg, null)).toBe(STORAGE_KEYS.lastOrg);
    expect(storageKeyFor(STORAGE_KEYS.lastOrg, '  ')).toBe(STORAGE_KEYS.lastOrg);
  });
  it('recovers the base', () => {
    expect(baseOfStorageKey('@clockyn/last-org:u1')).toBe('@clockyn/last-org');
    expect(baseOfStorageKey('@clockyn/last-org')).toBe('@clockyn/last-org');
    expect(baseOfStorageKey('@clockyn/plan-popup-shown:2025-01-01:org')).toBe('@clockyn/plan-popup-shown');
  });
});

describe('get / set helpers', () => {
  it('round-trips JSON', async () => {
    expect(await setJSON('@clockyn/t', { a: 1 })).toBe(true);
    expect(await getJSON<{ a: number }>('@clockyn/t')).toEqual({ a: 1 });
  });
  it('returns the fallback for missing / corrupt values', async () => {
    expect(await getJSON('@clockyn/missing')).toBeNull();
    expect(await getJSON('@clockyn/missing', [])).toEqual([]);
    await AsyncStorage.setItem('@clockyn/bad', '{oops');
    expect(await getJSON('@clockyn/bad', 'fb')).toBe('fb');
  });
  it('strings, remove, multiRemove', async () => {
    await setString('@clockyn/s', 'x');
    expect(await getString('@clockyn/s')).toBe('x');
    expect(await remove('@clockyn/s')).toBe(true);
    expect(await getString('@clockyn/s')).toBeNull();
    await setString('@clockyn/a', '1');
    await setString('@clockyn/b', '2');
    expect(await multiRemove(['@clockyn/a', '@clockyn/b'])).toBe(true);
    expect(await getString('@clockyn/a')).toBeNull();
    expect(await multiRemove([])).toBe(true);
  });
  it('swallows storage failures', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    expect(await getString('@clockyn/x')).toBeNull();
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    expect(await setJSON('@clockyn/x', 1)).toBe(false);
  });
  it('keysWithPrefix', async () => {
    await setString('@clockyn/img/a', '1');
    await setString('@clockyn/img/b', '2');
    await setString('@clockyn/other', '3');
    expect((await keysWithPrefix(STORAGE_KEYS.imageCachePrefix)).sort()).toEqual(['@clockyn/img/a', '@clockyn/img/b']);
  });
});

describe('clearSessionStorage', () => {
  it('removes session-scoped keys (incl. scoped variants) and keeps preserved ones', async () => {
    await setString(STORAGE_KEYS.auth, '{}');
    await setString(storageKeyFor(STORAGE_KEYS.crmSeenLeadIds, 'u1'), '[]');
    await setString(storageKeyFor(STORAGE_KEYS.generatedReports, 'org1'), '[]');
    await setString(STORAGE_KEYS.pushToken, 't');
    await setString(storageKeyFor(STORAGE_KEYS.deviceToken, '9876543210'), 'tok');
    await setString(storageKeyFor(STORAGE_KEYS.lastOrg, 'u1'), 'org2');
    await setString(STORAGE_KEYS.themePreference, 'dark');
    await setString('unrelated-key', 'keep');
    expect(await clearSessionStorage()).toBe(true);
    const left = (await AsyncStorage.getAllKeys()).slice().sort();
    expect(left).toEqual(
      ['@clockyn/device-token:9876543210', '@clockyn/last-org:u1', '@clockyn/theme-preference', 'unrelated-key'].sort(),
    );
  });
});
