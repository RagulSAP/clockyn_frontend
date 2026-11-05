import { act, renderHook } from '@testing-library/react-native';

import { todayIST } from '@/lib/datetime';

import { useDashboardFilters } from '../useDashboardFilters';
import { isPlanActivation } from '../usePlanActivatedToast';

describe('useDashboardFilters', () => {
  it('starts on today (IST), all branches, department mode off', async () => {
    const { result } = await renderHook(() => useDashboardFilters('org-1'));
    expect(result.current).toMatchObject({ branchId: '', deptOn: false, date: todayIST(), today: todayIST() });
  });

  it('never allows a future date', async () => {
    const { result } = await renderHook(() => useDashboardFilters('org-1'));
    await act(async () => {
      result.current.setDate('2999-01-01');
    });
    expect(result.current.date).toBe(todayIST());
    await act(async () => {
      result.current.setDate('2026-01-05');
    });
    expect(result.current.date).toBe('2026-01-05');
  });

  it('pull-to-refresh resets the date to today', async () => {
    const { result } = await renderHook(() => useDashboardFilters('org-1'));
    await act(async () => {
      result.current.setDate('2026-01-05');
    });
    await act(async () => {
      result.current.resetDate();
    });
    expect(result.current.date).toBe(todayIST());
  });

  it('switching organisation resets branch and department mode but keeps the date', async () => {
    const { result, rerender } = await renderHook((p: { org: string }) => useDashboardFilters(p.org), { initialProps: { org: 'org-1' } });
    await act(async () => {
      result.current.setBranchId('b7');
      result.current.setDeptOn(true);
      result.current.setDate('2026-01-05');
    });
    expect(result.current).toMatchObject({ branchId: 'b7', deptOn: true, date: '2026-01-05' });

    await rerender({ org: 'org-2' });
    expect(result.current).toMatchObject({ branchId: '', deptOn: false, date: '2026-01-05' });

    await act(async () => {
      result.current.setBranchId('b9');
    });
    expect(result.current.branchId).toBe('b9');
  });
});

describe('isPlanActivation', () => {
  const trial = { planId: null, isExpired: false, isFreeTrial: true };
  const prime = { planId: 2, isExpired: false, isFreeTrial: false };
  const expired = { planId: 2, isExpired: true, isFreeTrial: false };
  it('fires when a trial or expired plan turns into an active paid plan', () => {
    expect(isPlanActivation(trial, prime)).toBe(true);
    expect(isPlanActivation(expired, prime)).toBe(true);
    expect(isPlanActivation({ planId: 1, isExpired: false, isFreeTrial: false }, prime)).toBe(true);
  });
  it('does not fire on the first status, an unchanged status, or a downgrade to expired', () => {
    expect(isPlanActivation(null, prime)).toBe(false);
    expect(isPlanActivation(prime, prime)).toBe(false);
    expect(isPlanActivation(prime, expired)).toBe(false);
  });
});
