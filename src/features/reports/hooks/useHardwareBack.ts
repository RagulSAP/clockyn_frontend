/** Android hardware back while the screen is focused. `handler` returns true when it consumed the event. */
import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function useHardwareBack(handler: () => boolean): void {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', handler);
      return () => sub.remove();
    }, [handler]),
  );
}
