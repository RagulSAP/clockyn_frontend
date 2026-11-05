/**
 * Query-key factory. Rules:
 *  - key[0] is the domain, key[1] is the scope id (orgId, or userId for personal data) so that EVERY cached value is
 *    scoped to the organisation / user it belongs to (v1 had unscoped caches that leaked between accounts);
 *  - `all(scope)` is the prefix to invalidate a whole domain: `invalidate: [queryKeys.staff.all(orgId)]`;
 *  - parameter objects are normalised (undefined/null/'' dropped, keys sorted) so equal filters share a cache entry.
 *
 * If a feature needs a key that is missing, add it here in the smallest possible way and note it in the change log.
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query';

type Scope = string | null | undefined;
type Params = Record<string, unknown> | undefined;

const s = (v: Scope | number): string => (v === null || v === undefined ? '' : String(v));

/** Drop empty values and sort keys so `{a:1,b:2}` and `{b:2,a:1}` produce the same key. */
export function normalizeParams(params: Params): Record<string, unknown> {
  if (!params) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const v = params[key];
    if (v === undefined || v === null || v === '') continue;
    out[key] = Array.isArray(v) ? [...v] : v;
  }
  return out;
}

/** Generic domain with `all` / `list` / `detail`. */
function domain<D extends string>(name: D) {
  return {
    all: (scope: Scope) => [name, s(scope)] as const,
    list: (scope: Scope, params?: Params) => [name, s(scope), 'list', normalizeParams(params)] as const,
    detail: (scope: Scope, id: string | number | null | undefined) => [name, s(scope), 'detail', s(id)] as const,
  };
}

