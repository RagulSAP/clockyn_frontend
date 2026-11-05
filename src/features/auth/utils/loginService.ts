/**
 * Login orchestration shared by the admin and staff screens: lookup -> role validation -> session.
 * The role is validated BEFORE anything is persisted (v1 stored the session first and rejected afterwards).
 */
import { authApi, attendanceApi, companyApi, faceApi, homeApi } from '@/api';
import { todayIST } from '@/lib/datetime';
import { queryKeys } from '@/lib/query/queryKeys';
import { queryClient } from '@/lib/query/queryClient';
import { registerForPush } from '@/lib/platform/notifications';
import { logEvent } from '@/lib/platform/analytics';
import { getLastOrg, logoFromLogin, sessionFromLogin, type Session } from '@/store/auth';
import type { QueryClient } from '@tanstack/react-query';

import type { LoginPortalKind } from './loginMachine';

export interface LoginOutcome {
  session: Session;
  /** Company logo carried by the login body (not part of the session). */
  logoUrl: string | null;
}

export interface LoginDeps {
  login: typeof authApi.login;
  getLastOrg: (userId: string) => Promise<string | null>;
  getCompanyDetails: typeof companyApi.getCompanyDetails;
}

const defaultDeps: LoginDeps = {
  login: (mobile, portal) => authApi.login(mobile, portal),
  getLastOrg,
  getCompanyDetails: (orgId, opts) => companyApi.getCompanyDetails(orgId, opts),
};

/**
 * Looks the number up and builds the session for the portal.
 *  - admin portal: role 1 only; the company the admin last used (if it still exists) replaces the default one;
 *  - staff portal: roles 2 / 3 only; `deviceToken` is stored in the session (drives the single-device check).
 * `accessToken` / `expiresIn` come from the OTP / trusted-device step that preceded the lookup (the lookup returns none):
 * they go into the session and authorise the one call made before the session exists.
 * Throws `ApiError` (403 "Access denied. …" for the wrong role, server messages for `success:false`).
 */
export async function loginAndBuildSession(
  portal: LoginPortalKind,
  mobile: string,
  opts: { deviceToken?: string | null; accessToken?: string | null; expiresIn?: number | null } = {},
  deps: LoginDeps = defaultDeps,
): Promise<LoginOutcome> {
  const result = await deps.login(mobile, portal === 'admin' ? 'admin' : 'employee');
  const body = result.raw as Parameters<typeof sessionFromLogin>[0];

  // Throws for the wrong role before any extra network call or write.
  const { accessToken, expiresIn } = opts;
  let session = sessionFromLogin(body, portal, { deviceToken: opts.deviceToken, accessToken, expiresIn });

  if (portal === 'admin') {
    try {
      const lastOrg = await deps.getLastOrg(session.userId);
      if (lastOrg && lastOrg !== session.orgId) {
        const details = await deps.getCompanyDetails(lastOrg, accessToken ? { accessToken } : undefined);
        session = sessionFromLogin(body, portal, { orgOverride: { orgId: lastOrg, orgName: details.name }, accessToken, expiresIn });
      }
    } catch {
      // The restored company is a convenience: fall back to the one the server returned.
    }
  }
  return { session, logoUrl: logoFromLogin(body) };
}

/** Push token that never shows the OS dialog and never blocks (null when unavailable or slow). */
export async function softPushToken(timeoutMs = 2500): Promise<string | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await Promise.race([
      registerForPush({ prompt: false }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    return token ?? undefined;
  } catch {
    return undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Warm the first-paint queries of the role home so it opens populated (replaces v1's GlobalCache preload).
 * Fire-and-forget: failures are ignored, nothing waits for it. Uses the SAME query keys and API functions as the
 * home screens — keep them in sync (see docs/changes/B1.md).
 */
export function warmHomeQueries(session: Pick<Session, 'userId' | 'orgId' | 'roleId'>, client: QueryClient = queryClient): void {
  const staleTime = 10_000;
  const run = (p: Promise<unknown>) => void p.catch(() => undefined);
  if (session.roleId === 1) {
    const date = todayIST();
    run(
      client.prefetchQuery({
        queryKey: queryKeys.home.dashboard(session.orgId, { date }),
        queryFn: () => homeApi.getDashboardStats(session.orgId, { date }),
        staleTime,
      }),
    );
    run(client.prefetchQuery({ queryKey: queryKeys.home.branches(session.orgId), queryFn: () => homeApi.getBranches(session.orgId), staleTime }));
    return;
  }
  run(client.prefetchQuery({ queryKey: queryKeys.attendance.today(session.userId), queryFn: () => attendanceApi.getToday(session.userId), staleTime }));
  run(client.prefetchQuery({ queryKey: queryKeys.face.registered(session.userId), queryFn: () => faceApi.isFaceRegistered(session.userId), staleTime }));
}

/** Extra warm-up after a registration (v1 preloaded departments and the staff list too). */
export function warmRegistrationQueries(session: Pick<Session, 'userId' | 'orgId' | 'roleId'>, client: QueryClient = queryClient): void {
  warmHomeQueries(session, client);
  const staleTime = 10_000;
  const run = (p: Promise<unknown>) => void p.catch(() => undefined);
  run(client.prefetchQuery({ queryKey: queryKeys.home.departments(session.orgId), queryFn: () => homeApi.getDepartments(session.orgId), staleTime }));
  run(client.prefetchQuery({ queryKey: queryKeys.home.allStaff(session.orgId), queryFn: () => homeApi.getAllStaff(session.orgId), staleTime }));
}

export function trackLoginSuccess(): void {
  logEvent('LoginSuccess');
}
