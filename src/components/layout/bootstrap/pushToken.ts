import { updatePushToken } from '@/api/auth';
import { registerForPush } from '@/lib/platform/notifications';
import { setString, STORAGE_KEYS } from '@/lib/storage';
import { getSession } from '@/store/auth';

let inflight: { userId: string; promise: Promise<void> } | null = null;

/** POST a token for the CURRENT user (never for a previous one) and remember it locally. Errors are swallowed. */
export async function postPushToken(token: string, userId: string): Promise<void> {
  await setString(STORAGE_KEYS.pushToken, token);
  if (getSession()?.userId !== userId) return;
  try {
    await updatePushToken(userId, token);
  } catch {
    // Retried on the next start / foreground (no queue, as in v1). Never log the token.
  }
}

/**
 * Re-register the device for push and POST the token for the signed-in user. Runs on start and on every
 * foreground (the token can appear later, e.g. a signing key registered after install). Concurrent calls share
 * one run. Web resolves a null token (no FCM) and does nothing.
 */
export function refreshPushToken(): Promise<void> {
  const userId = getSession()?.userId;
  if (!userId) return Promise.resolve();
  if (inflight && inflight.userId === userId) return inflight.promise;
  const run = { userId, promise: Promise.resolve() };
  run.promise = (async () => {
    try {
      const token = await registerForPush();
      if (token) await postPushToken(token, userId);
    } catch {
      /* registration failures are silent: the app keeps working through the socket */
    } finally {
      if (inflight === run) inflight = null;
    }
  })();
  inflight = run;
  return run.promise;
}
