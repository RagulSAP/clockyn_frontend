/**
 * Notifications — NATIVE implementation.
 *
 *  - Remote push: FCM through `@react-native-firebase/messaging`, loaded with a guarded `require` so the app
 *    still runs (without push) when the native module / Firebase config is absent (Expo Go, dev builds
 *    without google-services).
 *  - Local notifications + Android channel: expo-notifications.
 *  - Taps: FCM `onNotificationOpenedApp` / `getInitialNotification` AND taps on local notifications
 *    (v1 handled only the former).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { lightColors } from '@/theme/colors';
import {
  normalizePushData,
  openEventKey,
  type LocalNotificationInput,
  type PushHandlers,
  type PushMessage,
} from './notificationRouting';

export { parseNotificationTarget, foregroundLocalNotification, normalizePushData } from './notificationRouting';
export type { PushMessage, PushHandlers, LocalNotificationInput, NotificationTarget, PushData } from './notificationRouting';

export const NOTIFICATION_CHANNEL_ID = 'attendance_notifications';
const NOTIFICATION_CHANNEL_NAME = 'Attendance Notifications';

// ── guarded Firebase loader ──────────────────────────────────────────────────────────────────

type FbRemoteMessage = {
  messageId?: string;
  data?: Record<string, unknown>;
  notification?: { title?: string; body?: string };
};
type FbMessaging = object;
type FbModule = {
  getMessaging: () => FbMessaging;
  requestPermission: (m: FbMessaging) => Promise<number>;
  hasPermission: (m: FbMessaging) => Promise<number>;
  registerDeviceForRemoteMessages: (m: FbMessaging) => Promise<void>;
  getToken: (m: FbMessaging) => Promise<string>;
  onMessage: (m: FbMessaging, l: (msg: FbRemoteMessage) => unknown) => () => void;
  onNotificationOpenedApp: (m: FbMessaging, l: (msg: FbRemoteMessage) => unknown) => () => void;
  onTokenRefresh: (m: FbMessaging, l: (token: string) => unknown) => () => void;
  getInitialNotification: (m: FbMessaging) => Promise<FbRemoteMessage | null>;
  setBackgroundMessageHandler?: (m: FbMessaging, h: (msg: FbRemoteMessage) => Promise<unknown>) => void;
  AuthorizationStatus?: { AUTHORIZED: number; PROVISIONAL: number };
};
type Firebase = { mod: FbModule; messaging: FbMessaging };

let firebase: Firebase | null | undefined;

function loadFirebase(): Firebase | null {
  if (firebase !== undefined) return firebase;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/messaging') as FbModule;
    const messaging = mod.getMessaging(); // throws when the native module / default Firebase app is missing
    // The OS displays notification-payload messages itself; a no-op handler keeps headless delivery happy.
    mod.setBackgroundMessageHandler?.(messaging, async () => undefined);
    firebase = { mod, messaging };
  } catch {
    firebase = null;
  }
  return firebase;
}

function isAuthorized(fb: Firebase, status: number): boolean {
  const s = fb.mod.AuthorizationStatus ?? { AUTHORIZED: 1, PROVISIONAL: 2 };
  return status === s.AUTHORIZED || status === s.PROVISIONAL;
}

const fromRemote = (m: FbRemoteMessage): PushMessage => ({
  title: m.notification?.title,
  body: m.notification?.body,
  data: normalizePushData(m.data),
  messageId: m.messageId,
  source: 'remote',
});

// ── expo-notifications setup ─────────────────────────────────────────────────────────────────

let configured = false;
function configure(): void {
  if (configured) return;
  configured = true;
  // Foreground presentation of notifications scheduled by this app.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channelReady: Promise<void> | null = null;
/** Creates the Android channel (idempotent). */
export function ensureNotificationChannel(): Promise<void> {
  configure();
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: NOTIFICATION_CHANNEL_NAME,
      importance: AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: lightColors.primary,
    })
      .then(() => undefined)
      .catch(() => {
        channelReady = null;
      });
  }
  return channelReady;
}

// ── public API ───────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the FCM token, or `null` when push is unavailable (permission denied, Firebase not configured,
 * Expo Go). With `prompt: false` the OS permission dialog is never shown (token only if already granted).
 */
