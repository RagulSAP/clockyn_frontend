/**
 * Auth store: the persisted session, role / org selectors, sign-in / sign-out and the teardown registry.
 *
 * - The server issues an opaque bearer `accessToken` at login (OTP / trusted-device step / registration); it is kept in the
 *   session (same persisted blob) and attached by the HTTP client. Sessions without one (older server) keep working.
 *   A per-device `deviceToken` (staff/managers only) enables the single-device session check.
 * - `orgId` is the org-scope id (`current_org_id || user_id`) used by nearly every API call.
 * - The store is REACTIVE: route guards, session watcher, sockets and location tracking subscribe to it (no cold-start snapshot).
 * - `signOut()` is the ONE logout function: it runs registered teardowns (location tracking, sockets, push …), clears
 *   the session, badges, query cache and persisted per-user data, and preserves `lastOrg` per user and the device token.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RoleId } from '@/config/routes';
import { ApiError, businessError } from '@/lib/api/errors';
import { resetQueryCache } from '@/lib/query/queryClient';
import { STORAGE_KEYS, clearSessionStorage, getString, setString, storageKeyFor } from '@/lib/storage';

import { resetBadges } from './badges';
import { useUiStore, type SignOutReason } from './ui';

export type { RoleId, SignOutReason };

export type Session = {
  userId: string;
  /** Org scope id: `current_org_id || user_id`. */
  orgId: string;
  orgName: string;
  roleId: 1 | 2 | 3;
  email?: string;
  /** Role-2 feature names enabled by the admin (must match backend strings exactly). */
  managerPermissions: string[];
  planId?: number | null;
  isFreeTrial?: boolean;
  /** `YYYY-MM-DD` / ISO date. */
  freeTrialEnd?: string | null;
  /** Staff/manager only (absent for admins). */
  deviceToken?: string;
  /** Set to 0 after an account-deletion request. */
  isActive?: number;
  name?: string;
  /** Opaque bearer token issued by the server at login (absent when none was issued). */
  accessToken?: string;
  /** Epoch ms at which `accessToken` expires (informational: the server decides). */
  tokenExpiresAt?: number;
};

// ─── session validation ─────────────────────────────────────────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

function toRole(v: unknown): 1 | 2 | 3 | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return n === 1 || n === 2 || n === 3 ? n : null;
}

function toPlanId(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Validate / normalise anything claiming to be a session. `null` when it cannot be a usable session. */
export function sanitizeSession(raw: unknown): Session | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const userId = str(r.userId);
  const roleId = toRole(r.roleId);
  if (!userId || !roleId) return null;
  const session: Session = {
    userId,
    orgId: str(r.orgId) ?? userId,
    orgName: typeof r.orgName === 'string' ? r.orgName : '',
    roleId,
    managerPermissions: Array.isArray(r.managerPermissions) ? r.managerPermissions.filter((p): p is string => typeof p === 'string') : [],
  };
  const email = str(r.email);
  if (email) session.email = email;
  const planId = toPlanId(r.planId);
  if (planId !== undefined) session.planId = planId;
  if (typeof r.isFreeTrial === 'boolean') session.isFreeTrial = r.isFreeTrial;
  if (r.freeTrialEnd === null) session.freeTrialEnd = null;
  else if (typeof r.freeTrialEnd === 'string') session.freeTrialEnd = r.freeTrialEnd;
  const deviceToken = str(r.deviceToken);
  if (deviceToken) session.deviceToken = deviceToken;
  if (typeof r.isActive === 'number') session.isActive = r.isActive;
  const name = str(r.name);
  if (name) session.name = name;
  const accessToken = str(r.accessToken);
  if (accessToken) {
    session.accessToken = accessToken;
    if (typeof r.tokenExpiresAt === 'number' && Number.isFinite(r.tokenExpiresAt)) session.tokenExpiresAt = r.tokenExpiresAt;
  }
  return session;
}

