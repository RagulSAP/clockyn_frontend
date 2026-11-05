/**
 * Expired / revoked bearer token: the server answered 401 on a protected path while a session was active.
 * The HTTP client calls `onUnauthorized` once per session; this module turns that into the same clean-up as the other
 * forced sign-outs (`signOut`: stops sockets / tracking / push, drops the session and cached data) — the stored trusted-device
 * token is KEPT so the next sign-in can skip the OTP — then shows the welcome screen and a toast.
 * Pure + dependency-injected (see `sessionWatch.ts`); `useSessionExpiry` wires the real modules.
 */
import { configureApi } from '@/lib/api/client';
import { goToWelcome } from '@/lib/navigation';
import { toast } from '@/components/ui/internal/toastStore';
import { getSession, signOut, type Session, type SignOutReason } from '@/store/auth';

export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';

export interface SessionExpiryDeps {
  getSession: () => Session | null;
  signOut: (opts: { reason: SignOutReason }) => Promise<void>;
  goToWelcome: () => void;
  notify: (message: string) => void;
}

const realDeps: SessionExpiryDeps = {
  getSession,
  signOut,
  goToWelcome,
  notify: (message) => {
    toast.error(message);
  },
};

/** Sign out because the session token was rejected. No-op (false) when nobody is signed in. Never throws. */
export async function handleSessionExpired(deps: SessionExpiryDeps = realDeps): Promise<boolean> {
  if (!deps.getSession()) return false;
  try {
    await deps.signOut({ reason: 'expired' });
  } catch {
    // signOut swallows teardown failures itself; whatever happens the user must still land on the welcome screen
  }
  try {
    deps.goToWelcome();
  } catch {
    // the route guards also redirect once the session is cleared
  }
  deps.notify(SESSION_EXPIRED_MESSAGE);
  return true;
}

/** Register the 401 handler with the HTTP client. Returns the unregister function. */
export function registerSessionExpiry(deps: SessionExpiryDeps = realDeps): () => void {
  configureApi({ onUnauthorized: () => void handleSessionExpired(deps) });
  return () => configureApi({ onUnauthorized: undefined });
}
