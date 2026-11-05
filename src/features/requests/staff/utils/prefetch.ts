/**
 * Warms a cache before navigating (the hubs pre-load the destination data behind a "Loading..." overlay).
 * Never rejects and never blocks longer than `timeoutMs`, so a slow or failing request can not keep the overlay up:
 * the destination screen loads its own data anyway.
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
