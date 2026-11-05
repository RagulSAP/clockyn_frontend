import { renderHook } from '@testing-library/react-native';

import { startBackgroundTracking, startForegroundTracking, stopAllTracking } from '@/lib/platform/location';

import { useFieldTracking } from '../hooks/useFieldTracking';

jest.mock('@/lib/platform/location', () => ({
  startForegroundTracking: jest.fn(async () => true),
  startBackgroundTracking: jest.fn(async () => true),
  stopAllTracking: jest.fn(async () => undefined),
}));

const base = { isFieldStaff: true, userId: 'u1', orgId: 'org1', attendanceLoaded: true, isPunchedIn: true };

beforeEach(() => jest.clearAllMocks());

describe('useFieldTracking (field staff tracking while punched in)', () => {
  it('starts foreground + background tracking with the org scope when a field-staff member is punched in', async () => {
    await renderHook((p: typeof base) => useFieldTracking(p), { initialProps: base });
    expect(startForegroundTracking).toHaveBeenCalledWith({ userId: 'u1', orgId: 'org1' });
    expect(startBackgroundTracking).toHaveBeenCalledWith({ userId: 'u1', orgId: 'org1' });
    expect(stopAllTracking).not.toHaveBeenCalled();
  });

  it('falls back to the user id as org id (v1: current_org_id || user_id)', async () => {
    await renderHook((p: typeof base) => useFieldTracking(p), { initialProps: { ...base, orgId: '' } });
    expect(startForegroundTracking).toHaveBeenCalledWith({ userId: 'u1', orgId: 'u1' });
  });

  it('stops everything on punch-out', async () => {
    const { rerender } = await renderHook((p: typeof base) => useFieldTracking(p), { initialProps: base });
    await rerender({ ...base, isPunchedIn: false });
    expect(stopAllTracking).toHaveBeenCalledTimes(1);
  });

  it('does nothing for non field staff', async () => {
    await renderHook((p: typeof base) => useFieldTracking(p), { initialProps: { ...base, isFieldStaff: false } });
    expect(startForegroundTracking).not.toHaveBeenCalled();
    expect(stopAllTracking).not.toHaveBeenCalled();
  });

  it('waits for the first attendance response (a resumed tracker is not killed by the not-punched-in default)', async () => {
    const { rerender } = await renderHook((p: typeof base) => useFieldTracking(p), { initialProps: { ...base, attendanceLoaded: false, isPunchedIn: false } });
    expect(stopAllTracking).not.toHaveBeenCalled();
    await rerender({ ...base, attendanceLoaded: true, isPunchedIn: true });
    expect(startForegroundTracking).toHaveBeenCalledTimes(1);
  });

  it('leaving the screen (unmount) does not stop tracking', async () => {
    const { unmount } = await renderHook((p: typeof base) => useFieldTracking(p), { initialProps: base });
    await unmount();
    expect(stopAllTracking).not.toHaveBeenCalled();
  });
});