export async function registerForPush(opts?: { prompt?: boolean }): Promise<string | null> {
  await ensureNotificationChannel();
  const fb = loadFirebase();
  if (!fb) {
    // No FCM (no Firebase files in this build / Expo Go): the OS notification prompt (Android 13+ POST_NOTIFICATIONS,
    // iOS alert permission) is still needed for local notifications and the background-location foreground-service
    // notification, and FCM's own requestPermission() is what normally triggers it.
    if (opts?.prompt !== false) {
      try {
        const current = await Notifications.getPermissionsAsync();
        if (!current.granted && current.canAskAgain) await Notifications.requestPermissionsAsync();
      } catch {
        /* permission API unavailable */
      }
    }
    return null;
  }
  try {
    const status = opts?.prompt === false ? await fb.mod.hasPermission(fb.messaging) : await fb.mod.requestPermission(fb.messaging);
    if (!isAuthorized(fb, status)) return null;
    await fb.mod.registerDeviceForRemoteMessages(fb.messaging);
    const token = await fb.mod.getToken(fb.messaging);
    return token || null;
  } catch {
    return null;
  }
}

/** True when FCM is usable in this build (Firebase native module + config present). */
export function isPushAvailable(): boolean {
  return loadFirebase() !== null;
}

const handledOpens: string[] = [];
function firstTimeOpen(msg: PushMessage): boolean {
  const key = openEventKey(msg);
  if (handledOpens.includes(key)) return false;
  handledOpens.push(key);
  if (handledOpens.length > 50) handledOpens.shift();
  return true;
}

function fromResponse(resp: Notifications.NotificationResponse): PushMessage | null {
  const req = resp.notification.request;
  const trigger = req.trigger as { type?: string } | null;
  if (trigger?.type === 'push') return null; // remote taps are delivered through FCM listeners
  return {
    title: req.content.title ?? undefined,
    body: req.content.body ?? undefined,
    data: normalizePushData(req.content.data),
    messageId: req.identifier,
    source: 'local',
  };
}

/**
 * Subscribes to push events. Returns an unsubscribe function.
 *  - `onForeground`: FCM message while the app is open.
 *  - `onOpen`: tap on a remote notification (background or cold start) or on a local notification.
 *  - `onTokenRefresh`: FCM token rotation.
 */
export function subscribePushEvents(handlers: PushHandlers): () => void {
  configure();
  void ensureNotificationChannel();
  const cleanups: (() => void)[] = [];
  let active = true;
  const open = (msg: PushMessage) => {
    if (active && firstTimeOpen(msg)) handlers.onOpen(msg);
  };

  const fb = loadFirebase();
  if (fb) {
    try {
      cleanups.push(fb.mod.onMessage(fb.messaging, (m) => void (active && handlers.onForeground(fromRemote(m)))));
      cleanups.push(fb.mod.onNotificationOpenedApp(fb.messaging, (m) => open(fromRemote(m))));
      cleanups.push(fb.mod.onTokenRefresh(fb.messaging, (t) => void (active && handlers.onTokenRefresh?.(t))));
      void fb.mod
        .getInitialNotification(fb.messaging)
        .then((m) => {
          if (m) open(fromRemote(m));
        })
        .catch(() => undefined);
    } catch {
      /* listeners unavailable — local notification taps still work */
    }
  }

  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const msg = fromResponse(resp);
    if (msg) open(msg);
  });
  cleanups.push(() => sub.remove());

  // App cold-started by tapping a local notification.
  void Notifications.getLastNotificationResponseAsync()
    .then((resp) => {
      const msg = resp ? fromResponse(resp) : null;
      if (msg) {
        open(msg);
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      }
    })
    .catch(() => undefined);

  return () => {
    active = false;
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* already removed */
      }
    });
  };
}

/** Shows a notification immediately. Resolves `false` when the OS permission is not granted. */
export async function showLocalNotification(input: LocalNotificationInput): Promise<boolean> {
  configure();
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return false;
    await ensureNotificationChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title: input.title, body: input.body, data: input.data ?? {}, sound: 'default' },
      trigger: Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNEL_ID } : null,
    });
    return true;
  } catch {
    return false;
  }
}
