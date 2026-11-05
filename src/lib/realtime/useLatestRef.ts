import { useEffect, useRef, type MutableRefObject } from 'react';

/** Ref that always holds the latest value (updated after every commit), for callbacks registered once. */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
