import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Detects coming back from a screen we pushed (e.g. the staff editor). Call `markLeaving()` right before navigating;
 * `onReturn` runs the next time this screen regains focus. Replaces v1's storage-flag protocol: data refresh is driven
 * by query invalidation, this only triggers the refetch and the "reopen the profile" convenience.
 */
export function useReturnFromEdit(onReturn: () => void): { markLeaving: () => void } {
  const leaving = useRef(false);
  const callback = useRef(onReturn);
  useEffect(() => {
    callback.current = onReturn;
  });

  useFocusEffect(
    useCallback(() => {
      if (!leaving.current) return;
      leaving.current = false;
      callback.current();
    }, []),
  );

  const markLeaving = useCallback(() => {
    leaving.current = true;
  }, []);
  return { markLeaving };
}
