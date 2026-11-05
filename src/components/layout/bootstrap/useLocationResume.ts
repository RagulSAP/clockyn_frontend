import { useCallback, useEffect } from 'react';

import { getToday } from '@/api/attendance';
import { resumeTrackingIfNeeded } from '@/lib/platform/location';
import { getSession, useSession } from '@/store/auth';
import { isStillWorking } from './stillWorking';
import { useAppForeground } from './useAppForeground';

/** "Still working": punched in and not punched out yet (the v1 check before resuming tracking, second-session safe). */
async function stillPunchedIn(userId: string): Promise<boolean> {
  return isStillWorking(await getToday(userId));
}

/**
 * Resume field-staff location tracking for roles 2/3 who are still punched in — when the app starts with a
 * session, when a staff user signs in, and on every foreground. The platform layer decides whether anything was
 * persisted to resume; if the user already punched out it stops and clears the intent. Sign-out stops tracking
 * through the teardown the platform layer registers with the auth store.
 */
export function useLocationResume(): void {
  const userId = useSession()?.userId ?? null;
  const roleId = useSession()?.roleId ?? null;

  const resume = useCallback(async () => {
    const session = getSession();
    if (!session || (session.roleId !== 2 && session.roleId !== 3)) return;
    try {
      await resumeTrackingIfNeeded({ userId: session.userId, shouldResume: () => stillPunchedIn(session.userId) });
    } catch {
      /* tracking is best-effort */
    }
  }, []);

  useEffect(() => {
    if (userId && (roleId === 2 || roleId === 3)) void resume();
  }, [userId, roleId, resume]);

  useAppForeground(() => void resume());
}
