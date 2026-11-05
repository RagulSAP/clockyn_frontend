import { getErrorMessage } from '@/lib/api/errors';
import type { UpdateRequestStatusInput } from '@/types/api/requests';

export interface DecisionOutcome {
  succeeded: (string | undefined)[];
  failed: { date: string | undefined; error: unknown }[];
}

/**
 * Sends one `update-status` call per target date IN PARALLEL and reports per-date results (v1 used `Promise.all`, so a
 * single failure hid which dates had already been saved). `update` rejects for HTTP errors and `{success:false}`.
 */
export async function runDecision(
  update: (input: UpdateRequestStatusInput) => Promise<unknown>,
  base: Omit<UpdateRequestStatusInput, 'date'>,
  targets: readonly (string | undefined)[],
): Promise<DecisionOutcome> {
  const settled = await Promise.allSettled(targets.map((date) => update({ ...base, date })));
  const outcome: DecisionOutcome = { succeeded: [], failed: [] };
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') outcome.succeeded.push(targets[i]);
    else outcome.failed.push({ date: targets[i], error: result.reason });
  });
  return outcome;
}

/** Error text for a (partly) failed decision; `''` when everything succeeded. */
export function failureMessage(outcome: DecisionOutcome, fallback = 'Failed to update'): string {
  if (outcome.failed.length === 0) return '';
  const first = getErrorMessage(outcome.failed[0].error, fallback);
  const total = outcome.succeeded.length + outcome.failed.length;
  if (outcome.succeeded.length === 0 || total === 1) return first;
  return `Updated ${outcome.succeeded.length} of ${total} dates. ${first}`;
}
