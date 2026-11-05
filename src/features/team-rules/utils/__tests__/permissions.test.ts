import {
  MANAGER_PERMISSIONS,
  allEnabled,
  countEnabled,
  mergePermissions,
  permissionIcon,
  permissionProgress,
  toggleAll,
  togglePermission,
} from '../permissions';

describe('permission catalogue', () => {
  it('keeps the exact strings consumed by the staff Settings screen', () => {
    expect([...MANAGER_PERMISSIONS]).toEqual([
      'Staff Management',
      'Branch Management',
      'Attendance Reports',
      'Salary Management',
      'Holiday Management',
      'Shift Management',
      'Leads Management',
      'Incentive Management',
      'Company Settings',
      'Requests Management',
    ]);
  });

  it('merges the server map into the catalogue (an empty server map no longer yields 0/0)', () => {
    const merged = mergePermissions({});
    expect(Object.keys(merged)).toEqual([...MANAGER_PERMISSIONS]);
    expect(countEnabled(merged)).toBe(0);
    expect(allEnabled(merged)).toBe(false);
    expect(permissionProgress(merged)).toBe(0);
  });

  it('keeps catalogue order, applies server values and appends unknown server names', () => {
    const merged = mergePermissions({ 'Shift Management': true, 'Payroll Management': true, 'Staff Management': false });
    expect(Object.keys(merged).slice(0, 10)).toEqual([...MANAGER_PERMISSIONS]);
    expect(Object.keys(merged)[10]).toBe('Payroll Management');
    expect(merged['Shift Management']).toBe(true);
    expect(merged['Payroll Management']).toBe(true);
    expect(merged['Staff Management']).toBe(false);
  });

  it('toggles one permission, and Select All turns everything on unless all are on', () => {
    let p = mergePermissions({});
    p = togglePermission(p, 'Holiday Management');
    expect(p['Holiday Management']).toBe(true);
    p = toggleAll(p);
    expect(allEnabled(p)).toBe(true);
    p = toggleAll(p);
    expect(countEnabled(p)).toBe(0);
  });

  it('computes progress and falls back to a neutral icon for unknown names', () => {
    const p = mergePermissions({ 'Staff Management': true, 'Branch Management': true });
    expect(permissionProgress(p)).toBe(20);
    expect(permissionIcon('Staff Management')).toBe('users');
    expect(permissionIcon('Something Else')).toBe('circle');
  });
});
