/**
 * Route catalogue for the smoke suite, derived from the app's own registry (`src/config/routes.ts`).
 * Every registry path must be covered by at least one case (`00-smoke.spec.ts` asserts it), so adding a route to the
 * app without extending this table fails the suite.
 */
import { routes } from '../../src/config/routes';
import { IDS, ORG, USERS, BRANCHES, DEPARTMENTS, type Role } from './fixtures';
import type { RouteParams } from './app';

export interface RouteCase {
  /** Registry key path, e.g. `admin.staff.detail` (variants get a `#variant` suffix). */
  key: string;
  /** Registry path, e.g. `/admin/staff/detail`. */
  path: string;
  /** Session to boot with (null = signed out). */
  role: Role | null;
  params?: RouteParams;
  /** Short note for the report. */
  note?: string;
}

/** Flatten the registry into `[key, path]` pairs. */
export function registryEntries(): { key: string; path: string }[] {
  const out: { key: string; path: string }[] = [];
  const walk = (node: unknown, prefix: string): void => {
    if (typeof node === 'string') out.push({ key: prefix, path: node });
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, prefix ? `${prefix}.${k}` : k);
  };
  walk(routes, '');
  return out;
}

/** Params for routes that need them (dynamic ones take `today` from the caller). */
const paramsFor = (key: string, today: string): RouteParams | undefined => {
  switch (key) {
    case 'deviceChangeRequest':
      return { userId: USERS.staff.userId, orgId: ORG.id, mobile: USERS.staff.mobile };
    case 'admin.overview':
      return { date: today };
    case 'admin.staff.list':
      return { filter: 'total' };
    case 'admin.staff.detail':
      return { staffId: IDS.staffDetail };
    default:
      return undefined;
  }
};

/** Extra visits that exercise the optional-parameter (edit / open-item) modes of a route. */
const variants = (today: string): RouteCase[] => [
  { key: 'admin.staff.list#late', path: routes.admin.staff.list, role: 'admin', params: { filter: 'late', date: today }, note: 'status filter' },
  { key: 'admin.staff.list#branch', path: routes.admin.staff.list, role: 'admin', params: { filter: 'total', branchId: BRANCHES.hq.id }, note: 'branch filter' },
  { key: 'admin.staff.edit#edit', path: routes.admin.staff.edit, role: 'admin', params: { staffId: IDS.staffDetail }, note: 'edit mode' },
  { key: 'admin.branches.edit#edit', path: routes.admin.branches.edit, role: 'admin', params: { branchId: BRANCHES.hq.id }, note: 'edit mode' },
  { key: 'admin.departments.edit#edit', path: routes.admin.departments.edit, role: 'admin', params: { deptId: DEPARTMENTS.sales.id }, note: 'edit mode' },
  { key: 'admin.company.edit#edit', path: routes.admin.company.edit, role: 'admin', params: { orgId: ORG.id }, note: 'edit mode' },
  { key: 'admin.managers.edit#edit', path: routes.admin.managers.edit, role: 'admin', params: { userId: IDS.managerUser }, note: 'edit mode' },
  { key: 'admin.payroll.payslipEdit#edit', path: routes.admin.payroll.payslipEdit, role: 'admin', params: { templateId: IDS.payslipTemplate }, note: 'edit mode' },
  { key: 'admin.comms.direct#open', path: routes.admin.comms.direct, role: 'admin', params: { userId: USERS.staff.userId }, note: 'open conversation' },
  { key: 'admin.comms.groups#open', path: routes.admin.comms.groups, role: 'admin', params: { groupId: IDS.group }, note: 'open group' },
  { key: 'admin.crmLeads.list#open', path: routes.admin.crmLeads.list, role: 'admin', params: { leadId: IDS.lead }, note: 'open lead' },
  { key: 'admin.crmLeads.edit#edit', path: routes.admin.crmLeads.edit, role: 'admin', params: { leadId: IDS.lead }, note: 'edit mode' },
  { key: 'staff.comms.direct#open', path: routes.staff.comms.direct, role: 'staff', params: { userId: USERS.admin.userId }, note: 'open conversation' },
  { key: 'staff.comms.groups#open', path: routes.staff.comms.groups, role: 'staff', params: { groupId: IDS.group }, note: 'open group' },
  { key: 'staff.home#manager', path: routes.staff.home, role: 'manager', note: 'manager session' },
  { key: 'staff.home#fieldStaff', path: routes.staff.home, role: 'fieldStaff', note: 'field staff (punched in)' },
  { key: 'staff.settings#manager', path: routes.staff.settings, role: 'manager', note: 'manager shortcuts' },
  { key: 'admin.staff.list#manager', path: routes.admin.staff.list, role: 'manager', params: { filter: 'total' }, note: 'manager allowed on /admin/staff' },
];

/** Role that is appropriate for a registry route. */
export function roleFor(key: string, path: string): Role | null {
  if (path.startsWith('/admin/')) return 'admin';
  if (path === routes.staff.reports) return 'manager'; // manager-permission "Attendance Reports"
  if (path.startsWith('/staff/')) return 'staff';
  return null; // public routes are visited signed out
}

/** One base case per registry path + the optional-parameter variants. */
export function buildRouteCases(today: string): RouteCase[] {
  const base: RouteCase[] = registryEntries().map(({ key, path }) => ({ key, path, role: roleFor(key, path), params: paramsFor(key, today) }));
  return [...base, ...variants(today)];
}
