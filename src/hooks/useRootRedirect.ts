import { resolveRootRedirect, type RootRedirect } from '@/lib/routeGuard';
import { useAuthHydrated, useRole } from '@/store/auth';

/**
 * Decides what `/` (the welcome screen) should do.
 *
 * - `ready: false` — the persisted session has not been read yet; render nothing / a spinner (never the role
 *   chooser, to avoid a flash before redirecting).
 * - `href` set — a hydrated session exists: `<Redirect href={href} />` to the role home.
 * - `ready: true, href: null` — signed out: show the welcome screen.
 *
 * Reactive: it flips as soon as the auth store changes (sign-in elsewhere, forced logout), unlike the v1
 * cold-start snapshot.
 *
 * ```tsx
 * const { ready, href } = useRootRedirect();
 * if (!ready) return null;
 * if (href) return <Redirect href={href as Href} />;
 * ```
 */
export function useRootRedirect(): RootRedirect {
  const hydrated = useAuthHydrated();
  const role = useRole();
  return resolveRootRedirect({ hydrated, role });
}
