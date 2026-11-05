/**
 * Typed navigation helpers over expo-router.
 * Route paths come ONLY from `@/config/routes`; params are flat primitives (never JSON blobs — pass ids and re-read from the query cache).
 */
import { useMemo } from 'react';
import { router as globalRouter, useRouter, type Href } from 'expo-router';

import { homeForRole, routes, type AppRoute } from '@/config/routes';

export type { AppRoute };
export { routes };

export type RouteParamValue = string | number | boolean | null | undefined;
export type RouteParams = Record<string, RouteParamValue>;

/** Strip undefined/null params and stringify the rest (router params are strings). */
export function cleanParams(params?: RouteParams): Record<string, string> | undefined {
  if (!params) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = String(v);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Build the expo-router href object for a route + params. */
export function buildHref(route: AppRoute, params?: RouteParams): Href {
  const cleaned = cleanParams(params);
  // Cast: the generated typed-routes union is not tracked; `AppRoute` is the typed contract.
  return (cleaned ? { pathname: route, params: cleaned } : route) as unknown as Href;
}

export interface AppRouter {
  push: (route: AppRoute, params?: RouteParams) => void;
  replace: (route: AppRoute, params?: RouteParams) => void;
  back: () => void;
  /** Go back if there is history, otherwise replace with `fallback` (default: the welcome screen). */
  backOr: (fallback?: AppRoute, params?: RouteParams) => void;
  /** Pop the whole stack to its root. Safe to call when nothing can be dismissed. */
  dismissAll: () => void;
  canGoBack: () => boolean;
  /** Replace with the role's home (admin/manager shortcuts -> /admin/home for role 1, /staff/home otherwise). */
  goHome: (role: number | null | undefined) => void;
}

function safeDismissAll(r: { dismissAll: () => void }): void {
  try {
    r.dismissAll();
  } catch {
    // Nothing to dismiss (single-screen stack) — ignore.
  }
}

/** Hook version (stable identity per router instance). */
export function useAppRouter(): AppRouter {
  const r = useRouter();
  return useMemo<AppRouter>(
    () => ({
      push: (route, params) => r.push(buildHref(route, params)),
      replace: (route, params) => r.replace(buildHref(route, params)),
      back: () => r.back(),
      backOr: (fallback = routes.welcome, params) => {
        if (r.canGoBack()) r.back();
        else r.replace(buildHref(fallback, params));
      },
      dismissAll: () => safeDismissAll(r),
      canGoBack: () => r.canGoBack(),
      goHome: (role) => r.replace(buildHref(homeForRole(role ?? 0) as AppRoute)),
    }),
    [r],
  );
}

/** Imperative: replace with the role's home. Works outside React (bootstrap, notification taps). */
export function goHome(role: number | null | undefined): void {
  globalRouter.replace(buildHref(homeForRole(role ?? 0) as AppRoute));
}

/** Imperative: clear the stack and show the welcome screen (used after sign-out). */
export function goToWelcome(): void {
  safeDismissAll(globalRouter);
  globalRouter.replace(buildHref(routes.welcome));
}

/** Imperative push/replace for code that has no hook access (notification taps, deep links). */
export const navigate = {
  push: (route: AppRoute, params?: RouteParams): void => globalRouter.push(buildHref(route, params)),
  replace: (route: AppRoute, params?: RouteParams): void => globalRouter.replace(buildHref(route, params)),
};
