import { faceApi } from '@/api';

/**
 * Fire-and-forget `GET /face/warmup/{userId}`: the server loads the user's face data into its cache so the first punch
 * is fast. Never blocks the UI and never reports an error (older servers have no such route).
 */
export function warmFace(userId: string): void {
  if (!userId) return;
  try {
    void Promise.resolve(faceApi.warmup(userId)).catch(() => undefined);
  } catch {
    // best effort
  }
}
