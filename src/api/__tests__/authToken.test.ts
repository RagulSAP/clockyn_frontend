import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth';
import { resetApiConfig } from '@/lib/api/client';

import { LOGOUT_TIMEOUT_MS, logout } from '../auth';
import { mapDeviceVerifyResult, mapRegisterResult, mapVerifyOtpResult } from '../mappers/auth';

describe('mappers: access_token / expires_in', () => {
  it('mapVerifyOtpResult carries the token when the server issues one, nothing otherwise', () => {
    expect(mapVerifyOtpResult({ success: true, device_token: 'd', user_exists: true, role_id: 3, access_token: 'tok-1', expires_in: 7776000 })).toMatchObject({
      deviceToken: 'd',
      accessToken: 'tok-1',
      expiresIn: 7776000,
    });
    const none = mapVerifyOtpResult({ success: true, device_token: 'd', user_exists: false, role_id: null });
    expect(none).not.toHaveProperty('accessToken');
    expect(none).not.toHaveProperty('expiresIn');
  });

  it('expires_in is optional, numeric strings are accepted, nonsense is dropped', () => {
    expect(mapVerifyOtpResult({ access_token: 't' })).toMatchObject({ accessToken: 't' });
    expect(mapVerifyOtpResult({ access_token: 't' }).expiresIn).toBeUndefined();
    expect(mapVerifyOtpResult({ access_token: 't', expires_in: '3600' }).expiresIn).toBe(3600);
    expect(mapVerifyOtpResult({ access_token: 't', expires_in: 'soon' }).expiresIn).toBeUndefined();
    expect(mapVerifyOtpResult({ access_token: 't', expires_in: -5 }).expiresIn).toBeUndefined();
    expect(mapVerifyOtpResult({ access_token: '  ', expires_in: 60 })).not.toHaveProperty('accessToken');
  });

  it('mapDeviceVerifyResult: token only on the success path', () => {
    const ok = mapDeviceVerifyResult({ success: true, skip_otp: true, user_id: 'u', role_id: 3, access_token: 'tok-2', expires_in: 100 });
    expect(ok).toMatchObject({ skipOtp: true, accessToken: 'tok-2', expiresIn: 100 });
    const failed = mapDeviceVerifyResult({ success: false, device_mismatch: true, access_token: 'must-not-leak' });
    expect(failed).not.toHaveProperty('accessToken');
    expect(mapDeviceVerifyResult({ success: true, skip_otp: true, user_id: 'u', role_id: 3 })).not.toHaveProperty('accessToken');
  });

  it('mapRegisterResult carries the new admin token', () => {
    expect(mapRegisterResult({ success: true, user_id: 'a1', org_id: 'o1', org_name: 'N', role_id: 1, access_token: 'tok-3', expires_in: 9 })).toMatchObject({
      userId: 'a1',
      accessToken: 'tok-3',
      expiresIn: 9,
    });
    expect(mapRegisterResult({ success: true, user_id: 'a1' })).not.toHaveProperty('accessToken');
  });
});

describe('authApi.logout (best-effort)', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    resetApiConfig();
    useAuthStore.setState({
      session: { userId: 'u1', orgId: 'o1', orgName: 'A', roleId: 3, managerPermissions: [], accessToken: 'tok-9' },
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    useAuthStore.setState({ session: null });
  });

  it('POSTs /auth/logout with the body and the bearer token still attached', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{"success":true}' });
    await logout({ userId: 'u1', deviceToken: 'dev-1', pushToken: 'push-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${env.apiBaseUrl}/auth/logout`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ user_id: 'u1', device_token: 'dev-1', push_token: 'push-1' });
    expect(init.headers.Authorization).toBe('Bearer tok-9');
  });

  it('omits the optional fields it does not have', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    await logout({ userId: 'u1' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ user_id: 'u1' });
  });

  it('never throws: network failure, HTTP error and 401 are ignored', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(logout({ userId: 'u1' })).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => '{"detail":"x"}' });
    await expect(logout({ userId: 'u1' })).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => '{"detail":"Token expired"}' });
    await expect(logout({ userId: 'u1' })).resolves.toBeUndefined();
  });

  it('gives up after a short timeout instead of holding the sign-out', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const p = logout({ userId: 'u1' });
    await jest.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS + 10);
    await expect(p).resolves.toBeUndefined();
    expect(LOGOUT_TIMEOUT_MS).toBeLessThanOrEqual(3000);
  });
});
