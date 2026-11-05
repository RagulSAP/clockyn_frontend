/** Small pure rules of the detail screen's actions: delete confirmation and the "Assign" hub targets. */
import { routes, type AppRoute } from '@/config/routes';
import type { IconName } from '@/components/ui';

/** Case-insensitive, trimmed match of the typed name. A staff member without a name can never be deleted from the UI. */
export function isDeleteConfirmValid(typed: string, staffName: string | undefined | null): boolean {
  const name = (staffName ?? '').trim().toLowerCase();
  if (!name) return false;
  return typed.trim().toLowerCase() === name;
}

/** Only the organisation admin (role 1) may permanently delete. */
export function canPermanentlyDelete(roleId: number | null | undefined): boolean {
  return roleId === 1;
}

export interface AssignTarget {
  key: string;
  title: string;
  description?: string;
  icon: IconName;
  route: AppRoute;
  section: 'settings' | 'salary';
}

/**
 * Where "Assign" leads. The target screens do not pre-select the staff member yet (v1 behaviour: they ignored the
 * params); `staffId` is passed so they can adopt it.
 */
export const ASSIGN_TARGETS: readonly AssignTarget[] = [
  { key: 'manager', title: 'Manager', icon: 'shield-check', route: routes.admin.managers.list, section: 'settings' },
  { key: 'shift', title: 'Shift', icon: 'clock', route: routes.admin.shifts, section: 'settings' },
  { key: 'monthly', title: 'Monthly Fixed', description: 'Fixed monthly salary', icon: 'wallet', route: routes.admin.payroll.payslips, section: 'salary' },
  { key: 'daily', title: 'Daily Wages', description: 'Per day attendance pay', icon: 'calendar-days', route: routes.admin.payroll.dailyWages, section: 'salary' },
  { key: 'hourly', title: 'Hourly Charges', description: 'Per hour work pay', icon: 'timer', route: routes.admin.payroll.hourly, section: 'salary' },
  { key: 'incentive', title: 'Incentive', description: 'Performance-based rewards', icon: 'target', route: routes.admin.payroll.incentive, section: 'salary' },
  { key: 'overtime', title: 'Overtime (OT)', description: 'Extra hours compensation', icon: 'alarm', route: routes.admin.payroll.overtime, section: 'salary' },
  { key: 'bonus', title: 'Bonus', description: 'Additional compensation', icon: 'gift', route: routes.admin.payroll.bonus, section: 'salary' },
];
