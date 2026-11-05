import { badgeText, countPending, countUnread, sameIds } from '../utils/badgeLogic';
import { failureMessage, runDecision } from '../utils/runDecision';
import { seenScope, useSeenStore } from '../store/seenStore';
import { decided, makeRequest } from '../testing/fixtures';

const pendingLeave = (id: string) => makeRequest('leave', { id, status: 'pending' });

describe('pending / unread model', () => {
  it('counts pending per type and in total (unknown statuses never count)', () => {
    const d = ['2025-01-03', '2025-01-04'];
    const list = [
      pendingLeave('l1'),
      makeRequest('leave', { id: 'l2', dates: d, dateStatuses: { [d[0]]: decided('approved'), [d[1]]: decided('pending') } }),
      makeRequest('leave', { id: 'l3', status: 'approved' }),
      makeRequest('permission', { id: 'p1' }),
      makeRequest('shift_change', { id: 's1' }),
      makeRequest('device_change', { id: 'd1', status: 'rejected' }),
    ];
    expect(countPending(list)).toEqual({ leave: 2, permission: 1, shift_change: 1, device_change: 0, total: 4 });
  });

  it('everything is unread until the list of that type is opened', () => {
    const list = [pendingLeave('l1'), makeRequest('permission', { id: 'p1' })];
    expect(countUnread(list, undefined)).toMatchObject({ leave: 1, permission: 1, total: 2 });
    expect(countUnread(list, { leave: ['l1'] })).toMatchObject({ leave: 0, permission: 1, total: 1 });
  });

  it('new requests are never hidden after the admin handled others (v1 high-water mark bug)', () => {
    // Opened with 3 pending -> seen = a, b, c. Admin handles a and b.
    const seen = { leave: ['a', 'b', 'c'] };
    const afterHandling = [pendingLeave('c')];
    expect(countUnread(afterHandling, seen).leave).toBe(0);
    // Two new requests arrive: pending is 3 again, but only the new ones are unread.
    const afterArrival = [pendingLeave('c'), pendingLeave('d'), pendingLeave('e')];
    expect(countPending(afterArrival).leave).toBe(3);
    expect(countUnread(afterArrival, seen).leave).toBe(2);
  });

  it('seen store: marking works for every type, is scoped per org+user and replaces the set', () => {
    useSeenStore.getState().reset();
    const scope = seenScope('org1', 'u1');
    const { markSeen } = useSeenStore.getState();
    (['leave', 'permission', 'shift_change', 'device_change'] as const).forEach((t) => markSeen(scope, t, [`${t}-1`]));
    const s = useSeenStore.getState().seen;
    expect(s[scope].shift_change).toEqual(['shift_change-1']);
    expect(s[scope].device_change).toEqual(['device_change-1']);
    expect(s[seenScope('org2', 'u1')]).toBeUndefined();
    markSeen(scope, 'leave', []);
    expect(useSeenStore.getState().seen[scope].leave).toEqual([]);
  });

  it('helpers', () => {
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIds(undefined, [])).toBe(true);
    expect(sameIds(['a'], ['b'])).toBe(false);
    expect(badgeText(0)).toBeNull();
    expect(badgeText(7)).toBe('7');
    expect(badgeText(120)).toBe('99+');
  });
});

describe('runDecision', () => {
  const base = { requestId: 'r1', status: 'approved' as const, actionBy: 'u1', roleId: 1 };

  it('reports per-date results and keeps going after a failure', async () => {
    const update = jest.fn(async (input: { date?: string }) => {
      if (input.date === '2025-01-04') throw new Error('Date not found');
      return {};
    });
    const outcome = await runDecision(update, base, ['2025-01-03', '2025-01-04', '2025-01-05']);
    expect(update).toHaveBeenCalledTimes(3);
    expect(outcome.succeeded).toEqual(['2025-01-03', '2025-01-05']);
    expect(outcome.failed).toHaveLength(1);
    expect(failureMessage(outcome)).toBe('Updated 2 of 3 dates. Date not found');
  });

  it('total failure surfaces the server message; success has no message', async () => {
    const fail = await runDecision(async () => Promise.reject(new Error('Not allowed')), base, ['2025-01-03']);
    expect(failureMessage(fail)).toBe('Not allowed');
    const ok = await runDecision(async () => ({}), base, [undefined]);
    expect(failureMessage(ok)).toBe('');
  });
});
