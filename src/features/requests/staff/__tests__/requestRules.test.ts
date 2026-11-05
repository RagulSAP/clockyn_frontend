import { monthRange } from '@/lib/datetime';
import type { RequestCalendarDay, StaffRequest } from '@/types/api/requests';

import {
  MAX_PERMISSION_MINUTES,
  TIME_SLOTS,
  buildStatusMap,
  calendarRange,
  countPendingByType,
  dateBlockReason,
  endSlots,
  isPendingRequest,
  isSelectableDate,
  slotLabel,
  startSlots,
  sundaysOfMonth,
  toggleDate,
  validateDeviceReason,
  validateLeave,
  validatePermission,
  validateShiftChange,
} from '../utils/requestRules';

// 2026-10-14 is a Wednesday; 2026-10-18 and 2026-10-25 are Sundays.
const TODAY = '2026-10-14';

describe('dateBlockReason / isSelectableDate', () => {
  it('allows today and later weekdays', () => {
    expect(dateBlockReason(TODAY, TODAY, {})).toBeNull();
    expect(dateBlockReason('2026-10-15', TODAY, {})).toBeNull();
    expect(isSelectableDate('2026-12-30', TODAY, {})).toBe(true);
  });

  it('blocks past days', () => {
    expect(dateBlockReason('2026-10-13', TODAY, {})).toBe('past');
    expect(dateBlockReason('2025-01-01', TODAY, {})).toBe('past');
  });

  it('blocks Sundays', () => {
    expect(dateBlockReason('2026-10-18', TODAY, {})).toBe('sunday');
  });

  it('blocks dates that already have a request, whatever its status (rejected included)', () => {
    expect(dateBlockReason('2026-10-20', TODAY, { '2026-10-20': 'pending' })).toBe('requested');
    expect(dateBlockReason('2026-10-20', TODAY, { '2026-10-20': 'approved' })).toBe('requested');
    expect(dateBlockReason('2026-10-20', TODAY, { '2026-10-20': 'rejected' })).toBe('requested');
  });
});

describe('buildStatusMap', () => {
  const days: RequestCalendarDay[] = [
    { date: '2026-10-20', status: 'rejected', type: 'leave' },
    { date: '2026-10-21', status: 'pending', type: 'permission' },
    { date: '2026-10-22', status: 'approved', type: 'leave' },
    { date: '2026-10-22', status: 'pending', type: 'leave' },
  ];

  it('keeps only the requested kind', () => {
    expect(buildStatusMap(days, 'leave')).toEqual({ '2026-10-20': 'rejected', '2026-10-22': 'approved' });
    expect(buildStatusMap(days, 'permission')).toEqual({ '2026-10-21': 'pending' });
  });
});

