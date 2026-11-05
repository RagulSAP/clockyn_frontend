import { interpretVersionCheck, isNewerVersion, pickStoreUrl } from '../appUpdateLogic';

const env = { androidStoreUrl: 'https://store.example/android', iosStoreUrl: 'https://store.example/ios' };

describe('isNewerVersion', () => {
  it('compares component-wise', () => {
    expect(isNewerVersion('1.0.10', '1.0.12')).toBe(true);
    expect(isNewerVersion('1.0.10', '1.1.0')).toBe(true);
    expect(isNewerVersion('1.0.10', '2.0.0')).toBe(true);
    expect(isNewerVersion('1.0.10', '1.0.10')).toBe(false);
    expect(isNewerVersion('1.0.10', '1.0.9')).toBe(false);
    expect(isNewerVersion('1.0', '1.0.1')).toBe(true);
    expect(isNewerVersion('1.0.1', '1.0')).toBe(false);
  });
});

describe('pickStoreUrl', () => {
  it('prefers the backend url, then env per platform, never a literal', () => {
    expect(pickStoreUrl('https://b', 'android', env)).toBe('https://b');
    expect(pickStoreUrl(null, 'android', env)).toBe(env.androidStoreUrl);
    expect(pickStoreUrl('', 'ios', env)).toBe(env.iosStoreUrl);
    expect(pickStoreUrl(null, 'web', env)).toBe('');
  });
});

describe('interpretVersionCheck', () => {
  const raw = { updateRequired: true, latestVersion: '1.2.0', forceUpdate: false, message: null, storeUrl: null };

  it('soft update', () => {
    expect(interpretVersionCheck(raw, '1.0.0', 'android', env)).toEqual({
      hasUpdate: true,
      latestVersion: '1.2.0',
      currentVersion: '1.0.0',
      storeUrl: env.androidStoreUrl,
      forceUpdate: false,
      message: '',
    });
  });

  it('forced update carries the backend message', () => {
    const r = interpretVersionCheck({ ...raw, forceUpdate: true, message: 'Please update' }, '1.0.0', 'ios', env);
    expect(r).toMatchObject({ hasUpdate: true, forceUpdate: true, message: 'Please update', storeUrl: env.iosStoreUrl });
  });

  it('ignores "required" when the installed version is already current, and never forces then', () => {
    const r = interpretVersionCheck({ ...raw, forceUpdate: true }, '1.2.0', 'android', env);
    expect(r.hasUpdate).toBe(false);
    expect(r.forceUpdate).toBe(false);
  });

  it('no update when the backend says none', () => {
    expect(interpretVersionCheck({ ...raw, updateRequired: false }, '1.0.0', 'android', env).hasUpdate).toBe(false);
  });
});
