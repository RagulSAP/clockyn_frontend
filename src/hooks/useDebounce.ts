import { useEffect, useState } from 'react';

/** Returns `value` after it has stopped changing for `ms` milliseconds (search boxes, filters). `ms <= 0` disables debouncing. */
export function useDebounce<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (ms <= 0) return undefined;
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return ms <= 0 ? value : debounced;
}