describe('calendar month range (IST, last day included)', () => {
  it('uses the real first and last day of the month', () => {
    expect(calendarRange(2026, 10)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(calendarRange(2026, 11)).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(calendarRange(2028, 2)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(calendarRange(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    // v1 produced 2026-09-30 .. 2026-10-30 for October in IST
    expect(calendarRange(2026, 10)).toEqual({ start: monthRange(2026, 10).start, end: monthRange(2026, 10).end });
  });

  it('lists the Sundays of a month', () => {
    expect(sundaysOfMonth(2026, 10)).toEqual(['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
  });
});

describe('toggleDate', () => {
  it('adds, removes and keeps the list sorted across months', () => {
    let sel: string[] = [];
    sel = toggleDate(sel, '2026-11-02');
    sel = toggleDate(sel, '2026-10-15');
    expect(sel).toEqual(['2026-10-15', '2026-11-02']);
    sel = toggleDate(sel, '2026-11-02');
    expect(sel).toEqual(['2026-10-15']);
  });
});

describe('permission time slots', () => {
  it('has 48 half-hour slots with 12h labels', () => {
    expect(TIME_SLOTS).toHaveLength(48);
    expect(TIME_SLOTS[0]).toMatchObject({ value: '00:00', label: '12:00 AM' });
    expect(TIME_SLOTS[19]).toMatchObject({ value: '09:30', label: '9:30 AM' });
    expect(TIME_SLOTS[47]).toMatchObject({ value: '23:30', label: '11:30 PM' });
    expect(slotLabel('12:30')).toBe('12:30 PM');
    expect(slotLabel('')).toBe('');
  });

  it('start slots: only later than now for today / no date, all 48 for a later date', () => {
    const at1410 = 14 * 60 + 10;
    expect(startSlots(TODAY, TODAY, at1410)[0].label).toBe('2:30 PM');
    expect(startSlots(null, TODAY, at1410)[0].label).toBe('2:30 PM');
    expect(startSlots('2026-10-15', TODAY, at1410)).toHaveLength(48);
    // strictly greater: exactly 14:30 is not offered
    expect(startSlots(TODAY, TODAY, 14 * 60 + 30)[0].label).toBe('3:00 PM');
    expect(startSlots(TODAY, TODAY, 23 * 60 + 45)).toEqual([]);
  });

  it('end slots stay within 6 hours after the start and never cross midnight', () => {
    const ends = endSlots('09:00');
    expect(ends[0].label).toBe('9:30 AM');
    expect(ends[ends.length - 1].label).toBe('3:00 PM');
    const late = endSlots('18:00');
    expect(late[0].label).toBe('6:30 PM');
    expect(late[late.length - 1].label).toBe('11:30 PM');
    expect(endSlots('23:30')).toEqual([]);
    expect(endSlots('')).toEqual([]);
  });
});

describe('validation (v1 order and copy)', () => {
  const base = { date: '2026-10-15', startTime: '09:00', endTime: '10:00', reason: 'Bank work', today: TODAY, nowMinutes: 11 * 60 };

  it('leave: dates then reason', () => {
    expect(validateLeave({ dates: [], reason: '' })).toBe('Select at least one date');
    expect(validateLeave({ dates: ['2026-10-15'], reason: '   ' })).toBe('Enter a reason for leave');
    expect(validateLeave({ dates: ['2026-10-15'], reason: 'x' })).toBeNull();
  });

  it('permission: field order', () => {
    expect(validatePermission({ ...base, date: null })).toBe('Select a date');
    expect(validatePermission({ ...base, startTime: '' })).toBe('Select start time');
    expect(validatePermission({ ...base, endTime: '' })).toBe('Select end time');
    expect(validatePermission({ ...base, endTime: '09:00' })).toBe('Start and end time cannot be same');
    expect(validatePermission({ ...base, reason: ' ' })).toBe('Enter a reason');
    expect(validatePermission(base)).toBeNull();
  });

  it('permission: start must be later than now only when the date is today', () => {
    const today = { ...base, date: TODAY, startTime: '09:00', endTime: '10:00', nowMinutes: 9 * 60 };
    expect(validatePermission(today)).toBe('Start time must be greater than the current time');
    expect(validatePermission({ ...today, nowMinutes: 8 * 60 + 59 })).toBeNull();
    expect(validatePermission({ ...today, date: '2026-10-15', nowMinutes: 23 * 60 })).toBeNull();
  });

  it('permission: more than 6 hours is rejected, exactly 6 hours is fine', () => {
    expect(MAX_PERMISSION_MINUTES).toBe(360);
    expect(validatePermission({ ...base, startTime: '09:00', endTime: '15:30' })).toBe('End time cannot be more than 6 hours after start time');
    expect(validatePermission({ ...base, startTime: '09:00', endTime: '15:00' })).toBeNull();
  });

  it('shift change: reason, shift, date', () => {
    expect(validateShiftChange({ reason: ' ', shiftId: null, date: '' })).toBe('Please enter a reason');
    expect(validateShiftChange({ reason: 'x', shiftId: null, date: '' })).toBe('Please select a preferred shift');
    expect(validateShiftChange({ reason: 'x', shiftId: 3, date: '' })).toBe('Please select a requested shift date');
    expect(validateShiftChange({ reason: 'x', shiftId: 3, date: '2026-10-15' })).toBeNull();
  });

  it('device change: reason only', () => {
    expect(validateDeviceReason('  ')).toBe('Please enter a reason');
    expect(validateDeviceReason('Lost phone')).toBeNull();
  });
});

describe('pending badge counts', () => {
  type Status = 'pending' | 'approved' | 'rejected';
  const req = (type: StaffRequest['type'], status: Status, dateStatuses: Record<string, { status: Status }> = {}): StaffRequest =>
    ({ id: Math.random().toString(), reason: '', type, status, dates: [], dateStatuses, raw: {} }) as StaffRequest;

  it('counts pending requests per type and ignores decided ones', () => {
    const counts = countPendingByType([
      req('leave', 'pending'),
      req('leave', 'pending'),
      req('leave', 'approved'),
      req('shift_change', 'pending'),
      req('permission', 'rejected'),
      req('device_change', 'approved'),
    ]);
    expect(counts).toEqual({ leave: 2, permission: 0, shift_change: 1, device_change: 0 });
  });

  it('a pending request of an unknown server type contributes to no card', () => {
    const unknown = { ...req('leave', 'pending'), raw: { request_type: 'overtime' } } as StaffRequest;
    const known = { ...req('shift_change', 'pending'), raw: { request_type: 'SHIFT_CHANGE' } } as StaffRequest;
    expect(countPendingByType([unknown, known])).toEqual({ leave: 0, permission: 0, shift_change: 1, device_change: 0 });
  });

  it('uses per-date statuses when present (any pending date counts), else the request status', () => {
    const partly = req('leave', 'approved', { '2026-10-20': { status: 'approved' }, '2026-10-21': { status: 'pending' } });
    const decided = req('leave', 'pending', { '2026-10-20': { status: 'approved' } });
    expect(isPendingRequest(partly)).toBe(true);
    expect(isPendingRequest(decided)).toBe(false);
    expect(countPendingByType([partly, decided]).leave).toBe(1);
  });
});
