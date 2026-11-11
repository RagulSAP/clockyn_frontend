/**
 * Navigation model of the app shell (bottom tab bar on phones, sidebar on wide screens): which tabs exist for a
 * role, which tab is active for a pathname, badge values, the CRM plan-gate decision and the layout switch.
 * Pure (no React / router imports) so it is unit-tested.
 */
import { routes } from '@/config/routes';
import { breakpoints } from '@/theme/tokens';
import type { IconName } from '@/components/ui';

export type ShellVariant = 'admin' | 'staff';
export type ShellTabKey = 'home' | 'crm' | 'chat' | 'settings' | 'support';

export type ShellTab = {
  key: ShellTabKey;
  label: string;
  icon: IconName;
  /** Tab-root route. */
  route: string;
  /** Other route prefixes that belong to this tab (used only to highlight the parent tab). */
  within: readonly string[];
};

const adminTabs: readonly ShellTab[] = [
  {
    key: 'home',
    label: 'Home',
    icon: 'home',
    route: routes.admin.home,
    within: [
      routes.admin.overview,
      routes.admin.staff.list,
      routes.admin.reports.hub,
      routes.admin.requests.hub,
      '/admin/expenses',
      routes.admin.location,
    ],
  },
  { key: 'crm', label: 'CRM', icon: 'briefcase', route: routes.admin.crm, within: [] },
  { key: 'chat', label: 'Chat', icon: 'chat', route: routes.admin.chat, within: [] },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'settings',
    route: routes.admin.settings,
    within: [
      '/admin/billing',
      routes.admin.referral,
      routes.admin.support,
      routes.admin.suggestFeature,
      routes.admin.more,
      routes.admin.permissions,
      '/admin/company',
      '/admin/managers',
      routes.admin.shifts,
      routes.admin.attendanceRule,
      routes.admin.holidays,
      '/admin/payroll',
      '/admin/branches',
      '/admin/departments',
      routes.admin.devices,
    ],
  },
  { key: 'support', label: 'Support', icon: 'life-buoy', route: routes.admin.help, within: [] },
];

const staffTabs: readonly ShellTab[] = [
  {
    key: 'home',
    label: 'Home',
    icon: 'home',
    route: routes.staff.home,
    within: [routes.staff.attendance, routes.staff.profile, routes.staff.reports, '/staff/requests', '/staff/expenses'],
  },
  { key: 'crm', label: 'CRM', icon: 'briefcase', route: routes.staff.crm, within: [] },
  { key: 'chat', label: 'Chat', icon: 'chat', route: routes.staff.chat, within: [] },
  { key: 'settings', label: 'Settings', icon: 'settings', route: routes.staff.settings, within: [routes.staff.permissions, routes.staff.more] },
];

export const SHELL_TABS: Record<ShellVariant, readonly ShellTab[]> = { admin: adminTabs, staff: staffTabs };

/** Role 1 gets the admin shell; managers and staff always get the staff shell (also inside `/admin/*` shortcuts). */
export function variantForRole(role: number | null | undefined): ShellVariant {
  return role === 1 ? 'admin' : 'staff';
}

const matchesPrefix = (pathname: string, prefix: string): boolean => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Normalise `/admin/home/`, `/admin/home?x=1` and hash fragments. */
export function normalizePathname(pathname: string): string {
  const base = pathname.split(/[?#]/)[0] ?? '';
  return base.length > 1 ? base.replace(/\/+$/, '') : base || '/';
}

/** Which tab is highlighted for `pathname` (tab root, nested route or a sub-area of the tab); null if none. */
export function activeTabKey(pathname: string, variant: ShellVariant): ShellTabKey | null {
  const path = normalizePathname(pathname);
  const tabs = SHELL_TABS[variant];
  const direct = tabs.find((t) => matchesPrefix(path, t.route));
  if (direct) return direct.key;
  const parent = tabs.find((t) => t.within.some((p) => matchesPrefix(path, p)));
  return parent ? parent.key : null;
}

export type BadgeCounts = { chat: number; announcements: number; crm: number; requests?: number; liveChat?: number };

/** Badge number of a tab. Chat = chat + announcements; CRM = new leads (hidden while the CRM tab is open); Support = unread live-chat messages. */
export function tabBadgeCount(key: ShellTabKey, counts: BadgeCounts, activeKey: ShellTabKey | null): number {
  const safe = (n: number | undefined) => (Number.isFinite(n) && (n as number) > 0 ? Math.floor(n as number) : 0);
  switch (key) {
    case 'chat':
      return safe(counts.chat) + safe(counts.announcements);
    case 'crm':
      return activeKey === 'crm' ? 0 : safe(counts.crm);
    case 'support':
      return safe(counts.liveChat);
    default:
      return 0;
  }
}

export const formatBadgeCount = (n: number): string => (n > 99 ? '99+' : String(n));

// ── plan gate ────────────────────────────────────────────────────────────────

/** Subset of `useOrgPlan()` the gate needs. */
export type PlanAccess = {
  isLoading: boolean;
  isBlocked: (feature: 'crm') => boolean;
  message: (feature: 'crm') => string;
};

export type GateDecision = { allowed: true } | { allowed: false; message: string };

export const DEFAULT_PLAN_BLOCK_MESSAGE = 'Please upgrade your plan to access this feature.';

/**
 * Decision for pressing the CRM tab. Tabs always stay visible and are blocked on use (v1 behaviour). The plan
 * comes from the plan-status API for every role (fixes the v1 defect that blocked staff/managers outside a free
 * trial). While the status is still loading the press is allowed (the CRM screen applies its own gate) so a
 * slow request never blocks a paying customer; a loaded status that blocks CRM shows the plan message.
 */
export function decideCrmPress(plan: PlanAccess): GateDecision {
  if (plan.isLoading) return { allowed: true };
  if (!plan.isBlocked('crm')) return { allowed: true };
  return { allowed: false, message: plan.message('crm') || DEFAULT_PLAN_BLOCK_MESSAGE };
}

// ── responsive switch ────────────────────────────────────────────────────────

/**
 * Sidebar vs bottom bar. Web: sidebar from the tablet breakpoint up. Native: only on tablets (shortest side
 * >= 600 dp) in a width that fits a sidebar — phones, even in landscape, keep the bottom bar.
 */
export function shouldUseSidebar(input: { width: number; height: number; platform: string }): boolean {
  const { width, height, platform } = input;
  if (platform === 'web') return width >= breakpoints.tablet;
  return Math.min(width, height) >= 600 && width >= breakpoints.tablet;
}
