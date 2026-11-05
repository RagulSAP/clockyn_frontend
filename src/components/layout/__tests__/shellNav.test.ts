import { isPlanFeatureBlocked, planBlockMessage } from '@/config/plans';
import {
  activeTabKey,
  DEFAULT_PLAN_BLOCK_MESSAGE,
  decideCrmPress,
  formatBadgeCount,
  normalizePathname,
  SHELL_TABS,
  shouldUseSidebar,
  tabBadgeCount,
  variantForRole,
  type PlanAccess,
} from '../shellNav';

/** Same shape `useOrgPlan()` returns, built from the real plan matrix. */
const planOf = (planId: number | null, isFreeTrial = false, isExpired = false, isLoading = false): PlanAccess => ({
  isLoading,
  isBlocked: (feature) => isPlanFeatureBlocked(planId, isFreeTrial, isExpired, feature),
  message: () => planBlockMessage(planId, isFreeTrial, isExpired),
});

describe('decideCrmPress (plan gate on the CRM tab)', () => {
  it('blocks Core with the Prime-only message', () => {
    expect(decideCrmPress(planOf(1))).toEqual({
      allowed: false,
      message: 'This feature is available only in the Prime plan. Please upgrade your plan to access it.',
    });
  });
  it('blocks Prime with the Elite-only message', () => {
    expect(decideCrmPress(planOf(2))).toEqual({
      allowed: false,
      message: 'This feature is available only in the Elite plan. Please upgrade your plan to access it.',
    });
  });
  it('allows Elite and free trial', () => {
    expect(decideCrmPress(planOf(3))).toEqual({ allowed: true });
    expect(decideCrmPress(planOf(null, true))).toEqual({ allowed: true });
    expect(decideCrmPress(planOf(1, true))).toEqual({ allowed: true });
  });
  it('blocks expired / no plan with the trial-ended message', () => {
    const expected = {
      allowed: false,
      message: 'Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.',
    };
    expect(decideCrmPress(planOf(3, false, true))).toEqual(expected);
    expect(decideCrmPress(planOf(null))).toEqual(expected);
  });
  it('allows while the plan status is loading (no stale-null block as in v1)', () => {
    expect(decideCrmPress(planOf(null, false, false, true))).toEqual({ allowed: true });
  });
  it('falls back to a generic message when the plan layer provides none', () => {
    expect(decideCrmPress({ isLoading: false, isBlocked: () => true, message: () => '' })).toEqual({
      allowed: false,
      message: DEFAULT_PLAN_BLOCK_MESSAGE,
    });
  });
  it('a staff user with a loaded Elite status is not blocked (v1 defect: plan_id was never stored for staff)', () => {
    expect(decideCrmPress(planOf(3))).toEqual({ allowed: true });
  });
});

describe('variantForRole', () => {
  it('admin gets the admin shell; manager and staff the staff shell', () => {
    expect(variantForRole(1)).toBe('admin');
    expect(variantForRole(2)).toBe('staff');
    expect(variantForRole(3)).toBe('staff');
    expect(variantForRole(null)).toBe('staff');
  });
});

describe('SHELL_TABS', () => {
  it('has Home, CRM, Chat, Settings in order for both variants', () => {
    for (const v of ['admin', 'staff'] as const) {
      expect(SHELL_TABS[v].map((t) => t.label)).toEqual(['Home', 'CRM', 'Chat', 'Settings']);
    }
    expect(SHELL_TABS.admin.map((t) => t.route)).toEqual(['/admin/home', '/admin/crm', '/admin/chat', '/admin/settings']);
    expect(SHELL_TABS.staff.map((t) => t.route)).toEqual(['/staff/home', '/staff/crm', '/staff/chat', '/staff/settings']);
  });
});

describe('activeTabKey', () => {
  it('matches tab roots and nested routes', () => {
    expect(activeTabKey('/admin/home', 'admin')).toBe('home');
    expect(activeTabKey('/admin/crm/leads/edit', 'admin')).toBe('crm');
    expect(activeTabKey('/staff/chat/direct', 'staff')).toBe('chat');
  });
  it('highlights the parent tab for sub-areas', () => {
    expect(activeTabKey('/admin/staff/detail', 'admin')).toBe('home');
    expect(activeTabKey('/admin/billing/checkout', 'admin')).toBe('settings');
    expect(activeTabKey('/staff/requests/leave', 'staff')).toBe('home');
    expect(activeTabKey('/staff/permissions', 'staff')).toBe('settings');
  });
  it('does not match on a shared string prefix', () => {
    expect(activeTabKey('/admin/homeless', 'admin')).toBeNull();
  });
  it('highlights nothing for a manager browsing admin shortcut pages with the staff shell', () => {
    expect(activeTabKey('/admin/staff', 'staff')).toBeNull();
  });
  it('normalises trailing slashes and query strings', () => {
    expect(normalizePathname('/admin/home/')).toBe('/admin/home');
    expect(normalizePathname('/admin/home?x=1')).toBe('/admin/home');
    expect(activeTabKey('/admin/chat/', 'admin')).toBe('chat');
  });
});

describe('tabBadgeCount', () => {
  const counts = { chat: 3, announcements: 2, crm: 4 };
  it('chat = chat + announcements', () => {
    expect(tabBadgeCount('chat', counts, 'home')).toBe(5);
  });
  it('crm badge is hidden while on the CRM tab', () => {
    expect(tabBadgeCount('crm', counts, 'home')).toBe(4);
    expect(tabBadgeCount('crm', counts, 'crm')).toBe(0);
  });
  it('home and settings never show a badge', () => {
    expect(tabBadgeCount('home', counts, null)).toBe(0);
    expect(tabBadgeCount('settings', counts, null)).toBe(0);
  });
  it('is defensive against bad numbers', () => {
    expect(tabBadgeCount('chat', { chat: -1, announcements: Number.NaN, crm: 0 }, null)).toBe(0);
  });
  it('caps the label at 99+', () => {
    expect(formatBadgeCount(99)).toBe('99');
    expect(formatBadgeCount(100)).toBe('99+');
    expect(formatBadgeCount(5)).toBe('5');
  });
});

describe('shouldUseSidebar', () => {
  it('web: sidebar from the tablet breakpoint', () => {
    expect(shouldUseSidebar({ width: 767, height: 900, platform: 'web' })).toBe(false);
    expect(shouldUseSidebar({ width: 768, height: 600, platform: 'web' })).toBe(true);
    expect(shouldUseSidebar({ width: 1440, height: 900, platform: 'web' })).toBe(true);
  });
  it('native: tablets only', () => {
    expect(shouldUseSidebar({ width: 390, height: 844, platform: 'ios' })).toBe(false);
    expect(shouldUseSidebar({ width: 932, height: 430, platform: 'ios' })).toBe(false); // phone landscape
    expect(shouldUseSidebar({ width: 820, height: 1180, platform: 'ios' })).toBe(true); // iPad portrait
    expect(shouldUseSidebar({ width: 600, height: 960, platform: 'android' })).toBe(false); // too narrow for a sidebar
  });
});
