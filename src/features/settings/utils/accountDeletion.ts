/**
 * Account-deletion REQUEST flow (spec: settings F10). The call only asks the support team to delete the account; the
 * app marks the session inactive, tells the user, and signs out after a short delay.
 */
import type { Session } from '@/store/auth';
import type { DeletionRequestResult } from '@/types/api/system';

export const DELETION_REDIRECT_DELAY_MS = 1500;
export const DELETION_DEFAULT_MESSAGE = 'Deletion request submitted. An admin will process it.';

export interface DeletionDeps {
  requestDeletion: (userId: string) => Promise<DeletionRequestResult>;
  patchSession: (patch: Partial<Session>) => void;
  signOut: (opts?: { reason?: 'logout' | 'forced' | 'deleted' }) => Promise<void> | void;
  /** Injectable for tests. */
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  delayMs?: number;
}

/**
 * Sends the request. On success: marks the local session `isActive: 0`, schedules the sign-out (which survives the
 * screen unmounting) and resolves the message to show. Rejects with the API error when the request fails — the user
 * then stays signed in.
 */
export async function submitDeletionRequest(userId: string, deps: DeletionDeps): Promise<string> {
  const result = await deps.requestDeletion(userId);
  deps.patchSession({ isActive: 0 });
  const schedule = deps.setTimeoutFn ?? setTimeout;
  schedule(() => {
    void Promise.resolve(deps.signOut({ reason: 'deleted' })).catch(() => undefined);
  }, deps.delayMs ?? DELETION_REDIRECT_DELAY_MS);
  return result.message.trim() !== '' ? result.message : DELETION_DEFAULT_MESSAGE;
}
