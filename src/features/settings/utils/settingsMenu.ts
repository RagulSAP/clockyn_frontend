/**
 * The admin settings hub menu (spec: settings §3.1): 8 sections in a fixed order plus the Appearance row.
 * Plain data so the structure, order and targets are unit-testable; the screen renders it.
 */
import { routes, type AppRoute } from '@/config/routes';
import type { IconName } from '@/components/ui';

export type SectionId = 'plan' | 'referral' | 'company' | 'salary' | 'attendance' | 'reports' | 'roles' | 'expenses' | 'appearance' | 'beyond';

export type MenuAction =
  | { type: 'route'; route: AppRoute }
  | { type: 'toast'; message: string }
  /** Opens the "Select Incentive Type" sheet (Count Basis / Turnover Basis). */
  | { type: 'incentive' }
  | { type: 'logout' };

export interface MenuLeaf {
  id: string;
  title: string;
  action: MenuAction;
}

/** A nested accordion inside an accordion (Salary → "Incentive / OT / Bonus"). */
export interface MenuGroup {
  id: string;
  title: string;
  children: MenuLeaf[];
}

export type MenuChild = MenuLeaf | MenuGroup;

export const isMenuGroup = (c: MenuChild): c is MenuGroup => 'children' in c;

export interface MenuSection {
  id: SectionId;
  title: string;
  subtitle: string;
  icon: IconName;
  kind: 'link' | 'accordion' | 'appearance';
  /** `link` sections navigate here. */
  route?: AppRoute;
  children?: MenuChild[];
}

const go = (id: string, title: string, route: AppRoute): MenuLeaf => ({ id, title, action: { type: 'route', route } });

export const SETTINGS_SECTIONS: readonly MenuSection[] = [
  { id: 'plan', title: 'Your Plan & Validity', subtitle: 'Manage subscription', icon: 'credit-card', kind: 'link', route: routes.admin.billing.overview },
  { id: 'referral', title: 'Refer & Earn', subtitle: 'Get 10% off for every friend', icon: 'gift', kind: 'link', route: routes.admin.referral },
  {
    id: 'company',
    title: 'Company Settings',
    subtitle: 'Organization details',
    icon: 'building',
    kind: 'accordion',
    children: [
      go('company-view', 'View Company', routes.admin.company.view),
      go('company-add', 'Add Company', routes.admin.company.edit),
      go('holidays', 'Holiday Management', routes.admin.holidays),
    ],
  },
  {
    id: 'salary',
    title: 'Salary Structure',
    subtitle: 'Pay templates & rules',
    icon: 'wallet',
    kind: 'accordion',
    children: [
      go('monthly-fixed', 'Monthly Fixed', routes.admin.payroll.payslips),
      go('daily-wages', 'Daily Wages', routes.admin.payroll.dailyWages),
      go('hourly', 'Hourly Calculation', routes.admin.payroll.hourly),
      {
        id: 'incentive-group',
        title: 'Incentive / OT / Bonus',
        children: [
          { id: 'incentive', title: 'Incentive', action: { type: 'incentive' } },
          go('overtime', 'Overtime', routes.admin.payroll.overtime),
          go('bonus', 'Bonus', routes.admin.payroll.bonus),
        ],
      },
      { id: 'fine', title: 'Fine / Deduction', action: { type: 'toast', message: 'Coming soon' } },
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance & Devices',
    subtitle: 'Shifts, devices & rules',
    icon: 'clock',
    kind: 'accordion',
    children: [
      go('shifts', 'Shift Setting', routes.admin.shifts),
      go('devices', 'Assign Devices', routes.admin.devices),
      go('attendance-rule', 'Attendance Rule', routes.admin.attendanceRule),
    ],
  },
  { id: 'reports', title: 'View & Download Reports', subtitle: 'Analytics & exports', icon: 'bar-chart', kind: 'link', route: routes.admin.reports.hub },
  { id: 'roles', title: 'Managers', subtitle: 'Manage team leads', icon: 'user-check', kind: 'link', route: routes.admin.managers.list },
  {
    id: 'expenses',
    title: 'Expenses & Allowances',
    subtitle: 'Bills & reimbursements',
    icon: 'receipt',
    kind: 'accordion',
    children: [
      go('odometer', 'Odometer', routes.admin.expenses.odometer),
      go('travel', 'Travel Ticket', routes.admin.expenses.travel),
      go('bills', 'Other Bills', routes.admin.expenses.bills),
    ],
  },
  { id: 'appearance', title: 'Appearance', subtitle: 'Light, dark or match your device', icon: 'palette', kind: 'appearance' },
  {
    id: 'beyond',
    title: 'Beyond',
    subtitle: 'More features & tools',
    icon: 'sparkles',
    kind: 'accordion',
    children: [
      go('suggest', 'Suggest a Feature', routes.admin.suggestFeature),
      go('support', 'Support', routes.admin.support),
      go('more', 'More Options', routes.admin.more),
      go('permissions', 'App Permissions', routes.admin.permissions),
      { id: 'logout', title: 'Logout', action: { type: 'logout' } },
    ],
  },
];

/** Sections shown in the two columns of the desktop layout. */
export const DESKTOP_COLUMNS: readonly (readonly SectionId[])[] = [
  ['plan', 'referral', 'company', 'salary', 'attendance'],
  ['reports', 'roles', 'expenses', 'appearance', 'beyond'],
];

export const INCENTIVE_OPTIONS: readonly { id: string; title: string; route: AppRoute }[] = [
  { id: 'count', title: 'Count Basis', route: routes.admin.payroll.countBasis },
  { id: 'turnover', title: 'Turnover Basis', route: routes.admin.payroll.turnover },
];
