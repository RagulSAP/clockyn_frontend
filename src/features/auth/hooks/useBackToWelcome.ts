import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { routes, useAppRouter } from '@/lib/navigation';

/**
 * Hardware / browser back on the login screens goes to the welcome screen (never exits the app).
 * Returns the handler for the on-screen back arrow.
 */
export function useBackToWelcome(): () => void {
  const router = useAppRouter();
  // Pop to the welcome screen already in the stack (a replace would stack a second copy under it); replace only when nothing is below.
  const goWelcome = useCallback(() => router.backOr(routes.welcome), [router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goWelcome();
        return true;
      });
      return () => subscription.remove();
    }, [goWelcome]),
  );

  return goWelcome;
}
