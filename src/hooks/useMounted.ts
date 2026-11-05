import { useCallback, useEffect, useRef } from 'react';

/**
 * `const isMounted = useMounted();` — returns a stable function telling whether the component is still mounted.
 * Use it to skip state updates after an `await` (prefer abortable requests where possible).
 */
export function useMounted(): () => boolean {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(() => mounted.current, []);
}
