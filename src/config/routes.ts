/**
 * Central route registry — the ONLY place route paths are written down.
 * Screens navigate with `router.push({ pathname: routes.admin.staff.list, params })` (see src/lib/navigation).
 * File location of each route is `src/app` + path (see docs/ROUTES.md for the v1→v2 mapping and params).
 *
 *  /admin/*  → role 1 (admin) AND role 2 (manager, reached from the staff Settings shortcuts)
 *  /staff/*  → role 2 (manager) and role 3 (staff)
 *  (auth) routes are public.
 */
export const routes = {
  // ── public ────────────────────────────────────────────────────────────────
  welcome: '/',
  adminLogin: '/admin-login',
  staffLogin: '/staff-login',
  register: '/register',
  deviceChangeRequest: '/device-change-request', // pre-login (params: userId, orgId)

  // ── admin (tab roots) ─────────────────────────────────────────────────────
  admin: {
    home: '/admin/home',
    crm: '/admin/crm',
    chat: '/admin/chat',
    settings: '/admin/settings',

    overview: '/admin/overview', // params: date

    staff: {
      list: '/admin/staff', // params: filter (total|late|punched_in|working|punched_out|absent), branchId, date, deptId
      detail: '/admin/staff/detail', // params: staffId
      edit: '/admin/staff/edit', // params: staffId? (edit mode when present)
    },
    branches: { list: '/admin/branches', edit: '/admin/branches/edit' }, // edit params: branchId?
    departments: { list: '/admin/departments', edit: '/admin/departments/edit' }, // edit params: deptId?
    devices: '/admin/devices', // "coming soon" placeholder (v1 behaviour)

    company: { view: '/admin/company', edit: '/admin/company/edit' }, // edit params: orgId? (add mode when absent)
    managers: { list: '/admin/managers', edit: '/admin/managers/edit' }, // edit params: userId?
    shifts: '/admin/shifts',
    attendanceRule: '/admin/attendance-rule',
    holidays: '/admin/holidays',

    billing: {
      overview: '/admin/billing',
      upgrade: '/admin/billing/upgrade',
      checkout: '/admin/billing/checkout',
      invoices: '/admin/billing/invoices',
    },
    support: '/admin/support',
    suggestFeature: '/admin/suggest-feature',
    more: '/admin/more', // privacy policy + request account deletion
    permissions: '/admin/permissions', // device permission status

    payroll: {
      payslips: '/admin/payroll/payslips',
      payslipEdit: '/admin/payroll/payslips/edit', // params: templateId?
      dailyWages: '/admin/payroll/daily-wages',
      hourly: '/admin/payroll/hourly',
      overtime: '/admin/payroll/overtime',
      bonus: '/admin/payroll/bonus',
      countBasis: '/admin/payroll/count-basis',
      turnover: '/admin/payroll/turnover',
      incentive: '/admin/payroll/incentive', // chooser: count basis | turnover basis
      monthlySalary: '/admin/payroll/monthly-salary',
      salarySheet: '/admin/payroll/salary-sheet',
    },

    reports: {
      hub: '/admin/reports',
      monthlyAttendance: '/admin/reports/monthly-attendance',
      staffDetailed: '/admin/reports/staff-detailed',
      late: '/admin/reports/late',
      overtime: '/admin/reports/overtime',
      employeeDetails: '/admin/reports/employee-details',
      employeeShifts: '/admin/reports/employee-shifts',
    },

    requests: {
      hub: '/admin/requests',
      leave: '/admin/requests/leave',
      permission: '/admin/requests/permission',
      shiftChange: '/admin/requests/shift-change',
      deviceChange: '/admin/requests/device-change',
    },
    expenses: {
      odometer: '/admin/expenses/odometer',
      travel: '/admin/expenses/travel',
      bills: '/admin/expenses/bills',
    },
    location: '/admin/location', // live staff map (plan-gated)

    comms: {
      direct: '/admin/chat/direct', // params: userId? (open conversation)
      groups: '/admin/chat/groups', // params: groupId?
      announcements: '/admin/chat/announcements',
      announcementsTargeted: '/admin/chat/announcements-targeted',
    },
    crmLeads: { list: '/admin/crm/leads', edit: '/admin/crm/leads/edit' }, // list params: leadId?; edit params: leadId?
  },

  // ── staff / manager (tab roots) ───────────────────────────────────────────
  staff: {
    home: '/staff/home',
    crm: '/staff/crm',
    chat: '/staff/chat',
    settings: '/staff/settings',

    attendance: '/staff/attendance', // monthly calendar + payslip/advance sheets
    profile: '/staff/profile', // personal details (view/edit)
    reports: '/staff/reports', // manager-permission "Attendance Reports"

    requests: {
      hub: '/staff/requests',
      leave: '/staff/requests/leave',
      permission: '/staff/requests/permission',
      shiftChange: '/staff/requests/shift-change',
      deviceChange: '/staff/requests/device-change',
    },
    expenses: {
      hub: '/staff/expenses',
      odometer: '/staff/expenses/odometer',
      travel: '/staff/expenses/travel',
      bills: '/staff/expenses/bills',
    },
    comms: {
      direct: '/staff/chat/direct', // params: userId?
      groups: '/staff/chat/groups', // params: groupId?
      broadcast: '/staff/chat/broadcast',
      targeted: '/staff/chat/targeted',
    },
    permissions: '/staff/permissions',
    more: '/staff/more', // delete my account
  },
} as const;

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T];
export type AppRoute = Leaves<typeof routes>;

/** Roles. */
export const ROLE = { admin: 1, manager: 2, staff: 3 } as const;
export type RoleId = (typeof ROLE)[keyof typeof ROLE];

/** Home route for each role (used after login and by the root redirect). */
export const homeForRole = (role: number): string => (role === ROLE.admin ? routes.admin.home : routes.staff.home);