/** `{ accessToken, tokenExpiresAt }` for a token issued now with a lifetime of `expiresInSec` seconds. */
export function tokenFields(accessToken?: string | null, expiresInSec?: number | null, now: number = Date.now()): Pick<Session, 'accessToken' | 'tokenExpiresAt'> {
  const token = str(accessToken);
  if (!token) return {};
  return typeof expiresInSec === 'number' && Number.isFinite(expiresInSec) && expiresInSec > 0
    ? { accessToken: token, tokenExpiresAt: now + expiresInSec * 1000 }
    : { accessToken: token };
}

// ─── store ─────────────────────────────────────────────────────────────────────────────────────

interface AuthState {
  session: Session | null;
  /** True once the persisted session has been read (success or failure). */
  hydrated: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], { session: Session | null }>(
    () => ({ session: null, hydrated: false }),
    {
      name: STORAGE_KEYS.auth,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ session: state.session }),
      merge: (persisted, current) => ({
        ...current,
        session: sanitizeSession((persisted as { session?: unknown } | undefined)?.session),
      }),
      // Runs after the read attempt, also when it failed (corrupt / unavailable storage): never leave the app on the splash.
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

// ─── selectors / hooks ─────────────────────────────────────────────────────────────────────────

export const useSession = (): Session | null => useAuthStore((s) => s.session);
export const useRole = (): RoleId | null => useAuthStore((s) => s.session?.roleId ?? null);
/** Org scope id, or '' when signed out (never undefined — safe in template strings / query keys). */
export const useOrgId = (): string => useAuthStore((s) => s.session?.orgId ?? '');
export const useUserId = (): string => useAuthStore((s) => s.session?.userId ?? '');
export const useIsAdmin = (): boolean => useAuthStore((s) => s.session?.roleId === 1);
export const useIsManager = (): boolean => useAuthStore((s) => s.session?.roleId === 2);
export const useAuthHydrated = (): boolean => useAuthStore((s) => s.hydrated);
const NO_PERMISSIONS: string[] = [];
export const useManagerPermissions = (): string[] => useAuthStore((s) => s.session?.managerPermissions ?? NO_PERMISSIONS);

/** Admins have every permission; managers only the ones granted; staff none. */
export function hasPermission(session: Session | null, permission: string): boolean {
  if (!session) return false;
  if (session.roleId === 1) return true;
  if (session.roleId === 2) return session.managerPermissions.includes(permission);
  return false;
}
export const useHasPermission = (permission: string): boolean => useAuthStore((s) => hasPermission(s.session, permission));

/** Non-React access. */
export const getSession = (): Session | null => useAuthStore.getState().session;
export const isHydrated = (): boolean => useAuthStore.getState().hydrated;
/** Bearer token of the current session (undefined when signed out or none was issued). */
export const getAccessToken = (): string | undefined => getSession()?.accessToken;

// ─── last org (admins with several companies) ──────────────────────────────────────────────────

/** Last company an admin was viewing (survives sign-out; the login flow re-selects it). */
export async function getLastOrg(userId: string): Promise<string | null> {
  const v = await getString(storageKeyFor(STORAGE_KEYS.lastOrg, userId));
  return v && v.trim() !== '' ? v : null;
}

export async function setLastOrg(userId: string, orgId: string): Promise<void> {
  if (!userId || !orgId) return;
  await setString(storageKeyFor(STORAGE_KEYS.lastOrg, userId), orgId);
}

