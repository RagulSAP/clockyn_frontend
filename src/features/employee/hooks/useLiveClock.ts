import { useEffect, useState } from 'react';

import { useAppActive } from '@/hooks';

/**
 * Current time (epoch ms) re-evaluated every `intervalMs` while the app is in the foreground.
 * Each memoised card owns its own clock so the parent screen never re-renders every second.
 */
export function useLiveClock(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  const active = useAppActive();
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
