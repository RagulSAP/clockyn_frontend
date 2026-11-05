/**
 * Manager (role 2) admin shortcuts of the staff Settings tab. Permission names are the EXACT strings the admin
 * grants in manager settings (case-sensitive) — never rename them.
 */
import type { IconName } from '@/components/ui';
import { ROLE, routes, type AppRoute } from '@/config/routes';

export interface ShortcutOption {
  label: string;
  route: AppRoute;
}

export interface AdminShortcut {
  /** Exact `managerPermissions` string. */
  permission: string;
  title: string;
  icon: IconName;
  /** Direct navigation target (when there is no sub-menu). */
  route?: AppRoute;
  /** Sub-menu (opened in a sheet). */
  options?: ShortcutOption[];
}

/** Canonical order of the menu. */
export const ADMIN_SHORTCUTS: readonly AdminShortcut[] = [
  {
    permission: 'Staff Management',
    title: 'Staff Management',
    icon: 'users',
    options: [
      { label: 'Add Staff', route: routes.admin.staff.edit },
      { label: 'View Staff', route: routes.admin.staff.list },
    ],
  },
  {
    permission: 'Branch Management',
    title: 'Branch Management',
    icon: 'building-2',
    options: [
      { label: 'Add Branch', route: routes.admin.branches.edit },
      { label: 'View Branch', route: routes.admin.branches.list },
    ],
  },
  { permission: 'Attendance Reports', title: 'Attendance Reports', icon: 'bar-chart', route: routes.staff.reports },
  {
    permission: 'Salary Management',
    title: 'Salary Management',
    icon: 'wallet',
    options: [
      { label: 'Monthly Fixed', route: routes.admin.payroll.payslips },
      { label: 'Daily Wages', route: routes.admin.payroll.dailyWages },
      { label: 'Hourly Calculation', route: routes.admin.payroll.hourly },
    ],
  },
  { permission: 'Holiday Management', title: 'Holiday Management', icon: 'calendar-days', route: routes.admin.holidays },
  { permission: 'Shift Management', title: 'Shift Management', icon: 'alarm', route: routes.admin.shifts },
  {
    permission: 'Leads Management',
    title: 'Leads Management',
    icon: 'target',
    options: [
      { label: 'Enter Leads', route: routes.admin.crmLeads.edit },
      { label: 'Assign Leads', route: routes.admin.crmLeads.list },
    ],
  },
  {
    permission: 'Incentive Management',
    title: 'Incentive Management',
    icon: 'gift',
    options: [
      { label: 'Count Basis', route: routes.admin.payroll.countBasis },
      { label: 'Turnover Basis', route: routes.admin.payroll.turnover },
      { label: 'OT', route: routes.admin.payroll.overtime },
      { label: 'Bonus', route: routes.admin.payroll.bonus },
    ],
  },
  { permission: 'Company Settings', title: 'Company Settings', icon: 'settings', route: routes.admin.company.view },
  { permission: 'Requests Management', title: 'Requests Management', icon: 'clipboard-list', route: routes.admin.requests.hub },
];

/**
 * Shortcuts shown to the viewer: only managers (role 2) see the block, filtered by the permissions they were
 * granted. Staff never see it, even if they somehow carry permissions.
 */
export function availableAdminShortcuts(roleId: number | null | undefined, permissions: readonly string[]): AdminShortcut[] {
  if (roleId !== ROLE.manager) return [];
  return ADMIN_SHORTCUTS.filter((s) => permissions.includes(s.permission));
}
