/** Clickstream intake: `POST /analytics/events` (bearer token; the server reads the user and organisation from it). */
import { api } from '@/lib/api/client';
import type { ClickstreamBatch } from '@/lib/analytics/clickstream';

const SEND_TIMEOUT_MS = 10_000;

export async function sendClickstream(batch: ClickstreamBatch): Promise<void> {
  await api.post<unknown>('/analytics/events', batch, { timeoutMs: SEND_TIMEOUT_MS });
}
