/** Install attribution recorded after a company registration. */
import { api } from '@/lib/api/client';

/**
 * Records where a newly registered admin came from. `POST /attribution/meta`.
 * Fire-and-forget at the call site: callers must never block or fail a flow on it.
 */
export async function saveAttribution(input: { userId: string; source?: string }): Promise<void> {
  await api.post<unknown>('/attribution/meta', { user_id: input.userId, source: input.source ?? 'organic' });
}
