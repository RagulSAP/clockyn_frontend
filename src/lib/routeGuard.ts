/**
 * Pure decision logic for the role-guarded areas and the root redirect. Kept free of React / router
 * imports so it can be unit-tested; the layouts and `useRootRedirect` just feed it store values.
 */
import { homeForRole, ROLE, routes } from '@/config/routes';

export type Role = 1 | 2 | 3;

/** `/admin/*` is reachable by admins and (through the staff Settings shortcuts) managers. */
export const ADMIN_AREA_ROLES: readonly Role[] = [ROLE.admin, ROLE.manager];
/** `/staff/*` is for managers and staff. */
export const STAFF_AREA_ROLES: readonly Role[] = [ROLE.manager, ROLE.staff];

export function normalizeRole(role: unknown): Role | null {
  const n = typeof role === 'string' ? Number(role) : role;
  return n === 1 || n === 2 || n === 3 ? n : null;
}

export type GuardDecision = { status: 'loading' } | { status: 'allow' } | { status: 'redirect'; href: string };

/**
 * Guard for a role-restricted area.
 *  - not hydrated yet            -> loading (render a spinner, never redirect on stale state)
 *  - signed out / unknown role   -> redirect to the welcome screen
 *  - signed in with another role -> redirect to that role's home
 */
export function resolveAreaGuard(input: { hydrated: boolean; role: unknown; allowed: readonly Role[] }): GuardDecision {
  if (!input.hydrated) return { status: 'loading' };
  const role = normalizeRole(input.role);
  if (role === null) return { status: 'redirect', href: routes.welcome };
  if (input.allowed.includes(role)) return { status: 'allow' };
  return { status: 'redirect', href: homeForRole(role) };
}

export type RootRedirect = { ready: boolean; href: string | null };

/** `/` -> the role home once a hydrated session exists; otherwise stay on the welcome screen. */
export function resolveRootRedirect(input: { hydrated: boolean; role: unknown }): RootRedirect {
  if (!input.hydrated) return { ready: false, href: null };
  const role = normalizeRole(input.role);
  return { ready: true, href: role === null ? null : homeForRole(role) };
}
