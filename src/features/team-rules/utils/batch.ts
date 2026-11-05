/**
 * Runs several independent write requests in parallel and reports EVERY outcome. v1 fired them with `Promise.all`
 * without looking at the responses and then showed a success toast even when the server had rejected some of them.
 */
import { getErrorMessage } from '@/lib/api/errors';

export type BatchTask = { label: string; run: () => Promise<unknown> };
export type BatchFailure = { label: string; message: string };
export type BatchResult = { total: number; succeeded: number; failures: BatchFailure[] };

export async function runBatch(tasks: readonly BatchTask[]): Promise<BatchResult> {
  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  const failures: BatchFailure[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'rejected') failures.push({ label: tasks[i].label, message: getErrorMessage(r.reason, 'Request failed') });
  });
  return { total: tasks.length, succeeded: tasks.length - failures.length, failures };
}

/** User-facing text for a partially / fully failed batch; `null` when everything succeeded. */
export function describeBatchFailure(result: BatchResult, action: string): string | null {
  if (result.failures.length === 0) return null;
  const first = result.failures[0];
  if (result.succeeded === 0) {
    return result.total === 1 ? first.message : `${action} failed: ${first.message}`;
  }
  return `${action}: ${result.succeeded} of ${result.total} succeeded. ${first.label}: ${first.message}`;
}
