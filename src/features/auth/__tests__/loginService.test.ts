import { ApiError } from '@/lib/api/errors';
import type { LoginResult } from '@/types/api/auth';

import { loginAndBuildSession, warmHomeQueries, type LoginDeps } from '../utils/loginService';

jest.mock('@/lib/platform/notifications', () => ({ registerForPush: jest.fn().mockResolvedValue(null) }));

function loginResult(raw: Record<string, unknown>): LoginResult {
  return { raw } as unknown as LoginResult;
}

const adminBody = { success: true, user_id: 'u1', org_id: 'orgA', org_name: 'Alpha', role_id: 1, email: 'a@x.io', plan_id: '2', is_free_trial: false, org_logo: 'https://cdn/logo.png' };
const staffBody = { success: true, user_id: 's1', org_id: 'orgA', org_name: 'Alpha', role_id: 3 };
const managerBody = { success: true, user_id: 'm1', org_id: 'orgA', org_name: 'Alpha', role_id: 2, manager_permissions: ['shifts', 'reports'] };

function deps(body: Record<string, unknown>, extra: Partial<LoginDeps> = {}): LoginDeps {
  return {
    login: jest.fn().mockResolvedValue(loginResult(body)),
    getLastOrg: jest.fn().mockResolvedValue(null),
    getCompanyDetails: jest.fn(),
    ...extra,
  } as unknown as LoginDeps;
}

describe('role gating (validated before anything is persisted)', () => {
  it('admin portal accepts role 1 only', async () => {
    const ok = await loginAndBuildSession('admin', '9876543210', {}, deps(adminBody));
    expect(ok.session).toMatchObject({ userId: 'u1', orgId: 'orgA', roleId: 1, planId: 2, isFreeTrial: false });
    expect(ok.session.deviceToken).toBeUndefined();
    expect(ok.logoUrl).toBe('https://cdn/logo.png');

    const d = deps(staffBody);
    await expect(loginAndBuildSession('admin', '9876543210', {}, d)).rejects.toMatchObject({ status: 403, detail: 'Access denied. Admin credentials required.' });
    // No extra lookups happen for a rejected role.
    expect(d.getLastOrg).not.toHaveBeenCalled();
    await expect(loginAndBuildSession('admin', '9876543210', {}, deps(managerBody))).rejects.toBeInstanceOf(ApiError);
  });

  it('staff portal accepts roles 2 and 3 only and keeps the device token', async () => {
    const staff = await loginAndBuildSession('staff', '9876543210', { deviceToken: 'dev-9' }, deps(staffBody));
    expect(staff.session).toMatchObject({ userId: 's1', roleId: 3, deviceToken: 'dev-9', managerPermissions: [] });

    const manager = await loginAndBuildSession('staff', '9876543210', { deviceToken: 'dev-9' }, deps(managerBody));
    expect(manager.session).toMatchObject({ roleId: 2, managerPermissions: ['shifts', 'reports'] });

    await expect(loginAndBuildSession('staff', '9876543210', {}, deps(adminBody))).rejects.toMatchObject({
      status: 403,
      detail: 'Access denied. Employee credentials required.',
    });
  });

  it('uses the employee lookup for the staff portal', async () => {
    const d = deps(staffBody);
    await loginAndBuildSession('staff', '9876543210', {}, d);
    expect(d.login).toHaveBeenCalledWith('9876543210', 'employee');
    const a = deps(adminBody);
    await loginAndBuildSession('admin', '9876543210', {}, a);
    expect(a.login).toHaveBeenCalledWith('9876543210', 'admin');
  });
});

describe('admin: restoring the last used company', () => {
  it('switches to the last company when it still exists', async () => {
    const d = deps(adminBody, {
      getLastOrg: jest.fn().mockResolvedValue('orgB'),
      getCompanyDetails: jest.fn().mockResolvedValue({ orgId: 'orgB', name: 'Beta' }),
    });
    const { session } = await loginAndBuildSession('admin', '9876543210', {}, d);
    expect(session).toMatchObject({ orgId: 'orgB', orgName: 'Beta', userId: 'u1' });
  });

  it('keeps the server company when the last one cannot be loaded', async () => {
    const d = deps(adminBody, {
      getLastOrg: jest.fn().mockResolvedValue('orgB'),
      getCompanyDetails: jest.fn().mockRejectedValue(new ApiError({ status: 404, detail: 'not found' })),
    });
    const { session } = await loginAndBuildSession('admin', '9876543210', {}, d);
    expect(session).toMatchObject({ orgId: 'orgA', orgName: 'Alpha' });
  });

  it('does not look the company up when it is the one the server returned', async () => {
    const getCompanyDetails = jest.fn();
    await loginAndBuildSession('admin', '9876543210', {}, deps(adminBody, { getLastOrg: jest.fn().mockResolvedValue('orgA'), getCompanyDetails }));
    expect(getCompanyDetails).not.toHaveBeenCalled();
  });
});

describe('warmHomeQueries', () => {
  it('prefetches the admin dashboard queries under org-scoped keys and swallows failures', () => {
    const prefetchQuery = jest.fn().mockRejectedValue(new Error('offline'));
    warmHomeQueries({ userId: 'u1', orgId: 'orgA', roleId: 1 }, { prefetchQuery } as never);
    const keys = prefetchQuery.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => k[1] === 'orgA')).toBe(true);
  });

  it('prefetches the personal home queries for staff', () => {
    const prefetchQuery = jest.fn().mockResolvedValue(undefined);
    warmHomeQueries({ userId: 's1', orgId: 'orgA', roleId: 3 }, { prefetchQuery } as never);
    const keys = prefetchQuery.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys.map((k) => k[0]).sort()).toEqual(['attendance', 'face']);
    expect(keys.every((k) => k[1] === 's1')).toBe(true);
  });
});
