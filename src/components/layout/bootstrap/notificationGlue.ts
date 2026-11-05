/**
 * Glue between the platform notification layer and the router: which screen a tapped notification opens for the
 * signed-in user, and de-duplication of "open" events that arrive through more than one channel (remote tap,
 * local re-display tap, cold-start notification). Pure — the hook in `useNotificationRouting` does the navigation.
 */
import { homeForRole } from '@/config/routes';
import { openEventKey, parseNotificationTarget, type NotificationTarget, type PushMessage } from '@/lib/platform/notificationRouting';
import { ADMIN_AREA_ROLES, normalizeRole, STAFF_AREA_ROLES } from '@/lib/routeGuard';

export function areaOfRoute(route: string): 'admin' | 'staff' | null {
  if (route === '/admin' || route.startsWith('/admin/')) return 'admin';
  if (route === '/staff' || route.startsWith('/staff/')) return 'staff';
  return null;
}

/**
 * Target of a notification tap for this session.
 *  - signed out → null (a tap never opens a screen the user cannot see; they must sign in first)
 *  - unknown / non-navigational types (e.g. `force_logout`) → null
 *  - a target the role may not open (e.g. an admin-only screen for staff) → the role's home instead of a bounce
 */
export function resolveTapTarget(msg: Pick<PushMessage, 'data'>, session: { roleId: number } | null | undefined): NotificationTarget | null {
  const role = normalizeRole(session?.roleId);
  if (role === null) return null;
  const target = parseNotificationTarget(msg.data, { roleId: role });
  if (!target) return null;
  const area = areaOfRoute(target.route);
  if (area === 'admin' && !ADMIN_AREA_ROLES.includes(role)) return { route: homeForRole(role), params: {} };
  if (area === 'staff' && !STAFF_AREA_ROLES.includes(role)) return { route: homeForRole(role), params: {} };
  return target;
}

/** Returns a predicate that is true for a message already handled within `windowMs`. */
export function createOpenDeduper(windowMs = 5000, now: () => number = Date.now): (msg: PushMessage) => boolean {
  const seen = new Map<string, number>();
  return (msg) => {
    const t = now();
    for (const [k, at] of seen) if (t - at > windowMs) seen.delete(k);
    const key = openEventKey(msg);
    if (seen.has(key)) return true;
    seen.set(key, t);
    return false;
  };
}
