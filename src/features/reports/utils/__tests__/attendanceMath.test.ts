import { day, request } from '../../testing/fixtures';
import {
  bucketOf,
  computeAbsent,
  countHalfDays,
  countRequests,
  dayHours,
  formatHoursWorked,
  groupRequestsByUser,
  totalWorkedMinutes,
} from '../attendanceMath';

describe('hours worked', () => {
  it('reads DECIMAL hours from the backend without dropping the fraction (v1 split on ":")', () => {
    expect(dayHours(day({ totalHours: 7.75 }))).toBe(7.75);
    expect(totalWorkedMinutes([day({ totalHours: 7.75 }), day({ totalHours: 8.5 })])).toBe(975); // 16h 15m
    expect(formatHoursWorked(975)).toBe('16h 15m');
  });

  it('still understands a legacy HH:MM text', () => {
    const d = day({ totalHours: undefined, rawExtra: { total_hours: '08:30' } });
    expect(dayHours(d)).toBe(8.5);
    expect(formatHoursWorked(totalWorkedMinutes([d, d]))).toBe('17h 0m');
  });

  it('ignores missing / negative values and prints 0h when nothing was worked', () => {
    expect(dayHours(day({ totalHours: undefined }))).toBe(0);
    expect(dayHours(day({ totalHours: -3 }))).toBe(0);
    expect(formatHoursWorked(0)).toBe('0h');
    expect(totalWorkedMinutes([])).toBe(0);
  });

  it('sums decimals before rounding (3 x 0.33 h = 59.4 min -> 59 min, not 3 x 20)', () => {
    expect(totalWorkedMinutes([day({ totalHours: 0.33 }), day({ totalHours: 0.33 }), day({ totalHours: 0.33 })])).toBe(59);
  });
});

describe('absent days', () => {
  it('= workingDays − present − approved leave days', () => {
    expect(computeAbsent(26, 20, 3)).toBe(3);
  });
  it('is never negative', () => {
    expect(computeAbsent(10, 12, 3)).toBe(0);
  });
});

describe('half days', () => {
  it('counts only half_day statuses', () => {
    expect(countHalfDays([day({ status: 'half_day' }), day({ status: 'late' }), day({ status: 'half_day' })])).toBe(2);
  });
});

describe('status buckets', () => {
  it('treats anything but approved / rejected as pending', () => {
    expect(bucketOf('Approved')).toBe('approved');
    expect(bucketOf('rejected')).toBe('rejected');
    expect(bucketOf(undefined)).toBe('pending');
    expect(bucketOf('whatever')).toBe('pending');
  });
});

describe('request counters for a month (v1 rules)', () => {
  const leave = request({
    type: 'leave',
    dateStatuses: {
      '2026-10-03': { status: 'approved' },
      '2026-10-04': { status: 'rejected' },
      '2026-11-01': { status: 'approved' },
    },
  });

  it('counts leave per DATE inside the month; approved dates feed the Leave column', () => {
    const c = countRequests([leave], '2026-10');
    expect(c.leave).toEqual({ approved: 1, rejected: 1, pending: 0 });
    expect(c.approvedLeaveDays).toBe(1);
  });

  it('counts a permission once per REQUEST by the request-level status', () => {
    const permission = request({
      type: 'permission',
      status: 'approved',
      raw: { status: 'pending' },
      dateStatuses: { '2026-10-07': { status: 'approved' }, '2026-10-08': { status: 'approved' } },
    });
    expect(countRequests([permission], '2026-10').permission).toEqual({ approved: 0, rejected: 0, pending: 1 });
  });

  it('does not count a permission whose dates are outside the month or missing', () => {
    expect(countRequests([request({ type: 'permission', dateStatuses: { '2026-09-30': { status: 'approved' } } })], '2026-10').permission.approved).toBe(0);
    expect(countRequests([request({ type: 'permission' })], '2026-10').permission).toEqual({ approved: 0, rejected: 0, pending: 0 });
  });

  it('counts a shift change by shiftChangeDate and request status; missing status is pending', () => {
    const shift = request({ type: 'shift_change', shiftChangeDate: '2026-10-12', status: 'pending' });
    const other = request({ type: 'shift_change', shiftChangeDate: '2026-09-12', status: 'approved' });
    const c = countRequests([shift, other], '2026-10');
    expect(c.shift).toEqual({ approved: 0, rejected: 0, pending: 1 });
  });

  it('groups requests by user', () => {
    const map = groupRequestsByUser([request({ userId: 'a' }), request({ userId: 'b' }), request({ userId: 'a' }), request({ userId: undefined })]);
    expect(map.get('a')).toHaveLength(2);
    expect(map.get('b')).toHaveLength(1);
    expect(map.size).toBe(2);
  });
});
