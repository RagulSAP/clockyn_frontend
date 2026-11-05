import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

// `currentState` can be missing before the native module reports (or mocked); anything that is not a string counts as active.
const isActive = (status: unknown): boolean => (typeof status === 'string' ? status === 'active' : true);

function subscribe(onChange: () => void): () => void {
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}

const getSnapshot = (): boolean => isActive(AppState.currentState);
const getServerSnapshot = (): boolean => true;

/**
 * True while the app is in the foreground (native AppState; on web react-native-web maps it to tab visibility).
 * Used to pause polling / timers while the app or tab is inactive.
 */
export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
