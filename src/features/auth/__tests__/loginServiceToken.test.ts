import type { LoginResult } from '@/types/api/auth';

import { loginAndBuildSession, type LoginDeps } from '../utils/loginService';

jest.mock('@/lib/platform/notifications', () => ({ registerForPush: jest.fn().mockResolvedValue(null) }));

const raw = (body: Record<string, unknown>) => ({ raw: body }) as unknown as LoginResult;
const adminBody = { success: true, user_id: 'u1', org_id: 'orgA', org_name: 'Alpha', role_id: 1 };
const staffBody = { success: true, user_id: 's1', org_id: 'orgA', org_name: 'Alpha', role_id: 3 };

const deps = (body: Record<string, unknown>, extra: Partial<LoginDeps> = {}): LoginDeps =>
  ({ login: jest.fn().mockResolvedValue(raw(body)), getLastOrg: jest.fn().mockResolvedValue(null), getCompanyDetails: jest.fn(), ...extra }) as unknown as LoginDeps;

describe('loginAndBuildSession carries the token of the OTP / trusted-device step', () => {
  it('staff: token + expiry land in the session next to the device token', async () => {
    const { session } = await loginAndBuildSession('staff', '9876543210', { deviceToken: 'dev', accessToken: 'tok-s', expiresIn: 3600 }, deps(staffBody));
    expect(session).toMatchObject({ userId: 's1', deviceToken: 'dev', accessToken: 'tok-s' });
    expect(typeof session.tokenExpiresAt).toBe('number');
  });

  it('admin: token lands in the session, also when the last company is restored (and authorises that lookup)', async () => {
    const getCompanyDetails = jest.fn().mockResolvedValue({ orgId: 'orgB', name: 'Beta' });
    const { session } = await loginAndBuildSession(
      'admin',
      '9876543210',
      { accessToken: 'tok-a' },
      deps(adminBody, { getLastOrg: jest.fn().mockResolvedValue('orgB'), getCompanyDetails }),
    );
    expect(session).toMatchObject({ orgId: 'orgB', orgName: 'Beta', accessToken: 'tok-a' });
    expect(getCompanyDetails).toHaveBeenCalledWith('orgB', { accessToken: 'tok-a' });
  });

  it('no token (older server): session has none and the lookup call is unchanged', async () => {
    const getCompanyDetails = jest.fn().mockResolvedValue({ orgId: 'orgB', name: 'Beta' });
    const { session } = await loginAndBuildSession('admin', '9876543210', {}, deps(adminBody, { getLastOrg: jest.fn().mockResolvedValue('orgB'), getCompanyDetails }));
    expect(session).not.toHaveProperty('accessToken');
    expect(getCompanyDetails).toHaveBeenCalledWith('orgB', undefined);
  });
});
