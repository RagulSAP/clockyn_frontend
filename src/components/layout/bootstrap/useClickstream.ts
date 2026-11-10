import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useSegments } from 'expo-router';

import { clickstream, FLUSH_INTERVAL_MS, screenName } from '@/lib/analytics';
import { setTapHandler } from '@/lib/analytics/tap';
import { useSession } from '@/store/auth';
import { useAppForeground } from './useAppForeground';

/**
 * Usage analytics (screen views and button taps, see lib/analytics/clickstream.ts). Starts when someone signs in, follows the
 * current route, sends the queue every 15 s and when the app goes to the background, and stops (dropping the queue) on sign-out.
 * The screen name is the route PATTERN (`/admin/staff/edit`), never a URL with real ids.
 */
export function useClickstream(): void {
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = session?.orgId ?? '';
  const roleId = session?.roleId ?? 0;
  const segments = useSegments();
  const screen = screenName(segments as readonly string[]);

  useEffect(() => {
    clickstream.setIdentity(userId ? { userId, orgId, roleId } : null);
  }, [userId, orgId, roleId]);

  useEffect(() => {
    if (!userId) return undefined;
    setTapHandler((label) => clickstream.click(label));
    return () => setTapHandler(null);
  }, [userId]);

  useEffect(() => {
    if (userId) clickstream.screenView(screen);
  }, [userId, screen]);

  useEffect(() => {
    if (!userId) return undefined;
    const timer = setInterval(() => void clickstream.flush(), FLUSH_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void clickstream.flush();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [userId]);

  useAppForeground(useCallback(() => clickstream.resume(), []));
}
