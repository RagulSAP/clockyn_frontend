import type { PermissionDetail, PermissionKind } from '@/lib/platform/permissions';

import { runPunchChecks, type PunchCheckDeps } from '../punchFlow';

const granted: PermissionDetail = { status: 'granted', canAskAgain: true };
const denied: PermissionDetail = { status: 'denied', canAskAgain: true };
const blocked: PermissionDetail = { status: 'denied', canAskAgain: false };

function makeDeps(over: Partial<PunchCheckDeps> = {}, calls: string[] = []): PunchCheckDeps {
  return {
    userId: 'u1',
    planBlocked: false,
    planMessage: 'Your plan has expired. Please contact your admin.',
    faceRegistered: true,
    isPunchedIn: false,
    getPermission: jest.fn(async (k: PermissionKind) => {
      calls.push(`perm:${k}`);
      return granted;
    }),
    requestPermission: jest.fn(async (k: PermissionKind) => {
      calls.push(`request:${k}`);
      return true;
    }),
    getPosition: jest.fn(async () => {
      calls.push('gps');
      return { latitude: 12.9, longitude: 77.6 };
    }),
    checkLocation: jest.fn(async () => {
      calls.push('geofence');
      return { allowed: true, message: 'Location check passed' };
    }),
    errorMessage: (e) => (e instanceof Error ? e.message : 'failed'),
    ...over,
  };
}

describe('runPunchChecks order', () => {
  it('1. a missing user stops everything', async () => {
    const deps = makeDeps({ userId: '' });
    expect(await runPunchChecks(deps)).toEqual({ kind: 'user-missing' });
    expect(deps.getPermission).not.toHaveBeenCalled();
  });

  it('2. the plan gate comes before the face / permission / GPS checks', async () => {
    const deps = makeDeps({ planBlocked: true, faceRegistered: false });
    expect(await runPunchChecks(deps)).toEqual({ kind: 'plan-blocked', message: 'Your plan has expired. Please contact your admin.' });
    expect(deps.getPermission).not.toHaveBeenCalled();
    expect(deps.getPosition).not.toHaveBeenCalled();
  });

  it('3. an unregistered face goes to registration without a geofence check', async () => {
    const calls: string[] = [];
    const deps = makeDeps({ faceRegistered: false }, calls);
    expect(await runPunchChecks(deps)).toEqual({ kind: 'register-face' });
    expect(deps.getPosition).not.toHaveBeenCalled();
    expect(deps.checkLocation).not.toHaveBeenCalled();
  });

  it('3b. registration with a permanently denied permission asks for the settings', async () => {
    const deps = makeDeps({
      faceRegistered: false,
      getPermission: jest.fn(async (k: PermissionKind) => (k === 'camera' ? blocked : granted)),
    });
    expect(await runPunchChecks(deps)).toEqual({ kind: 'register-permissions', permanentlyDenied: true });
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('3c. registration requests missing permissions and opens the camera when both are granted', async () => {
    let locGranted = false;
    const deps = makeDeps({
      faceRegistered: false,
      getPermission: jest.fn(async (k: PermissionKind) => (k === 'location' && !locGranted ? denied : granted)),
      requestPermission: jest.fn(async () => {
        locGranted = true;
        return true;
      }),
    });
    expect(await runPunchChecks(deps)).toEqual({ kind: 'register-face' });
    expect(deps.requestPermission).toHaveBeenCalledWith('location');
  });

  it('3d. registration with refused permissions reports a (non-permanent) denial', async () => {
    const deps = makeDeps({
      faceRegistered: false,
      getPermission: jest.fn(async () => denied),
      requestPermission: jest.fn(async () => false),
    });
    expect(await runPunchChecks(deps)).toEqual({ kind: 'register-permissions', permanentlyDenied: false });
  });

  it('4. permission -> GPS -> geofence run in that order, then the camera opens with the checked coordinates', async () => {
    const calls: string[] = [];
    const deps = makeDeps({}, calls);
    const result = await runPunchChecks(deps);
    expect(result).toEqual({ kind: 'proceed', action: 'punch_in', coords: { latitude: 12.9, longitude: 77.6 } });
    expect(calls).toEqual(['perm:location', 'gps', 'geofence']);
  });

  it('uses punch_out while punched in', async () => {
    const result = await runPunchChecks(makeDeps({ isPunchedIn: true }));
    expect(result).toMatchObject({ kind: 'proceed', action: 'punch_out' });
  });

  it('asks for the location permission first when it is not granted', async () => {
    const calls: string[] = [];
    const deps = makeDeps(
      { getPermission: jest.fn(async () => denied), requestPermission: jest.fn(async (k: PermissionKind) => { calls.push(`request:${k}`); return true; }) },
      calls,
    );
    await runPunchChecks(deps);
    expect(calls[0]).toBe('request:location');
  });

  it('GPS failure with the permission off -> location-required; with it on -> location-error', async () => {
    const noGps = async () => {
      throw new Error('no fix');
    };
    expect(await runPunchChecks(makeDeps({ getPermission: jest.fn(async () => denied), getPosition: noGps }))).toEqual({ kind: 'location-required' });
    expect(await runPunchChecks(makeDeps({ getPosition: noGps }))).toEqual({ kind: 'location-error' });
  });

  it('a geofence REQUEST failure is reported (v1 swallowed it) and does not open the camera', async () => {
    const result = await runPunchChecks(
      makeDeps({
        checkLocation: async () => {
          throw new Error('Network connection failed.');
        },
      }),
    );
    expect(result).toEqual({ kind: 'check-failed', message: 'Network connection failed.' });
  });

  it('outside the branch area shows the server message and does not open the camera', async () => {
    const result = await runPunchChecks(makeDeps({ checkLocation: async () => ({ allowed: false, message: 'You are 250m away from your branch.' }) }));
    expect(result).toEqual({ kind: 'outside-area', message: 'You are 250m away from your branch.' });
  });
});