export const queryKeys = {
  // ── dashboard / home (admin & manager) ───────────────────────────────────────
  home: {
    ...domain('home'),
    dashboard: (orgId: Scope, params?: { date?: string; branchId?: string | number; deptId?: string }) =>
      ['home', s(orgId), 'dashboard', normalizeParams(params)] as const,
    departmentStats: (orgId: Scope, date?: string) => ['home', s(orgId), 'department-stats', s(date)] as const,
    staffByStatus: (orgId: Scope, status: string, params?: { date?: string; branchId?: string | number; deptId?: string }) =>
      ['home', s(orgId), 'staff-by-status', status, normalizeParams(params)] as const,
    allStaff: (orgId: Scope) => ['home', s(orgId), 'all-staff'] as const,
    branches: (orgId: Scope) => ['home', s(orgId), 'branches'] as const,
    departments: (orgId: Scope) => ['home', s(orgId), 'departments'] as const,
    orgAdmin: (orgId: Scope) => ['home', s(orgId), 'org-admin'] as const,
    /** Employee home snapshot (today attendance, shift, face status). */
    employee: (userId: Scope, orgId?: Scope) => ['home', s(userId), 'employee', s(orgId)] as const,
  },

  // ── staff ────────────────────────────────────────────────────────────────────
  staff: {
    ...domain('staff'),
    profile: (orgId: Scope, staffId: string | null | undefined) => ['staff', s(orgId), 'profile', s(staffId)] as const,
    picker: (orgId: Scope, params?: Params) => ['staff', s(orgId), 'picker', normalizeParams(params)] as const,
    count: (orgId: Scope) => ['staff', s(orgId), 'count'] as const,
    nextEmployeeId: (orgId: Scope) => ['staff', s(orgId), 'next-employee-id'] as const,
    options: (orgId: Scope, kind: 'branches' | 'departments' | 'managers' | 'shifts') => ['staff', s(orgId), 'options', kind] as const,
    /** Employee's own personal details. */
    personal: (userId: Scope) => ['staff', s(userId), 'personal'] as const,
  },

  branches: {
    ...domain('branches'),
    staff: (orgId: Scope, branchId: string | number | null | undefined) => ['branches', s(orgId), 'staff', s(branchId)] as const,
  },
  departments: { ...domain('departments') },

  // ── company ──────────────────────────────────────────────────────────────────
  company: {
    all: (scope: Scope) => ['company', s(scope)] as const,
    details: (orgId: Scope) => ['company', s(orgId), 'details'] as const,
    /** Companies owned by an admin (scope = admin user id). */
    list: (userId: Scope) => ['company', s(userId), 'list'] as const,
    logo: (orgId: Scope) => ['company', s(orgId), 'logo'] as const,
    employeePhoto: (userId: Scope) => ['company', s(userId), 'employee-photo'] as const,
  },

  managers: {
    ...domain('managers'),
    permissions: (orgId: Scope, userId: string | null | undefined) => ['managers', s(orgId), 'permissions', s(userId)] as const,
    promotable: (orgId: Scope) => ['managers', s(orgId), 'promotable'] as const,
    staffUnder: (orgId: Scope, managerId: string | null | undefined) => ['managers', s(orgId), 'staff-under', s(managerId)] as const,
  },

  shifts: {
    ...domain('shifts'),
    assigned: (orgId: Scope, shiftId: string | number | null | undefined) => ['shifts', s(orgId), 'assigned', s(shiftId)] as const,
    unassigned: (orgId: Scope, shiftId?: string | number | null) => ['shifts', s(orgId), 'unassigned', s(shiftId)] as const,
  },

  // ── attendance & face ────────────────────────────────────────────────────────
  attendance: {
    all: (userId: Scope) => ['attendance', s(userId)] as const,
    today: (userId: Scope) => ['attendance', s(userId), 'today'] as const,
    sessions: (userId: Scope, date: string) => ['attendance', s(userId), 'sessions', date] as const,
    month: (userId: Scope, year: number, month: number) => ['attendance', s(userId), 'month', year, month] as const,
    daily: (orgId: Scope, date: string, params?: Params) => ['attendance', s(orgId), 'daily', date, normalizeParams(params)] as const,
  },
  face: {
    all: (userId: Scope) => ['face', s(userId)] as const,
    registered: (userId: Scope) => ['face', s(userId), 'registered'] as const,
  },

  // ── requests (leave / permission / shift change / device change) ─────────────
  requests: {
    all: (scope: Scope) => ['requests', s(scope)] as const,
    /** Admin/manager inbox, scope = orgId. */
    admin: (orgId: Scope, type?: string) => ['requests', s(orgId), 'admin', s(type)] as const,
    /** Employee's own requests, scope = userId. */
    mine: (userId: Scope, orgId: Scope, type?: string) => ['requests', s(userId), 'mine', s(orgId), s(type)] as const,
    pendingCounts: (orgId: Scope) => ['requests', s(orgId), 'pending-counts'] as const,
    calendar: (userId: Scope, orgId: Scope, kind: 'leave' | 'permission', month?: string) =>
      ['requests', s(userId), 'calendar', s(orgId), kind, s(month)] as const,
    session: (userId: Scope) => ['requests', s(userId), 'session'] as const,
  },

  // ── expenses ─────────────────────────────────────────────────────────────────
  expenses: {
    all: (scope: Scope) => ['expenses', s(scope)] as const,
    odometer: (userId: Scope, date?: string) => ['expenses', s(userId), 'odometer', s(date)] as const,
    mine: (userId: Scope, kind: 'travel' | 'bill') => ['expenses', s(userId), 'mine', kind] as const,
    adminOdometer: (orgId: Scope, params?: Params) => ['expenses', s(orgId), 'admin-odometer', normalizeParams(params)] as const,
    admin: (orgId: Scope, kind: 'travel' | 'bill', params?: Params) => ['expenses', s(orgId), 'admin', kind, normalizeParams(params)] as const,
    allowanceRate: (orgId: Scope) => ['expenses', s(orgId), 'allowance-rate'] as const,
  },

  // ── live location ────────────────────────────────────────────────────────────
  location: {
    all: (orgId: Scope) => ['location', s(orgId)] as const,
    live: (orgId: Scope, date: string) => ['location', s(orgId), 'live', date] as const,
    history: (orgId: Scope, userId: string, date: string) => ['location', s(orgId), 'history', userId, date] as const,
    stats: (orgId: Scope, date: string) => ['location', s(orgId), 'stats', date] as const,
    pins: (orgId: Scope, date: string) => ['location', s(orgId), 'pins', date] as const,
  },

  // ── chat ─────────────────────────────────────────────────────────────────────
  chat: {
    all: (userId: Scope) => ['chat', s(userId)] as const,
    list: (userId: Scope, orgId?: Scope) => ['chat', s(userId), 'list', s(orgId)] as const,
    messages: (userId: Scope, peerId: string) => ['chat', s(userId), 'messages', peerId] as const,
    search: (userId: Scope, term: string) => ['chat', s(userId), 'search', term] as const,
    unread: (userId: Scope) => ['chat', s(userId), 'unread'] as const,
  },
  groupChat: {
    all: (userId: Scope) => ['group-chat', s(userId)] as const,
    list: (userId: Scope, orgId?: Scope) => ['group-chat', s(userId), 'list', s(orgId)] as const,
    messages: (userId: Scope, groupId: string) => ['group-chat', s(userId), 'messages', groupId] as const,
    members: (userId: Scope, groupId: string) => ['group-chat', s(userId), 'members', groupId] as const,
    unread: (userId: Scope) => ['group-chat', s(userId), 'unread'] as const,
  },

  announcements: {
    all: (scope: Scope) => ['announcements', s(scope)] as const,
    /** Admin: scope = orgId. */
    list: (orgId: Scope) => ['announcements', s(orgId), 'list'] as const,
    /** Employee: scope = userId. */
    mine: (userId: Scope) => ['announcements', s(userId), 'mine'] as const,
  },

  // ── CRM ──────────────────────────────────────────────────────────────────────
  leads: {
    ...domain('leads'),
    employee: (orgId: Scope, userId: string | null | undefined) => ['leads', s(orgId), 'employee', s(userId)] as const,
    categories: (orgId: Scope) => ['leads', s(orgId), 'categories'] as const,
    carryForward: (orgId: Scope) => ['leads', s(orgId), 'carry-forward'] as const,
    myCarryForward: (orgId: Scope, userId: string | null | undefined) => ['leads', s(orgId), 'my-carry-forward', s(userId)] as const,
  },

  // ── payroll (kind = payslip | daily-wages | hourly | count | turnover | overtime | bonus) ──
  payroll: {
    all: (orgId: Scope) => ['payroll', s(orgId)] as const,
    templates: (orgId: Scope, kind: string) => ['payroll', s(orgId), 'templates', kind] as const,
    template: (orgId: Scope, kind: string, id: string | number | null | undefined) => ['payroll', s(orgId), 'template', kind, s(id)] as const,
    staff: (orgId: Scope, kind: string, params?: Params) => ['payroll', s(orgId), 'staff', kind, normalizeParams(params)] as const,
    incentives: (orgId: Scope, kind: string) => ['payroll', s(orgId), 'incentives', kind] as const,
    preview: (orgId: Scope, userId: string, params?: Params) => ['payroll', s(orgId), 'preview', userId, normalizeParams(params)] as const,
    filters: (orgId: Scope, kind: 'branches' | 'departments') => ['payroll', s(orgId), 'filters', kind] as const,
  },
  salaryReports: {
    all: (orgId: Scope) => ['salary-reports', s(orgId)] as const,
    monthly: (orgId: Scope, year: number, month: number) => ['salary-reports', s(orgId), 'monthly', year, month] as const,
    breakdown: (userId: Scope, year: number, month: number) => ['salary-reports', s(userId), 'breakdown', year, month] as const,
    advances: (scope: Scope, params?: Params) => ['salary-reports', s(scope), 'advances', normalizeParams(params)] as const,
    workingDays: (orgId: Scope, year: number, month: number) => ['salary-reports', s(orgId), 'working-days', year, month] as const,
  },

  // ── reports ──────────────────────────────────────────────────────────────────
  reports: {
    all: (orgId: Scope) => ['reports', s(orgId)] as const,
    run: (orgId: Scope, kind: string, params?: Params) => ['reports', s(orgId), kind, normalizeParams(params)] as const,
  },

  // ── plans & billing ──────────────────────────────────────────────────────────
  plans: {
    all: (orgId: Scope) => ['plans', s(orgId)] as const,
    status: (orgId: Scope) => ['plans', s(orgId), 'status'] as const,
    subscription: (orgId: Scope) => ['plans', s(orgId), 'subscription'] as const,
    catalogue: () => ['plans', '', 'catalogue'] as const,
    staffLimit: (orgId: Scope) => ['plans', s(orgId), 'staff-limit'] as const,
  },
  billing: {
    all: (orgId: Scope) => ['billing', s(orgId)] as const,
    invoices: (orgId: Scope, userId?: Scope) => ['billing', s(orgId), 'invoices', s(userId)] as const,
    coupon: (orgId: Scope, code: string) => ['billing', s(orgId), 'coupon', code] as const,
    firstPayment: (orgId: Scope) => ['billing', s(orgId), 'first-payment'] as const,
  },

  support: {
    all: (userId: Scope) => ['support', s(userId)] as const,
    subjects: () => ['support', '', 'subjects'] as const,
    requests: (userId: Scope) => ['support', s(userId), 'requests'] as const,
  },
  system: {
    authConfig: () => ['system', '', 'auth-config'] as const,
    appConfig: () => ['system', '', 'app-config'] as const,
    version: () => ['system', '', 'version'] as const,
  },

  // ── holidays, weekly offs & the late-arrival rule (scope = orgId) ───────────
  holidays: {
    all: (orgId: Scope) => ['holidays', s(orgId)] as const,
    month: (orgId: Scope, year: number, month: number) => ['holidays', s(orgId), 'month', year, month] as const,
    offDays: (orgId: Scope) => ['holidays', s(orgId), 'off-days'] as const,
    scopeOptions: (orgId: Scope, kind: 'branches' | 'departments') => ['holidays', s(orgId), 'scope-options', kind] as const,
  },
  attendanceRule: {
    all: (orgId: Scope) => ['attendance-rule', s(orgId)] as const,
    rule: (orgId: Scope) => ['attendance-rule', s(orgId), 'rule'] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;

/** Invalidate every query scoped to an org / user id (second key element). Useful after switching company. */
export function invalidateScope(client: QueryClient, scope: string): Promise<void> {
  return client.invalidateQueries({
    predicate: (q) => (q.queryKey as QueryKey)[1] === scope,
  });
}
