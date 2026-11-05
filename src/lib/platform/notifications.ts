/**
 * Notifications — WEB / default implementation.
 *
 * There is no FCM on the web in this phase (Web Push needs a service worker + VAPID key), so
 * `registerForPush` resolves `null` and `subscribePushEvents` never receives remote messages — documented
 * no-ops. In-page notifications are real: `showLocalNotification` uses the browser Notification API (when
 * the user has granted permission — see `permissions.requestPermission('notifications')`) and clicks are
 * delivered to `onOpen` handlers, mirroring the native behaviour for local notifications.
 * The native implementation lives in `notifications.native.ts`.
 */
import type { LocalNotificationInput, PushHandlers, PushMessage } from './notificationRouting';
import { normalizePushData } from './notificationRouting';

export { parseNotificationTarget, foregroundLocalNotification, normalizePushData } from './notificationRouting';
export type { PushMessage, PushHandlers, LocalNotificationInput, NotificationTarget, PushData } from './notificationRouting';

export const NOTIFICATION_CHANNEL_ID = 'attendance_notifications';

const openHandlers = new Set<(msg: PushMessage) => void>();

export async function ensureNotificationChannel(): Promise<void> {
  /* channels are an Android concept */
}

/** No FCM on web → always `null`. */
export async function registerForPush(_opts?: { prompt?: boolean }): Promise<string | null> {
  return null;
}

export function isPushAvailable(): boolean {
  return false;
}

export function subscribePushEvents(handlers: PushHandlers): () => void {
  openHandlers.add(handlers.onOpen);
  return () => {
    openHandlers.delete(handlers.onOpen);
  };
}

export async function showLocalNotification(input: LocalNotificationInput): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const data = normalizePushData(input.data);
    const n = new Notification(input.title, { body: input.body, tag: data.message_id ?? data.type });
    n.onclick = () => {
      window.focus();
      n.close();
      const msg: PushMessage = { title: input.title, body: input.body, data, source: 'local' };
      openHandlers.forEach((h) => h(msg));
    };
    return true;
  } catch {
    return false;
  }
}
