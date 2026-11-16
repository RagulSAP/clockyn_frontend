import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { goHome } from '@/lib/navigation';
import { getSession } from '@/store/auth';

/**
 * A signed-in user must never see the sign-in / registration screens again (on the web the browser's own history can still hold
 * them, and on a phone a screen can be left underneath after signing in). Whenever one of these screens comes into view while a
 * session exists, go to the role's home instead. The session is read when the screen gains focus (not subscribed to), so the
 * moment a login or registration itself succeeds does not trigger a second navigation.
 */
export function useLeaveAuthWhenSignedIn(): void {
  useFocusEffect(
    useCallback(() => {
      const session = getSession();
      if (session) goHome(session.roleId);
    }, []),
  );
}
