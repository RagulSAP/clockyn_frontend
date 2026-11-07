import { badgeLabel, countPendingRequests, derivePunchState, punchButtonState, statusChip, trackingAction } from '../punchState';

const registered = { isFaceRegistered: true, isPunchedIn: false, punchIn: undefined, punchOut: undefined, punchCount: 0 };

describe('derivePunchState', () => {
  it('locks the button after three completed sessions (the default limit)', () => {
    expect(derivePunchState({ ...registered, punchCount: 3, punchIn: '09:00', punchOut: '18:00' })).toEqual({ isMaxSessionsReached: true, isDone: true });
  });
  it('locks at the limit configured for the organisation', () => {
    expect(derivePunchState({ ...registered, punchCount: 2, punchIn: '09:00', punchOut: '18:00', maxSessionsPerDay: 2 })).toEqual({ isMaxSessionsReached: true, isDone: true });
    expect(derivePunchState({ ...registered, punchCount: 3, punchIn: '09:00', punchOut: '18:00', maxSessionsPerDay: 5 })).toEqual({ isMaxSessionsReached: false, isDone: true });
  });
  it('keeps the button active after ONE completed session', () => {
    expect(derivePunchState({ ...registered, punchCount: 1, punchIn: '09:00', punchOut: '13:00' })).toEqual({ isMaxSessionsReached: false, isDone: true });
  });
  it('stays enabled for PUNCH OUT during the last session and is never "done" while punched in', () => {
    expect(derivePunchState({ ...registered, isPunchedIn: true, punchCount: 3, punchIn: '09:00', punchOut: '13:00' })).toEqual({ isMaxSessionsReached: false, isDone: false });
  });
});

describe('statusChip', () => {
  it('SETUP > COMPLETE > WORKING > NOT IN', () => {
    expect(statusChip({ ...registered, isFaceRegistered: false }).label).toBe('SETUP');
    expect(statusChip({ ...registered, punchIn: '09:00', punchOut: '10:00', punchCount: 1 }).label).toBe('COMPLETE');
    expect(statusChip({ ...registered, isPunchedIn: true, punchIn: '09:00', punchCount: 1 }).label).toBe('WORKING');
    expect(statusChip(registered).label).toBe('NOT IN');
  });
});

describe('punchButtonState', () => {
  const idle = { ...registered, isChecking: false };
  it('first match wins: setup, limit, punch out, punch in', () => {
    expect(punchButtonState({ ...idle, isFaceRegistered: false })).toMatchObject({ key: 'setup', label: 'SETUP FACE', stateLabel: 'Setup Required', disabled: false });
    expect(punchButtonState({ ...idle, punchCount: 3 })).toMatchObject({ key: 'limit', label: 'LIMIT REACHED', stateLabel: 'Max Sessions Reached', disabled: true });
    expect(punchButtonState({ ...idle, isPunchedIn: true })).toMatchObject({ key: 'punch-out', label: 'PUNCH OUT', tone: 'danger' });
    expect(punchButtonState(idle)).toMatchObject({ key: 'punch-in', label: 'PUNCH IN', tone: 'success', disabled: false });
  });
  it('shows CHECKING… and disables while the pre-checks run', () => {
    expect(punchButtonState({ ...idle, isChecking: true })).toMatchObject({ key: 'checking', label: 'CHECKING…', disabled: true, icon: 'spinner' });
  });
});

describe('trackingAction', () => {
  const base = { isFieldStaff: true, hasUser: true, attendanceLoaded: true, isPunchedIn: true };
  it('starts while punched in and stops otherwise', () => {
    expect(trackingAction(base)).toBe('start');
    expect(trackingAction({ ...base, isPunchedIn: false })).toBe('stop');
  });
  it('does nothing for non field staff, without a user, or before attendance has loaded', () => {
    expect(trackingAction({ ...base, isFieldStaff: false })).toBe('none');
    expect(trackingAction({ ...base, hasUser: false })).toBe('none');
    expect(trackingAction({ ...base, attendanceLoaded: false })).toBe('none');
  });
});

describe('countPendingRequests', () => {
  it('counts a leave / permission request once when any date is pending', () => {
    expect(
      countPendingRequests([
        { type: 'leave', dateStatuses: { '2026-10-01': { status: 'approved' }, '2026-10-02': { status: 'pending' }, '2026-10-03': { status: 'pending' } } },
        { type: 'leave', dateStatuses: { '2026-10-05': { status: 'approved' } } },
      ]),
    ).toBe(1);
  });
  it('uses the request status for other types and for requests without per-date statuses', () => {
    expect(
      countPendingRequests([
        { type: 'shift_change', status: 'pending', dateStatuses: {} },
        { type: 'device_change', status: 'approved', dateStatuses: {} },
        { type: 'permission', status: 'pending', dateStatuses: {} },
        { type: 'leave', dateStatuses: {} },
      ]),
    ).toBe(2);
  });
  it('caps the badge text at 99+', () => {
    expect(badgeLabel(7)).toBe('7');
    expect(badgeLabel(100)).toBe('99+');
  });
});
