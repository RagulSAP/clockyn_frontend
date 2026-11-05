/**
 * Warms a cache before navigating (the hub pre-loads today's records behind a "Loading..." overlay).
 * Never rejects and never blocks longer than `timeoutMs`: the destination screen loads its own data anyway.
 */
export async function settleWithin(work: Promise<unknown>, timeoutMs = 4000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work.catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
