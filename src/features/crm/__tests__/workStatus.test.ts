import { DIRECT_STATUSES, EMPLOYEE_STATUS_ORDER, assignActionFor, isLeadLocked, normaliseWorkStatus, resolveStatusChange } from '../utils/workStatus';

describe('work-status state machine', () => {
  it('lets an employee move between pending / working / completed in any order', () => {
    for (const from of DIRECT_STATUSES) {
      for (const to of DIRECT_STATUSES) {
        if (from === to) continue;
        expect(resolveStatusChange(from, to)).toEqual({ kind: 'update', status: to });
      }
    }
    // completed -> pending is allowed (no lock for the employee)
    expect(resolveStatusChange('completed', 'pending')).toEqual({ kind: 'update', status: 'pending' });
  });

  it('treats an unassigned / unknown current status as pending', () => {
    expect(normaliseWorkStatus(null)).toBe('pending');
    expect(resolveStatusChange(null, 'pending')).toEqual({ kind: 'noop' });
    expect(resolveStatusChange(null, 'working')).toEqual({ kind: 'update', status: 'working' });
  });

  it('picking the current status is a no-op', () => {
    expect(resolveStatusChange('working', 'working')).toEqual({ kind: 'noop' });
  });

  it('Carry Forward never updates the status - it opens a carry-forward request', () => {
    expect(resolveStatusChange('pending', 'carry_forward')).toEqual({ kind: 'carry_forward' });
    expect(resolveStatusChange('carry_forward', 'carry_forward')).toEqual({ kind: 'carry_forward' });
  });

  it('shows the four statuses in order, only three of them writable', () => {
    expect(EMPLOYEE_STATUS_ORDER).toEqual(['pending', 'working', 'completed', 'carry_forward']);
    expect(DIRECT_STATUSES).not.toContain('carry_forward');
  });

  it('locks completed leads for the admin', () => {
    expect(isLeadLocked({ workStatus: 'completed' })).toBe(true);
    expect(isLeadLocked({ workStatus: 'working' })).toBe(false);
    expect(isLeadLocked({ workStatus: null })).toBe(false);
  });

  it('assign vs reassign is decided by the assignee id', () => {
    expect(assignActionFor({ assignedUserId: null })).toBe('assign');
    expect(assignActionFor({ assignedUserId: 'u7' })).toBe('reassign');
  });
});
