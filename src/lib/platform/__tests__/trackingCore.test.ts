import { signIn, signOut, type Session } from '@/store/auth';

import { registerTrackingTeardown, resetUploadGate, uploadFixes } from '../trackingCore';

const session: Session = { userId: 'u1', orgId: 'org1', orgName: 'Acme', roleId: 3, managerPermissions: [], name: 'Asha' };
const fix = (t: number) => ({ latitude: 12.5, longitude: 77.5, timestamp: t });

beforeEach(() => resetUploadGate());

describe('uploadFixes', () => {
  it('posts user, org, coordinates and an ISO timestamp', async () => {
    const send = jest.fn(async () => undefined);
    const ok = await uploadFixes({ userId: 'u1', orgId: 'org1', send }, [fix(Date.UTC(2026, 9, 18, 4, 30))]);
    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ userId: 'u1', orgId: 'org1', latitude: 12.5, longitude: 77.5, timestamp: '2026-10-18T04:30:00.000Z' });
  });

  it('uses the user id as org id when there is none (v1: current_org_id || user_id)', async () => {
    const send = jest.fn(async () => undefined);
    await uploadFixes({ userId: 'u1', orgId: '', send }, [fix(1_000_000)]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'u1' }));
  });

  it('reports a 403 so the caller stops ALL tracking', async () => {
    const send = jest.fn(async () => {
      throw Object.assign(new Error('forbidden'), { status: 403 });
    });
    expect(await uploadFixes({ userId: 'u1', orgId: 'org1', send }, [fix(1_000_000)])).toBe(false);
  });

  it('drops other failures silently and keeps tracking', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const send = jest.fn(async () => {
      throw Object.assign(new Error('boom'), { status: 500 });
    });
    expect(await uploadFixes({ userId: 'u1', orgId: 'org1', send }, [fix(1_000_000)])).toBe(true);
    warn.mockRestore();
  });

  it('delivers a whole batch oldest first but throttles fixes that arrive faster than the 20 s cadence', async () => {
    const send = jest.fn(async () => undefined);
    await uploadFixes({ userId: 'u1', orgId: 'org1', send }, [fix(1_040_000), fix(1_000_000), fix(1_005_000), fix(1_021_000)]);
    const times = send.mock.calls.map((c) => (c as unknown as [{ timestamp: string }])[0].timestamp);
    expect(times).toEqual([new Date(1_000_000).toISOString(), new Date(1_021_000).toISOString(), new Date(1_040_000).toISOString()]);
  });
});

describe('sign-out teardown', () => {
  it('stops tracking when the user signs out (the platform layer registers its stop function)', async () => {
    const stop = jest.fn(async () => undefined);
    registerTrackingTeardown(stop);
    signIn(session);
    await signOut();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
