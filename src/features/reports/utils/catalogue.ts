/** The report catalogue shown by the hub (admin) and the manager variant (`/staff/reports`). */
import { routes, type AppRoute } from '@/config/routes';
import type { IconName } from '@/components/ui';

export type CatalogueTone = 'info' | 'success' | 'warning' | 'primary';
export type HubVariant = 'admin' | 'manager';

export interface CatalogueRow {
  label: string;
  /** Rows without a route are placeholders (greyed, not tappable). */
  route?: AppRoute;
  /** The manager hub enables only these rows (v1 subset). */
  managerEnabled?: boolean;
}

export interface CatalogueCategory {
  title: string;
  icon: IconName;
  tone: CatalogueTone;
  rows: CatalogueRow[];
}

const r = routes.admin.reports;
const p = routes.admin.payroll;

export const REPORT_CATALOGUE: CatalogueCategory[] = [
  {
    title: 'Attendance Reports',
    icon: 'calendar-days',
    tone: 'info',
    rows: [
      { label: 'Monthly Summary', route: r.monthlyAttendance, managerEnabled: true },
      { label: 'Staff-wise Detailed Report', route: r.staffDetailed },
      { label: 'Late Report', route: r.late, managerEnabled: true },
      { label: 'Overtime Report', route: r.overtime },
    ],
  },
  {
    title: 'Salary Reports',
    icon: 'wallet',
    tone: 'success',
    rows: [
      { label: 'Monthly Salary', route: p.monthlySalary, managerEnabled: true },
      { label: 'View Staff Salary', route: p.salarySheet, managerEnabled: true },
      { label: 'Incentives' },
      { label: 'Loss of Pay' },
      { label: 'Reimbursement' },
    ],
  },
  {
    title: 'Employee Reports',
    icon: 'users',
    tone: 'warning',
    rows: [
      { label: 'Employee Details', route: r.employeeDetails },
      { label: 'Previous Employees' },
      { label: 'Employees Salary Structures' },
      { label: 'Employee Shift / Timing', route: r.employeeShifts },
    ],
  },
  {
    title: 'CRM',
    icon: 'bar-chart',
    tone: 'primary',
    rows: [{ label: 'Meeting Report' }, { label: 'Travel Report' }, { label: 'Expense Report' }],
  },
];

/** The route a row opens for the given hub variant, or `undefined` when the row is not available. */
export function routeFor(row: CatalogueRow, variant: HubVariant): AppRoute | undefined {
  if (!row.route) return undefined;
  if (variant === 'manager' && !row.managerEnabled) return undefined;
  return row.route;
}

/** Permission string that gates the manager hub (entry lives in the staff Settings screen). */
export const MANAGER_REPORTS_PERMISSION = 'Attendance Reports';
