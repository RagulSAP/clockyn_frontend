import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** True while the screen is the focused one (false while another screen is pushed on top or the tab is hidden). */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
