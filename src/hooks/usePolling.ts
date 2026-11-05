import { useCallback, useEffect, useRef } from 'react';

import { useAppActive } from './useAppActive';

export interface PollingOptions {
  /** Poll only while true (default true). Turning it back on counts as a restart. */
  enabled?: boolean;
  /** Run once right away when polling starts (default false). */
  immediate?: boolean;
  /** Pause while the app / browser tab is in the background (default true). Polling resumes with an immediate run. */
  pauseWhenInactive?: boolean;
}

/**
 * Call `fn` every `intervalMs` while mounted, enabled and the app/tab is active.
 *  - Runs never overlap (a slow run delays the next tick instead of stacking requests).
 *  - Errors thrown by `fn` are swallowed so polling continues — handle them inside `fn`.
 *  - Timers are always cleaned up on unmount / disable / interval change.
 *  - Returns `{ trigger }` to run `fn` on demand.
 */
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  { enabled = true, immediate = false, pauseWhenInactive = true }: PollingOptions = {},
): { trigger: () => Promise<void> } {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const appActive = useAppActive();
  const running = appActive || !pauseWhenInactive;
  const prevRunning = useRef<boolean | null>(null);
  const inflight = useRef(false);

  const trigger = useCallback(async (): Promise<void> => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      await fnRef.current();
    } catch {
      // polling must survive failures
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    const resumed = prevRunning.current === false && running;
    prevRunning.current = running;
    if (!enabled || !running || !(intervalMs > 0)) return undefined;

    let cancelled = false;
    const tick = (): void => {
      if (!cancelled) void trigger();
    };
    if (immediate || resumed) tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, running, intervalMs, immediate, trigger]);

  return { trigger };
}
