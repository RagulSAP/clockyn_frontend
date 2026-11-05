import { useCallback, useEffect, useState } from 'react';

import { getJSON, setJSON, STORAGE_KEYS, storageKeyFor } from '@/lib/storage';
import { useUserId } from '@/store/auth';
import { DEFAULT_CHAT_THEME, normalizeThemeIndex, sanitizeThemeMap } from '../utils/chatThemes';

/** Per-group colour theme, remembered on this device (the one chat preference v1 persisted), scoped to the user. */
export function useGroupThemes(): { themeFor: (groupId: string) => number; setTheme: (groupId: string, index: number) => void } {
  const userId = useUserId();
  const storageKey = storageKeyFor(STORAGE_KEYS.groupThemes, userId);
  const [map, setMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    void getJSON<unknown>(storageKey).then((raw) => {
      if (alive) setMap(sanitizeThemeMap(raw));
    });
    return () => {
      alive = false;
    };
  }, [storageKey, userId]);

  const themeFor = useCallback((groupId: string) => map[groupId] ?? DEFAULT_CHAT_THEME, [map]);

  const setTheme = useCallback(
    (groupId: string, index: number) => {
      const next = { ...map, [groupId]: normalizeThemeIndex(index) };
      setMap(next);
      void setJSON(storageKey, next);
    },
    [map, storageKey],
  );

  return { themeFor, setTheme };
}
