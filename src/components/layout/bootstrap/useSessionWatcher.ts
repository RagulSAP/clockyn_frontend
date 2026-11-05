import { useCallback, useEffect } from 'react';

import { checkSession } from '@/api/requests';
import { getLastLoginAt, getSession, signOut, useSession } from '@/store/auth';
import { isSessionWatched, runSessionCheck, SESSION_POLL_MS } from './sessionWatch';
import { useAppForeground } from './useAppForeground';

const check = () =>
  runSessionCheck({
    getSession,
    readLastLoginAt: async () => {
      const at = await getLastLoginAt();
      return at === null ? null : String(at);
    },
    checkSession,
    signOut,
  });

/**
 * Single-device enforcement for roles 2/3 (see `sessionWatch.ts`). Keyed to the reactive session: starts when a
 * staff/manager session with a device token appears (including a login in the same app run — the v1 bug),
 * restarts when the user or token changes and stops on sign-out.
 */
export function useSessionWatcher(): void {
  const session = useSession();
  const userId = session?.userId;
  const roleId = session?.roleId;
  const deviceToken = session?.deviceToken;
  const watched = isSessionWatched(session);

  useEffect(() => {
    if (!watched) return;
    void check();
    const id = setInterval(() => void check(), SESSION_POLL_MS);
    return () => clearInterval(id);
  }, [watched, userId, roleId, deviceToken]);

  const onForeground = useCallback(() => {
    void check();
  }, []);
  useAppForeground(onForeground);
}
