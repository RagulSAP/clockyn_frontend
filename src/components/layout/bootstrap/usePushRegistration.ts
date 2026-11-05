import { useEffect } from 'react';

import { useSession } from '@/store/auth';
import { refreshPushToken } from './pushToken';
import { useAppForeground } from './useAppForeground';

/**
 * Push registration keyed to the reactive session: register + POST the token when a user is (or becomes)
 * signed in — start, login, account switch — and again on every foreground (v1 behaviour).
 */
export function usePushRegistration(): void {
  const userId = useSession()?.userId ?? null;
  useEffect(() => {
    if (userId) void refreshPushToken();
  }, [userId]);
  useAppForeground(() => void refreshPushToken());
}
