/**
 * Sign-in helpers.
 *  - `loginAs(page, role)`   fast path: seeds the persisted auth store (+ the storage keys the app consults) into
 *                            localStorage BEFORE the first navigation, so the app boots already signed in.
 *  - `loginViaUi(page, role)` drives the real welcome -> portal -> mobile -> OTP screens against the mock.
 *
 * Storage format (verified against src/store/auth.ts + src/lib/storage.ts): AsyncStorage on web is `localStorage`
 * under the exact key; the zustand persist blob is `{ state: { session }, version: 1 }`.
 */
import { expect, type Page } from '@playwright/test';

import { MANAGER_PERMISSIONS, ORG, OTP, USERS, type PlanState, type Role } from './fixtures';
import type { MockClient } from './mock';
import { boundMock } from './registry';

export const STORAGE = {
  auth: '@clockyn/auth',
  lastLoginAt: '@clockyn/last-login-at',
  deviceToken: '@clockyn/device-token',
  onboardingDone: '@clockyn/permissions-onboarding-done',
  rateAppDone: '@clockyn/rate-app-done',
  planPopupShown: '@clockyn/plan-popup-shown',
  themePreference: '@clockyn/theme-preference',
} as const;

/** Shape of the persisted session (src/store/auth.ts `Session`). */
export interface SessionSeed {
  userId: string;
  orgId: string;
  orgName: string;
  roleId: 1 | 2 | 3;
  email?: string;
  managerPermissions: string[];
  planId?: number | null;
  isFreeTrial?: boolean;
  freeTrialEnd?: string | null;
  deviceToken?: string;
  isActive?: number;
  name?: string;
  /** Bearer token (set by `loginAs` only when the mock runs with MOCK_REQUIRE_AUTH=1). */
  accessToken?: string;
}

export interface LoginAsOptions {
  /** Mock client used to read the current plan state (defaults to the one bound to the page by the `page` fixture). */
  mock?: MockClient;
  /** Override the plan the session carries (default: whatever the mock currently simulates). */
  plan?: PlanState;
  /** Org scope id (default: the seeded organisation). */
  orgId?: string;
  /** Merge/override session fields. */
  session?: Partial<SessionSeed>;
  /** Manager permissions (role 2 only; default: all ten). */
  permissions?: string[];
  /** true = the first-run permission onboarding overlay is NOT suppressed. */
  showOnboarding?: boolean;
  /** true = the daily plan-expiry popup is NOT suppressed. */
  showPlanPopup?: boolean;
  /** true = `last-login-at` is "now", so the 5-minute grace window before the single-device check applies. */
  freshLogin?: boolean;
  /** Persist the trusted-device token for the user's mobile (lets a later UI login skip the OTP). Default true. */
  rememberDevice?: boolean;
  /** 'light' | 'dark' | 'system' stored as the manual theme preference. */
  theme?: 'light' | 'dark' | 'system';
  /** Extra raw localStorage entries. */
  storage?: Record<string, string>;
}

const planToSession = (plan: PlanState): Pick<SessionSeed, 'planId' | 'isFreeTrial' | 'freeTrialEnd'> => {
  switch (plan) {
    case 'trial':
      return { planId: null, isFreeTrial: true, freeTrialEnd: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10) };
    case 'none':
      return { planId: null, isFreeTrial: false, freeTrialEnd: null };
    case 'core':
      return { planId: 1, isFreeTrial: false, freeTrialEnd: null };
    case 'prime':
      return { planId: 2, isFreeTrial: false, freeTrialEnd: null };
    default:
      return { planId: 3, isFreeTrial: false, freeTrialEnd: null };
  }
};

const istDate = (): string => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** The session object `loginAs` would persist for `role` (useful for assertions). */
export async function sessionFor(role: Role, opts: LoginAsOptions = {}, page?: Page): Promise<SessionSeed> {
  const u = USERS[role];
  const mock = opts.mock ?? (page ? boundMock(page) : undefined);
  const plan: PlanState = opts.plan ?? (mock ? (await mock.state()).plan : 'elite');
  const session: SessionSeed = {
    userId: u.userId,
    orgId: opts.orgId ?? ORG.id,
    orgName: ORG.name,
    roleId: u.roleId,
    email: u.email,
    name: u.name,
    managerPermissions: u.roleId === 2 ? (opts.permissions ?? MANAGER_PERMISSIONS) : [],
  };
  if (u.roleId === 1) Object.assign(session, planToSession(plan));
  else if (u.deviceToken) session.deviceToken = u.deviceToken;
  return { ...session, ...(opts.session ?? {}) };
}

/**
 * Boot the app already signed in as `role` ('admin' | 'manager' | 'staff' | 'fieldStaff').
 * Must be called BEFORE `page.goto(...)` (it registers an init script). The seed is applied once per tab: a later
 * in-app sign-out stays signed out across reloads.
 */
