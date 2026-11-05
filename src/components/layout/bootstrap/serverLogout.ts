/**
 * Best-effort `POST /auth/logout` on an explicit sign-out. Registered as a sign-out teardown, which runs BEFORE the local
 * session is cleared, so the bearer token is still attached. It never blocks or fails the sign-out (`authApi.logout`
 * swallows every error and uses a short timeout; the teardown runner time-boxes it as well).
 *
 * Only reason `logout` (the user pressed Sign out): for `expired` the token is already dead, for `forced` the device token
 * now belongs to another phone, for `deleted` the account is gone.
 */
import { logout } from '@/api/auth';
import { getString, STORAGE_KEYS } from '@/lib/storage';
import type { TeardownContext } from '@/store/auth';

export interface ServerLogoutDeps {
  logout: typeof logout;
  readPushToken: () => Promise<string | null>;
}

const realDeps: ServerLogoutDeps = {
  logout,
  readPushToken: () => getString(STORAGE_KEYS.pushToken),
};

export async function logoutOnServer(ctx: TeardownContext, deps: ServerLogoutDeps = realDeps): Promise<void> {
  if (ctx.reason !== 'logout' || !ctx.session) return;
  let pushToken: string | null = null;
  try {
    pushToken = await deps.readPushToken();
  } catch {
    pushToken = null;
  }
  await deps.logout({
    userId: ctx.session.userId,
    deviceToken: ctx.session.deviceToken,
    pushToken: pushToken || undefined,
  });
}
