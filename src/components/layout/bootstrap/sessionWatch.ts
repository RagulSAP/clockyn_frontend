/**
 * Single-device session enforcement (roles 2 and 3 only — admins have no device token).
 * Pure + dependency-injected so the rules are unit-tested; `useSessionWatcher` wires the real modules.
 *
 * Rules (v1 behaviour, kept):
 *  - poll every 30 s and on every app foreground;
 *  - skipped for 5 minutes after login (camera / permission dialogs trigger foreground events before the
 *    backend has registered the new device token);
 *  - fail open: a network / HTTP failure never signs the user out (`checkSession` resolves valid);
 *  - a definite `forceLogout` answer signs out with reason `forced`.
 * Fix (FIX_POLICY B.4): the watcher is keyed to the reactive session, and a late answer for a previous user
 * can never sign out the current one.
 */
export const SESSION_POLL_MS = 30_000;
export const LOGIN_GRACE_MS = 5 * 60 * 1000;

export type WatchedSession = { userId: string; roleId: number; deviceToken?: string | null };

/** True when the session is subject to the single-device check. */
export function isSessionWatched(session: Partial<WatchedSession> | null | undefined): session is WatchedSession & { deviceToken: string } {
  return !!session && !!session.userId && !!session.deviceToken && (session.roleId === 2 || session.roleId === 3);
}

/** Is `lastLoginAt` (epoch ms, as string or number) less than the grace window ago? Unparseable = no grace. */
export function withinLoginGrace(lastLoginAt: string | number | null | undefined, now: number, graceMs = LOGIN_GRACE_MS): boolean {
  if (lastLoginAt === null || lastLoginAt === undefined || lastLoginAt === '') return false;
  const t = typeof lastLoginAt === 'number' ? lastLoginAt : parseInt(lastLoginAt, 10);
  if (!Number.isFinite(t)) return false;
  const elapsed = now - t;
  return elapsed >= 0 && elapsed < graceMs;
}

export type SessionCheckDeps = {
  getSession: () => (Partial<WatchedSession> & { userId?: string }) | null;
  readLastLoginAt: () => Promise<string | null>;
  checkSession: (userId: string, deviceToken: string) => Promise<{ valid: boolean; forceLogout: boolean; reason?: string }>;
  signOut: (opts: { reason: 'forced' }) => Promise<void>;
  now?: () => number;
};

export type SessionCheckOutcome = 'not-watched' | 'grace' | 'ok' | 'forced' | 'stale' | 'error';

/** One check of the session that was current when the check started. */
export async function runSessionCheck(deps: SessionCheckDeps): Promise<SessionCheckOutcome> {
  const now = deps.now ?? Date.now;
  const session = deps.getSession();
  if (!isSessionWatched(session)) return 'not-watched';
  const { userId, deviceToken } = session;

  if (withinLoginGrace(await deps.readLastLoginAt(), now())) return 'grace';

  let result: { forceLogout: boolean };
  try {
    result = await deps.checkSession(userId, deviceToken);
  } catch {
    return 'error'; // fail open
  }
  if (!result.forceLogout) return 'ok';

  // The answer belongs to the user/device we asked about; ignore it if the session changed meanwhile.
  const current = deps.getSession();
  if (!current || current.userId !== userId || current.deviceToken !== deviceToken) return 'stale';
  await deps.signOut({ reason: 'forced' });
  return 'forced';
}

/** Does this push data payload demand a forced logout for this session? (FCM `force_logout`, roles 2/3 only.) */
export function isForceLogoutPush(data: Record<string, unknown> | undefined, session: Partial<WatchedSession> | null | undefined): boolean {
  if (!data || data.type !== 'force_logout') return false;
  return !!session && !!session.userId && (session.roleId === 2 || session.roleId === 3);
}
