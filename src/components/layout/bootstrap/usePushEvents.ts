import { useEffect, useRef, useState } from 'react';
import { router, useRootNavigationState, usePathname } from 'expo-router';

import { foregroundLocalNotification, showLocalNotification, subscribePushEvents, type PushMessage } from '@/lib/platform/notifications';
import { handlePushData } from '@/lib/realtime/globalRealtime';
import { liveChatSession } from '@/lib/realtime/liveChatSession';
import { buildHref, type AppRoute } from '@/lib/navigation';
import { getSession, signOut, useAuthHydrated, useSession } from '@/store/auth';
import { useLatestRef } from '@/lib/realtime/useLatestRef';
import { createOpenDeduper, resolveTapTarget } from './notificationGlue';
import { postPushToken } from './pushToken';
import { isForceLogoutPush } from './sessionWatch';

/**
 * One subscription to the platform push events for the whole app:
 *  - foreground message: badge effects (shared de-dupe with the socket), FCM `force_logout` (roles 2/3), and the
 *    local re-display of chat pushes (FCM shows nothing while the app is open);
 *  - notification tap (background, cold start, or a tap on the local re-display): routed with
 *    `parseNotificationTarget` — held until the session is hydrated, the navigator is mounted and the initial
 *    redirect has settled, so a cold-start tap is never overwritten by the welcome redirect;
 *  - FCM token rotation: POSTed for the current user.
 */
export function usePushEvents(): void {
  const hydrated = useAuthHydrated();
  const session = useSession();
  const navState = useRootNavigationState();
  const pathname = usePathname();
  const pending = useRef<PushMessage | null>(null);
  const [isDuplicate] = useState(() => createOpenDeduper());
  const navReady = !!navState?.key;
  // `/` is where the app starts; the welcome redirect moves signed-in users away from it.
  const settled = hydrated && navReady && (!!session ? pathname !== '/' : true);
  const readyRef = useLatestRef(settled && !!session);

  // Flush a tap that arrived before the app was ready (a tap while signed out is dropped: sign in first).
  useEffect(() => {
    if (settled && !session) pending.current = null;
    if (!settled || !session || !pending.current) return;
    const msg = pending.current;
    pending.current = null;
    navigateForTap(msg);
  }, [settled, session]);

  useEffect(() => {
    const unsubscribe = subscribePushEvents({
      onForeground: (msg) => {
        const current = getSession();
        if (!current) return;
        if (isForceLogoutPush(msg.data, current)) {
          void signOut({ reason: 'forced' });
          return;
        }
        handlePushData(msg.data, { title: msg.title, body: msg.body });
        // the Live Chat screen shows a support message itself: no banner on top of the open conversation
        const onScreen = msg.data.type === 'live_chat_message' && liveChatSession.isOpen();
        const local = onScreen ? null : foregroundLocalNotification(msg);
        if (local) void showLocalNotification(local);
      },
      onOpen: (msg) => {
        if (isDuplicate(msg)) return;
        if (!readyRef.current) {
          pending.current = msg;
          return;
        }
        navigateForTap(msg);
      },
      onTokenRefresh: (token) => {
        const current = getSession();
        if (current) void postPushToken(token, current.userId);
      },
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once; handlers read live state through refs / getSession()
  }, []);
}

function navigateForTap(msg: PushMessage): void {
  const target = resolveTapTarget(msg, getSession());
  if (!target) return;
  try {
    router.navigate(buildHref(target.route as AppRoute, target.params));
  } catch {
    /* navigator not ready — the tap is dropped rather than crashing the app */
  }
}