/** Epoch ms of the last sign-in (for the grace window before the single-device session check). */
export async function getLastLoginAt(): Promise<number | null> {
  const v = await getString(STORAGE_KEYS.lastLoginAt);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

// ─── sign in / patch ─────────────────────────────────────────────────────────────────────────────

/** Persist a new session. Throws if the session is not valid (validate the role BEFORE calling). */
export function signIn(session: Session): void {
  const next = sanitizeSession(session);
  if (!next) throw new Error('Invalid session');
  const prev = getSession();
  if (prev && prev.userId !== next.userId) {
    // Account switch without an explicit sign-out: never show the previous user's cached data.
    void resetQueryCache();
    resetBadges();
  }
  useAuthStore.setState({ session: next });
  useUiStore.getState().clearSignOutNotice();
  void setString(STORAGE_KEYS.lastLoginAt, String(Date.now()));
  if (next.roleId === 1) void setLastOrg(next.userId, next.orgId);
}

/** Merge changes into the current session (company switch, plan refresh, deletion request …). No-op when signed out. */
export function patchSession(patch: Partial<Session>): void {
  const current = getSession();
  if (!current) return;
  const next = sanitizeSession({ ...current, ...patch });
  if (!next) return;
  useAuthStore.setState({ session: next });
  if (next.roleId === 1 && next.orgId !== current.orgId) void setLastOrg(next.userId, next.orgId);
}

// ─── teardown registry & sign out ───────────────────────────────────────────────────────────────

export interface TeardownContext {
  reason: SignOutReason;
  /** The session that is being signed out (null when none was active). */
  session: Session | null;
}
export type TeardownFn = (ctx: TeardownContext) => void | Promise<void>;

const teardowns = new Set<TeardownFn>();

/**
 * Register cleanup to run on sign-out (stop location tracking, close sockets, unregister push …).
 * Lives here so other layers can register without circular imports. Returns an unregister function.
 * Teardowns run in parallel; each is time-boxed (3 s) and a failing one never blocks the sign-out.
 */
export function registerTeardown(fn: TeardownFn): () => void {
  teardowns.add(fn);
  return () => {
    teardowns.delete(fn);
  };
}

export const TEARDOWN_TIMEOUT_MS = 3000;

async function runTeardown(fn: TeardownFn, ctx: TeardownContext): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => fn(ctx)),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, TEARDOWN_TIMEOUT_MS);
      }),
    ]);
  } catch {
    console.warn('[auth] a sign-out teardown failed');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let inflightSignOut: Promise<void> | null = null;

async function performSignOut(reason: SignOutReason): Promise<void> {
  const session = getSession();
  const ctx: TeardownContext = { reason, session };

  // 1. Stop everything that talks to the backend on behalf of this user.
  await Promise.all([...teardowns].map((fn) => runTeardown(fn, ctx)));

  // 2. Remember the admin's current company, then drop the session (reactive guards redirect from here).
  if (session && session.orgId) await setLastOrg(session.userId, session.orgId);
  useUiStore.getState().setSignOutNotice(reason === 'logout' || reason === 'expired' ? null : reason);
  useAuthStore.setState({ session: null });

  // 3. Purge everything derived from the old session.
  resetBadges();
  await resetQueryCache();
  await clearSessionStorage();
}

/**
 * Full sign-out (idempotent; concurrent calls share one run — e.g. the session poll and a push `force_logout`).
 * Does not navigate: route guards react to the cleared session (or call `goToWelcome()` from `@/lib/navigation`).
 * Keeps: device token per mobile (OTP can be skipped next time), `lastOrg`, theme and app prompts.
 */
export function signOut(opts: { reason?: SignOutReason } = {}): Promise<void> {
  if (!inflightSignOut) {
    inflightSignOut = performSignOut(opts.reason ?? 'logout').finally(() => {
      inflightSignOut = null;
    });
  }
  return inflightSignOut;
}

// ─── login-response mappers (shared/api/login.md → Session) ────────────────────────────────────

export type LoginPortal = 'admin' | 'staff';

/** Union of the admin-login, employee-login and verify-device-token success bodies (all fields optional). */
export interface LoginResponse {
  success?: boolean;
  message?: string;
  user_id?: string;
  email?: string | null;
  org_name?: string | null;
  org_id?: string | null;
  current_org_id?: string | null;
  role_id?: number | string | null;
  org_logo?: string | null;
  plan_id?: number | string | null;
  is_free_trial?: boolean | null;
  free_trial_end?: string | null;
  manager_permissions?: string[] | null;
  /** Present when the body itself carries the token (verify-device-token). */
  access_token?: string | null;
  expires_in?: number | null;
}

export const ACCESS_DENIED_ADMIN = 'Access denied. Admin credentials required.';
export const ACCESS_DENIED_STAFF = 'Access denied. Employee credentials required.';

function accessDenied(message: string, body: unknown): ApiError {
  return new ApiError({ status: 403, message, detail: message, raw: body });
}

export interface LoginMapOptions {
  /** Staff/manager: `newDeviceToken || storedToken`. */
  deviceToken?: string | null;
  /** Admin: company the admin last viewed (from `getLastOrg` + a successful `/company/details`) — overrides the login org. */
  orgOverride?: { orgId: string; orgName?: string | null } | null;
  /** Bearer token from the OTP / trusted-device step that preceded the login lookup (the lookup itself returns none). */
  accessToken?: string | null;
  /** Lifetime of `accessToken` in seconds. */
  expiresIn?: number | null;
}

/**
 * Map a successful login body to a Session, VALIDATING the role for the portal first
 * (admin portal => role 1; staff portal => role 2 or 3). Throws `ApiError`:
 *  - `{ success:false }` bodies surface the server message,
 *  - wrong role => 403 'Access denied. Admin credentials required.' / '… Employee credentials required.'
 */
export function sessionFromLogin(res: LoginResponse, portal: LoginPortal, opts: LoginMapOptions = {}): Session {
  if (res.success === false) throw businessError(res, 'Login failed');
  const userId = str(res.user_id);
  const roleId = toRole(res.role_id);
  if (!userId || !roleId) throw new ApiError({ status: 200, message: 'Login failed. Please try again.', raw: res });
  if (portal === 'admin' && roleId !== 1) throw accessDenied(ACCESS_DENIED_ADMIN, res);
  if (portal === 'staff' && roleId === 1) throw accessDenied(ACCESS_DENIED_STAFF, res);

  const serverOrgId = str(res.org_id) ?? str(res.current_org_id) ?? userId;
  const override = portal === 'admin' ? opts.orgOverride : null;
  const orgId = str(override?.orgId) ?? serverOrgId;
  const orgName = (override?.orgId && str(override.orgName)) || str(res.org_name) || '';

  const session: Session = {
    userId,
    orgId,
    orgName,
    roleId,
    managerPermissions: roleId === 2 && Array.isArray(res.manager_permissions) ? res.manager_permissions.filter((p): p is string => typeof p === 'string') : [],
  };
  const email = str(res.email);
  if (email) session.email = email;

  if (portal === 'admin') {
    const planId = toPlanId(res.plan_id);
    if (planId !== undefined) session.planId = planId;
    session.isFreeTrial = res.is_free_trial === true;
    session.freeTrialEnd = typeof res.free_trial_end === 'string' ? res.free_trial_end : null;
  } else {
    const token = str(opts.deviceToken);
    if (token) session.deviceToken = token;
  }
  Object.assign(session, tokenFields(opts.accessToken ?? str(res.access_token), opts.expiresIn ?? res.expires_in));
  return session;
}

/** Convenience wrappers. */
export const sessionFromAdminLogin = (res: LoginResponse, opts?: LoginMapOptions): Session => sessionFromLogin(res, 'admin', opts);
export const sessionFromStaffLogin = (res: LoginResponse, opts?: LoginMapOptions): Session => sessionFromLogin(res, 'staff', opts);

/** Session for a freshly registered company admin (`POST /auth/register` result). */
export function sessionFromRegistration(input: {
  userId: string;
  orgName: string;
  orgId?: string | null;
  email?: string | null;
  accessToken?: string | null;
  expiresIn?: number | null;
}): Session {
  const userId = str(input.userId);
  if (!userId) throw new ApiError({ status: 200, message: 'Registration failed. Please try again.' });
  const session: Session = {
    userId,
    orgId: str(input.orgId) ?? userId,
    orgName: input.orgName ?? '',
    roleId: 1,
    managerPermissions: [],
  };
  const email = str(input.email);
  if (email) session.email = email;
  Object.assign(session, tokenFields(input.accessToken, input.expiresIn));
  return session;
}

/** Organisation logo URL carried by a login body (not part of the Session — cache it via the company query). */
export function logoFromLogin(res: LoginResponse): string | null {
  return str(res.org_logo) ?? null;
}
