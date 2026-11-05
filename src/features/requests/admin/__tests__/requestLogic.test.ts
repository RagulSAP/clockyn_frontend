import {
  applyDecision,
  dateStatus,
  decisionCopy,
  decisionTargets,
  formatDatesLine,
  formatPermissionRange,
  groupPermissionsByDate,
  oppositeDecision,
  overallStatus,
  pendingRequestCount,
  sortNewestFirst,
} from '../utils/requestLogic';
import { decided, makeRequest } from '../testing/fixtures';

describe('overallStatus (leave)', () => {
  it('no dates -> the request status', () => {
    expect(overallStatus(makeRequest('leave', { status: 'approved' }))).toBe('approved');
  });
  it('all approved / all rejected', () => {
    const dates = ['2025-01-03', '2025-01-04'];
    expect(overallStatus(makeRequest('leave', { dates, dateStatuses: { [dates[0]]: decided('approved'), [dates[1]]: decided('approved') } }))).toBe('approved');
    expect(overallStatus(makeRequest('leave', { dates, dateStatuses: { [dates[0]]: decided('rejected'), [dates[1]]: decided('rejected') } }))).toBe('rejected');
  });
  it('any pending wins', () => {
    const dates = ['2025-01-03', '2025-01-04'];
    expect(overallStatus(makeRequest('leave', { dates, dateStatuses: { [dates[0]]: decided('approved'), [dates[1]]: decided('pending') } }))).toBe('pending');
  });
  it('mixed approved / rejected -> status of the first date', () => {
    const dates = ['2025-01-03', '2025-01-04'];
    const r = makeRequest('leave', { dates, dateStatuses: { [dates[0]]: decided('rejected'), [dates[1]]: decided('approved') } });
    expect(overallStatus(r)).toBe('rejected');
  });
  it('a date without a decision falls back to the request status', () => {
    const r = makeRequest('leave', { dates: ['2025-01-03'], status: 'pending' });
    expect(dateStatus(r, '2025-01-03')).toBe('pending');
  });
});

describe('pendingRequestCount', () => {
  it('counts requests, not dates; empty date statuses fall back to the status', () => {
    const d = ['2025-01-03', '2025-01-04'];
    const list = [
      makeRequest('leave', { id: 'a', dates: d, dateStatuses: { [d[0]]: decided('approved'), [d[1]]: decided('pending') } }),
      makeRequest('leave', { id: 'b', dates: d, dateStatuses: { [d[0]]: decided('approved'), [d[1]]: decided('approved') } }),
      makeRequest('leave', { id: 'c', status: 'pending' }),
      makeRequest('leave', { id: 'd', status: 'approved' }),
    ];
    expect(pendingRequestCount(list)).toBe(2);
  });
});

describe('formatDatesLine', () => {
  it('groups by month', () => {
    expect(formatDatesLine(['2025-02-01', '2025-01-07', '2025-01-03', '2025-01-04'])).toBe('03, 04, 07 Jan 2025 • 01 Feb 2025');
  });
  it('empty -> em dash, unparseable -> raw', () => {
    expect(formatDatesLine([])).toBe('—');
    expect(formatDatesLine(['x', 'y'])).toBe('x, y');
  });
});

describe('permission helpers', () => {
  it('formats the time range in 12 hours', () => {
    expect(formatPermissionRange('14:30', '16:00')).toBe('2:30 PM – 4:00 PM');
    expect(formatPermissionRange('00:15', '12:00')).toBe('12:15 AM – 12:00 PM');
    expect(formatPermissionRange('14:30', undefined)).toBe('2:30 PM – ');
  });
  it('one entry per request x date, newest date first, each with its own status', () => {
    const r = makeRequest('permission', { id: 'p1', dates: ['2025-01-05', '2025-01-07'], dateStatuses: { '2025-01-05': decided('approved'), '2025-01-07': decided('pending') } });
    const groups = groupPermissionsByDate([r]);
    expect(groups.map((g) => g.date)).toEqual(['2025-01-07', '2025-01-05']);
    expect(groups[0].entries[0].status).toBe('pending');
    expect(groups[1].entries[0].status).toBe('approved');
  });
  it('a request without dates renders no card', () => {
    expect(groupPermissionsByDate([makeRequest('permission')])).toEqual([]);
  });
});

