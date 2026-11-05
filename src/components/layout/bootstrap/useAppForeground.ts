import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useLatestRef } from '@/lib/realtime/useLatestRef';

/** Calls `callback` every time the app returns to the foreground (also the tab becoming visible on web). */
export function useAppForeground(callback: () => void): void {
  const ref = useLatestRef(callback);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ref.current();
    });
    return () => sub.remove();
  }, [ref]);
}
