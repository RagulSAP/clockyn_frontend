import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Call `refetch` each time the screen regains focus (returning from a pushed screen / tab switch),
 * but not on the first focus (the query already fetches on mount).
 *
 * ```ts
 * const q = useQuery(...);
 * useRefreshOnFocus(q.refetch);
 * ```
 */
export function useRefreshOnFocus(refetch: () => unknown, opts: { skipFirst?: boolean } = {}): void {
  const skipFirst = opts.skipFirst ?? true;
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);
  const first = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        if (skipFirst) return;
      }
      try {
        const r = refetchRef.current();
        if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => undefined);
      } catch {
        // a failing refetch must never break focus handling
      }
    }, [skipFirst]),
  );
}
