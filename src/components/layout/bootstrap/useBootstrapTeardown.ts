import { useEffect } from 'react';

import { resetGlobalRealtime } from '@/lib/realtime/globalRealtime';
import { registerTeardown } from '@/store/auth';
import { logoutOnServer } from './serverLogout';

/**
 * Registers the shell's sign-out cleanup with the auth store (`signOut()` runs it before dropping the session):
 * forget the realtime de-dupe memory and socket state, and end the server-side session (best-effort `POST /auth/logout`,
 * while the bearer token is still attached). The sockets, session poll, push registration and
 * update check are keyed to the session and stop on their own when it disappears; location tracking and
 * badge / query / storage resets have their own teardowns inside the platform layer and the auth store.
 */
export function useBootstrapTeardown(): void {
  useEffect(() => registerTeardown(() => resetGlobalRealtime()), []);
  useEffect(() => registerTeardown((ctx) => logoutOnServer(ctx)), []);
}
