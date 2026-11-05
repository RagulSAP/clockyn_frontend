import type { Manager } from '@/types/api/managers';

import {
  buildAssignManagerInput,
  buildAssignmentPairs,
  countCombinations,
  detectConflicts,
  groupAssignmentsByBranch,
  managerStats,
  prefillFromManager,
  validateManagerForm,
} from '../managerAssign';

const mgr = (userId: string, name: string, assignments: { b: string; d: string | null; bn?: string; dn?: string }[]): Manager => ({
  userId,
  name,
  empId: `E-${userId}`,
  raw: {},
  assignments: assignments.map((a) => ({ branchId: a.b, branchName: a.bn ?? `Branch ${a.b}`, deptId: a.d, deptName: a.dn ?? (a.d ? `Dept ${a.d}` : '') })),
});

describe('assignment payload builder', () => {
  it('builds the branch x department cross product with an explicit department on every entry', () => {
    const input = buildAssignManagerInput('u1', ['1', '2'], ['d1', 'd2']);
    expect(input.userId).toBe('u1');
    expect(input.assignments).toEqual([
      { branchId: '1', deptId: 'd1' },
      { branchId: '1', deptId: 'd2' },
      { branchId: '2', deptId: 'd1' },
      { branchId: '2', deptId: 'd2' },
    ]);
    expect(input.assignments.every((a) => !!a.deptId)).toBe(true);
  });

  it('"all departments" is expressed by sending every department id', () => {
    const allDepts = ['a', 'b', 'c'];
    const input = buildAssignManagerInput('u1', ['7'], allDepts);
    expect(input.assignments.map((a) => a.deptId)).toEqual(allDepts);
  });

  it('refuses to build a payload without a department, branch or staff (the backend would reject it)', () => {
    expect(() => buildAssignManagerInput('u1', ['1'], [])).toThrow('at least one department');
    expect(() => buildAssignManagerInput('u1', [], ['d'])).toThrow('at least one branch');
    expect(() => buildAssignManagerInput(' ', ['1'], ['d'])).toThrow('select a staff member');
  });

  it('de-duplicates ids and counts combinations', () => {
    expect(buildAssignmentPairs(['1', '1'], ['d', 'd'])).toEqual([{ branchId: '1', deptId: 'd' }]);
    expect(countCombinations(['1', '2', '3'], ['a', 'b'])).toBe(6);
    expect(countCombinations([], ['a'])).toBe(0);
  });
});

describe('validateManagerForm', () => {
  it('reports staff first, then branch, then department', () => {
    expect(validateManagerForm({ isEdit: false, staffId: '', branchIds: [], deptIds: [] })).toBe('Please select a staff member');
    expect(validateManagerForm({ isEdit: false, staffId: 'u', branchIds: [], deptIds: [] })).toBe('Please select at least one branch to assign');
    expect(validateManagerForm({ isEdit: false, staffId: 'u', branchIds: ['1'], deptIds: [] })).toBe('Please select at least one department to assign');
    expect(validateManagerForm({ isEdit: false, staffId: 'u', branchIds: ['1'], deptIds: ['d'] })).toBeNull();
  });
});

describe('prefillFromManager', () => {
  it('collects unique branches and departments', () => {
    const m = mgr('m1', 'Mia', [{ b: '1', d: 'x' }, { b: '1', d: 'y' }, { b: '2', d: 'x' }]);
    expect(prefillFromManager(m, ['x', 'y', 'z'])).toEqual({ branchIds: ['1', '2'], deptIds: ['x', 'y'] });
  });

  it('selects every department for a legacy "all departments" assignment', () => {
    const m = mgr('m1', 'Mia', [{ b: '1', d: null }]);
    expect(prefillFromManager(m, ['x', 'y']).deptIds).toEqual(['x', 'y']);
  });

  it('works when the organisation has no departments / the manager is unknown', () => {
    expect(prefillFromManager(mgr('m1', 'Mia', [{ b: '1', d: 'x' }]), [])).toEqual({ branchIds: ['1'], deptIds: ['x'] });
    expect(prefillFromManager(undefined, ['x'])).toEqual({ branchIds: [], deptIds: [] });
  });
});

describe('detectConflicts', () => {
  const existing = [mgr('m1', 'Mia', [{ b: '1', d: 'x', bn: 'HQ', dn: 'Sales' }]), mgr('m2', 'Ned', [{ b: '2', d: null, bn: 'Pune' }])];
  const names = { branchNames: { '1': 'HQ', '2': 'Pune' }, deptNames: { x: 'Sales', y: 'Ops' } };

  it('flags the same branch + department', () => {
    const c = detectConflicts({ managers: existing, branchIds: ['1'], deptIds: ['x'], ...names });
    expect(c).toEqual([{ managerName: 'Mia', empId: 'E-m1', branchName: 'HQ', deptName: 'Sales' }]);
  });

  it('does not flag a different department in the same branch', () => {
    expect(detectConflicts({ managers: existing, branchIds: ['1'], deptIds: ['y'], ...names })).toEqual([]);
  });

  it('treats an "all departments" assignment as overlapping every department of that branch', () => {
    const c = detectConflicts({ managers: existing, branchIds: ['2'], deptIds: ['y'], ...names });
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ managerName: 'Ned', branchName: 'Pune', deptName: 'All Departments' });
  });

  it('ignores the manager being edited', () => {
    expect(detectConflicts({ managers: existing, selfUserId: 'm1', branchIds: ['1'], deptIds: ['x'], ...names })).toEqual([]);
  });

  it('de-duplicates identical rows', () => {
    const dup = [mgr('m1', 'Mia', [{ b: '1', d: 'x', bn: 'HQ', dn: 'Sales' }, { b: '1', d: 'x', bn: 'HQ', dn: 'Sales' }])];
    expect(detectConflicts({ managers: dup, branchIds: ['1'], deptIds: ['x'], ...names })).toHaveLength(1);
  });
});

describe('list helpers', () => {
  it('groups assignments by branch in order of first appearance with the v1 fallbacks', () => {
    const m = mgr('m1', 'Mia', [{ b: '1', d: 'x', bn: 'HQ', dn: 'Sales' }, { b: '2', d: null, bn: '', dn: '' }, { b: '1', d: 'y', bn: 'HQ', dn: 'Ops' }]);
    expect(groupAssignmentsByBranch(m.assignments)).toEqual([
      { key: '1', branchLabel: 'HQ', departments: ['Sales', 'Ops'] },
      { key: '2', branchLabel: 'All Branches', departments: ['All Departments'] },
    ]);
  });

  it('computes the stats strip', () => {
    const list = [mgr('a', 'A', []), mgr('b', 'B', [{ b: '1', d: 'x' }]), mgr('c', 'C', [{ b: '1', d: 'x' }, { b: '2', d: 'y' }])];
    expect(managerStats(list)).toEqual({ total: 3, assigned: 2, assignments: 3 });
  });
});
