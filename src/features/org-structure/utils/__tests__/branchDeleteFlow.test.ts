import type { Branch, BranchStaffMember } from '@/types/api/branches';

import {
  INITIAL_DELETE_FLOW,
  allSelected,
  canReassign,
  deleteFlowReducer,
  reassignLabel,
  remainingAfter,
  targetBranches,
  type DeleteFlowAction,
  type DeleteFlowState,
} from '../branchDeleteFlow';

const branch = (id: string, name = `Branch ${id}`): Branch => ({ id, name, address: '', orgId: 'o', latitude: 1, longitude: 1, radius: 100, raw: {} });
const member = (userId: string): BranchStaffMember => ({ userId, name: `Name ${userId}`, empId: userId, mobile: '', email: '', department: 'Ops', branchId: '1', branchName: 'Branch 1' });

const run = (actions: DeleteFlowAction[], from: DeleteFlowState = INITIAL_DELETE_FLOW) => actions.reduce(deleteFlowReducer, from);

const reassignState = () =>
  run([
    { type: 'start', branch: branch('1') },
    { type: 'staffLoaded', staff: [member('a'), member('b'), member('c')] },
  ]);

describe('branch delete state machine', () => {
  it('goes to the plain confirm step when the branch has no staff', () => {
    const s = run([{ type: 'start', branch: branch('1') }, { type: 'staffLoaded', staff: [] }]);
    expect(s).toMatchObject({ step: 'confirm', deleting: false });
  });

  it('opens the reassign step when staff exist', () => {
    expect(reassignState()).toMatchObject({ step: 'reassign', selectedIds: [], targetId: '', busy: false });
  });

  it('returns to idle when the staff lookup fails (no silent plain-delete fallback)', () => {
    expect(run([{ type: 'start', branch: branch('1') }, { type: 'staffFailed' }])).toEqual(INITIAL_DELETE_FLOW);
  });

  it('ignores a late staff response after cancel and a second start while busy', () => {
    const cancelled = run([{ type: 'start', branch: branch('1') }, { type: 'cancel' }, { type: 'staffLoaded', staff: [member('a')] }]);
    expect(cancelled).toEqual(INITIAL_DELETE_FLOW);
    const twice = run([{ type: 'start', branch: branch('1') }, { type: 'start', branch: branch('2') }]);
    expect(twice).toMatchObject({ step: 'checking', branch: { id: '1' } });
  });

  it('toggles staff, select-all (twice = none) and the target', () => {
    let s = reassignState();
    s = run([{ type: 'toggleStaff', userId: 'a' }], s);
    expect(s).toMatchObject({ selectedIds: ['a'] });
    s = run([{ type: 'toggleStaff', userId: 'a' }], s);
    expect(s).toMatchObject({ selectedIds: [] });
    s = run([{ type: 'toggleAll' }], s);
    expect(allSelected(s)).toBe(true);
    s = run([{ type: 'toggleAll' }], s);
    expect(allSelected(s)).toBe(false);
    s = run([{ type: 'setTarget', branchId: '2' }], s);
    expect(s).toMatchObject({ targetId: '2' });
  });

  it('enables the action only with staff AND a target, and labels it like v1', () => {
    let s = reassignState();
    expect(canReassign(s)).toBe(false);
    expect(reassignLabel(s)).toBe('Reassign Staff');
    s = run([{ type: 'toggleStaff', userId: 'a' }], s);
    expect(canReassign(s)).toBe(false); // no target yet
    s = run([{ type: 'setTarget', branchId: '2' }], s);
    expect(canReassign(s)).toBe(true);
    expect(reassignLabel(s)).toBe('Reassign 1 Staff');
    s = run([{ type: 'toggleAll' }], s);
    expect(reassignLabel(s)).toBe('Reassign All & Delete Branch');
  });

  it('removes moved staff, resets selection / target and stays open while staff remain', () => {
    let s = reassignState();
    s = run([{ type: 'toggleStaff', userId: 'a' }, { type: 'setTarget', branchId: '2' }, { type: 'busy' }], s);
    expect(canReassign(s)).toBe(false); // busy
    s = run([{ type: 'reassigned', movedIds: ['a'] }], s);
    expect(s).toMatchObject({ step: 'reassign', busy: false, selectedIds: [], targetId: '' });
    expect((s as Extract<DeleteFlowState, { step: 'reassign' }>).staff.map((m) => m.userId)).toEqual(['b', 'c']);
  });

  it('keeps the list and shows the error when the reassign fails (errors clear on the next action)', () => {
    let s = reassignState();
    s = run([{ type: 'toggleStaff', userId: 'a' }, { type: 'setTarget', branchId: '2' }, { type: 'busy' }, { type: 'failed', message: 'nope' }], s);
    expect(s).toMatchObject({ busy: false, error: 'nope', selectedIds: ['a'] });
    expect((s as Extract<DeleteFlowState, { step: 'reassign' }>).staff).toHaveLength(3);
    s = run([{ type: 'toggleStaff', userId: 'b' }], s);
    expect(s).toMatchObject({ error: null });
  });

  it('after the last staff moved: delete success closes the flow, delete failure falls back to a confirm step', () => {
    const moved = run([
      { type: 'toggleAll' },
      { type: 'setTarget', branchId: '2' },
      { type: 'busy' },
      { type: 'reassigned', movedIds: ['a', 'b', 'c'] },
      { type: 'busy' },
    ], reassignState());
    expect((moved as Extract<DeleteFlowState, { step: 'reassign' }>).staff).toHaveLength(0);
    expect(run([{ type: 'deleted' }], moved)).toEqual(INITIAL_DELETE_FLOW);
    expect(run([{ type: 'deleteFailed', message: 'server said no' }], moved)).toMatchObject({
      step: 'confirm',
      deleting: false,
      error: 'server said no',
      branch: { id: '1' },
    });
  });

  it('plain confirm: deleting flag, failure keeps the dialog for a retry, cancel / success close it', () => {
    const confirm = run([{ type: 'start', branch: branch('1') }, { type: 'staffLoaded', staff: [] }]);
    const deleting = run([{ type: 'deleteStarted' }], confirm);
    expect(deleting).toMatchObject({ deleting: true });
    expect(run([{ type: 'deleteFailed', message: 'x' }], deleting)).toMatchObject({ step: 'confirm', deleting: false, error: 'x' });
    expect(run([{ type: 'cancel' }], confirm)).toEqual(INITIAL_DELETE_FLOW);
    expect(run([{ type: 'deleted' }], deleting)).toEqual(INITIAL_DELETE_FLOW);
  });
});

describe('helpers', () => {
  it('never offers the branch being deleted as a target', () => {
    expect(targetBranches([branch('1'), branch('2'), branch('3')], branch('2')).map((b) => b.id)).toEqual(['1', '3']);
    expect(targetBranches([branch('1')], branch('1'))).toEqual([]);
  });
  it('computes the staff left after a move', () => {
    expect(remainingAfter([member('a'), member('b')], ['a']).map((m) => m.userId)).toEqual(['b']);
    expect(remainingAfter([member('a')], ['a'])).toEqual([]);
  });
});
