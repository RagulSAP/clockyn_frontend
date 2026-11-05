import { routes } from '@/config/routes';

import { ADMIN_SHORTCUTS, availableAdminShortcuts } from '../managerShortcuts';

describe('availableAdminShortcuts', () => {
  it('staff (role 3) never see the admin block, even with permissions', () => {
    expect(availableAdminShortcuts(3, ['Staff Management'])).toEqual([]);
    expect(availableAdminShortcuts(null, ['Staff Management'])).toEqual([]);
  });

  it('a manager without permissions sees nothing', () => {
    expect(availableAdminShortcuts(2, [])).toEqual([]);
  });

  it('a manager sees exactly the granted shortcuts in canonical order', () => {
    const shown = availableAdminShortcuts(2, ['Requests Management', 'Staff Management']);
    expect(shown.map((s) => s.permission)).toEqual(['Staff Management', 'Requests Management']);
  });

  it('matches permission strings exactly (case-sensitive)', () => {
    expect(availableAdminShortcuts(2, ['staff management', 'Staff  Management'])).toEqual([]);
  });

  it('exposes every one of the ten permissions with the exact strings', () => {
    expect(ADMIN_SHORTCUTS.map((s) => s.permission)).toEqual([
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

  it('maps each shortcut to the right routes', () => {
    const by = (p: string) => ADMIN_SHORTCUTS.find((s) => s.permission === p)!;
    expect(by('Staff Management').options).toEqual([
      { label: 'Add Staff', route: routes.admin.staff.edit },
      { label: 'View Staff', route: routes.admin.staff.list },
    ]);
    expect(by('Branch Management').options?.map((o) => o.label)).toEqual(['Add Branch', 'View Branch']);
    expect(by('Attendance Reports').route).toBe(routes.staff.reports);
    expect(by('Salary Management').options?.map((o) => o.route)).toEqual([routes.admin.payroll.payslips, routes.admin.payroll.dailyWages, routes.admin.payroll.hourly]);
    expect(by('Shift Management').route).toBe(routes.admin.shifts);
    expect(by('Leads Management').options?.map((o) => o.label)).toEqual(['Enter Leads', 'Assign Leads']);
    expect(by('Incentive Management').options?.map((o) => o.label)).toEqual(['Count Basis', 'Turnover Basis', 'OT', 'Bonus']);
    expect(by('Requests Management').route).toBe(routes.admin.requests.hub);
    // v1 had no handler for these two; they now open the admin screens.
    expect(by('Holiday Management').route).toBe(routes.admin.holidays);
    expect(by('Company Settings').route).toBe(routes.admin.company.view);
  });

  it('every shortcut has either a route or a sub-menu', () => {
    for (const s of ADMIN_SHORTCUTS) expect(Boolean(s.route) !== Boolean(s.options)).toBe(true);
  });
});