export async function loginAs(page: Page, role: Role, opts: LoginAsOptions = {}): Promise<SessionSeed> {
  const u = USERS[role];
  const session = await sessionFor(role, opts, page);
  // MOCK_REQUIRE_AUTH=1 (the mock enforces Bearer tokens like REQUIRE_AUTH=1 on the real backend): a seeded session needs a token.
  const persisted: SessionSeed = /^(1|true|yes|on)$/i.test(process.env.MOCK_REQUIRE_AUTH || '') && !session.accessToken
    ? { ...session, accessToken: `tok-seed-${session.userId}` }
    : session;
  const items: Record<string, string> = {
    [STORAGE.auth]: JSON.stringify({ state: { session: persisted }, version: 1 }),
    [STORAGE.lastLoginAt]: String(opts.freshLogin ? Date.now() : Date.now() - 11 * 60_000),
    [STORAGE.rateAppDone]: 'true',
    ...(opts.theme ? { [STORAGE.themePreference]: opts.theme } : {}),
    ...(opts.storage ?? {}),
  };
  if (!opts.showOnboarding) items[`${STORAGE.onboardingDone}:${u.userId}`] = 'true';
  if (!opts.showPlanPopup) items[`${STORAGE.planPopupShown}:${istDate()}:${session.orgId}`] = 'true';
  if (opts.rememberDevice !== false && u.deviceToken) items[`${STORAGE.deviceToken}:${u.mobile}`] = u.deviceToken;

  await page.addInitScript((seed: Record<string, string>) => {
    try {
      if (window.sessionStorage.getItem('__e2e_seeded') === '1') return;
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, v);
      window.sessionStorage.setItem('__e2e_seeded', '1');
    } catch {
      /* about:blank and other opaque origins have no storage */
    }
  }, items);
  return session;
}

/** Seed arbitrary localStorage entries before the first navigation (once per tab). */
export async function seedStorage(page: Page, items: Record<string, string>): Promise<void> {
  await page.addInitScript((seed: Record<string, string>) => {
    try {
      if (window.sessionStorage.getItem('__e2e_extra') === '1') return;
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, v);
      window.sessionStorage.setItem('__e2e_extra', '1');
    } catch {
      /* ignore */
    }
  }, items);
}

/** Read the persisted session back from the page (null when signed out). */
export async function readSession(page: Page): Promise<SessionSeed | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { state?: { session?: SessionSeed | null } }).state?.session ?? null;
    } catch {
      return null;
    }
  }, STORAGE.auth);
}

export interface LoginViaUiOptions {
  /** Mobile number to type (default: the fixture user's). */
  mobile?: string;
  /** OTP to type (default: the mock's accepted OTP). */
  otp?: string;
  /** Wait for the role home after the last step (default true). */
  waitForHome?: boolean;
}

/**
 * Real UI login: welcome -> portal card -> mobile -> "Get OTP" -> OTP -> "Verify & Continue".
 * Admin uses the Admin Portal; manager / staff / fieldStaff use Employee Access.
 */
export async function loginViaUi(page: Page, role: Role, opts: LoginViaUiOptions = {}): Promise<void> {
  const u = USERS[role];
  const admin = u.roleId === 1;
  await page.goto('/');
  await page.getByTestId(admin ? 'portal-admin' : 'portal-staff').click();
  await expect(page.getByTestId('login-card')).toBeVisible();
  await page.getByTestId('mobile-input').fill(opts.mobile ?? u.mobile);
  await page.getByTestId('login-action').click(); // Get OTP
  const otp = page.getByTestId('otp-input'); // the testID sits on the single (near-invisible) input behind the boxes
  await expect(otp).toBeVisible();
  await otp.fill(opts.otp ?? OTP);
  await page.getByTestId('login-action').click(); // Verify & Continue
  if (opts.waitForHome !== false) await page.waitForURL(admin ? '**/admin/home' : '**/staff/home', { timeout: 20_000 });
}

/**
 * Sign out through the UI and confirm the dialog. Wide screens use the sidebar button; phones go through
 * Settings (admin: Beyond -> Logout, staff/manager: Logout).
 */
export async function logoutViaUi(page: Page, role: Role = 'admin'): Promise<void> {
  const sidebar = page.getByTestId('sidebar-signout');
  if (await sidebar.isVisible().catch(() => false)) {
    await sidebar.click();
  } else {
    const admin = USERS[role].roleId === 1;
    await page.goto(admin ? '/admin/settings' : '/staff/settings');
    if (admin) await page.getByText('Beyond', { exact: true }).first().click();
    const item = page.getByText('Logout', { exact: true }).first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
  }
  await page.getByRole('button', { name: 'Logout' }).last().click(); // confirmation dialog
}
