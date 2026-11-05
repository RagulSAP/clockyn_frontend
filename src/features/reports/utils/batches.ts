/** Runs `fn` over `items`, `size` at a time (batches strictly sequential), never aborting on a single failure. */
export interface BatchOutcome<T, R> {
  results: Map<T, R>;
  failed: T[];
}

export async function mapInBatches<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<BatchOutcome<T, R>> {
  const step = Math.max(1, Math.floor(size));
  const results = new Map<T, R>();
  const failed: T[] = [];
  for (let i = 0; i < items.length; i += step) {
    const batch = items.slice(i, i + step);
    const settled = await Promise.allSettled(batch.map((item) => fn(item)));
    settled.forEach((outcome, idx) => {
      if (outcome.status === 'fulfilled') results.set(batch[idx], outcome.value);
      else failed.push(batch[idx]);
    });
    onProgress?.(Math.min(i + batch.length, items.length), items.length);
  }
  return { results, failed };
}

/** Unique values, first occurrence wins (keeps order). */
export function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