describe('sortNewestFirst', () => {
  it('orders by createdAt desc with missing dates last (stable)', () => {
    const a = makeRequest('shift_change', { id: 'a', createdAt: '2025-01-01T00:00:00Z' });
    const b = makeRequest('shift_change', { id: 'b', createdAt: '2025-01-03T00:00:00Z' });
    const c = { ...makeRequest('shift_change', { id: 'c' }), createdAt: undefined };
    expect(sortNewestFirst([a, c, b]).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('decisions', () => {
  it('targets', () => {
    const leave = makeRequest('leave', { dates: ['2025-01-03', '2025-01-04'] });
    expect(decisionTargets('leave', leave)).toEqual(['2025-01-03', '2025-01-04']);
    // empty dates: ONE real call without a date (never a silent success)
    expect(decisionTargets('leave', makeRequest('leave'))).toEqual([undefined]);
    expect(decisionTargets('permission', makeRequest('permission'), '2025-01-05')).toEqual(['2025-01-05']);
    expect(decisionTargets('shift_change', makeRequest('shift_change'))).toEqual([undefined]);
    expect(decisionTargets('device_change', makeRequest('device_change'))).toEqual([undefined]);
  });
  it('opposite decision', () => {
    expect(oppositeDecision('approved')).toBe('rejected');
    expect(oppositeDecision('rejected')).toBe('approved');
    expect(oppositeDecision('pending')).toBe('approved');
  });
  it('verbatim copy', () => {
    expect(decisionCopy({ type: 'leave', status: 'approved', isChange: false, staffName: 'Asha', when: '03 Jan 2025' })).toEqual({
      title: 'Approve Leave',
      message: 'Approve leave for Asha on 03 Jan 2025?',
      confirmText: 'Approve',
      successMessage: 'Leave Approved',
    });
    expect(decisionCopy({ type: 'leave', status: 'rejected', isChange: true, staffName: 'Asha', when: '03 Jan 2025' }).message).toBe(
      'Change leave status for Asha on 03 Jan 2025 to rejected?',
    );
    const perm = decisionCopy({ type: 'permission', status: 'rejected', isChange: false, staffName: 'Asha', when: '05 Jan 2025' });
    expect(perm.title).toBe('Reject Request');
    expect(perm.message).toBe('Reject permission for Asha on 05 Jan 2025?');
    expect(perm.successMessage).toBe('Request Rejected');
    expect(decisionCopy({ type: 'shift_change', status: 'approved', isChange: false, staffName: 'Asha' }).message).toBe('Approve shift change for Asha?');
    const change = decisionCopy({ type: 'device_change', status: 'approved', isChange: true, staffName: 'Asha' });
    expect(change.title).toBe('Change to Approved');
    expect(change.message).toBe('Change device change status for Asha to approved?');
    expect(change.confirmText).toBe('Approve');
  });
  it('applyDecision stamps dates and the request status', () => {
    const d = ['2025-01-03', '2025-01-04'];
    const r = makeRequest('leave', { id: 'l1', dates: d, dateStatuses: { [d[0]]: decided('pending'), [d[1]]: decided('pending') } });
    const other = makeRequest('leave', { id: 'l2' });
    const all = applyDecision([r, other], { requestId: 'l1', status: 'approved', dates: d, actionBy: 'u1', at: 'now' });
    expect(all[0].status).toBe('approved');
    expect(all[0].dateStatuses[d[1]]).toMatchObject({ status: 'approved', actionBy: 'u1' });
    expect(all[1]).toBe(other);
    // permission: one date only, request status untouched while another date is pending
    const p = makeRequest('permission', { id: 'p1', dates: d, dateStatuses: { [d[0]]: decided('pending'), [d[1]]: decided('pending') } });
    const [pp] = applyDecision([p], { requestId: 'p1', status: 'approved', dates: [d[0]], actionBy: 'u1', at: 'now' });
    expect(pp.dateStatuses[d[0]].status).toBe('approved');
    expect(pp.dateStatuses[d[1]].status).toBe('pending');
    expect(pp.status).toBe('pending');
    // whole-request decision
    const [s] = applyDecision([makeRequest('shift_change', { id: 's1' })], { requestId: 's1', status: 'rejected', dates: [undefined], actionBy: 'u1', at: 'now' });
    expect(s.status).toBe('rejected');
  });
});
