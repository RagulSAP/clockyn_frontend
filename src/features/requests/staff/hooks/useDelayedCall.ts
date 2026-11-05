import { useCallback, useEffect, useRef } from 'react';

/** `setTimeout` whose pending timers are cleared on unmount (v1 left them running). */
export function useDelayedCall(): (fn: () => void, ms: number) => void {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);
  return useCallback((fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
}
