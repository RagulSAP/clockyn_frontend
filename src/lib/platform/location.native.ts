/**
 * Location — NATIVE implementation (expo-location + expo-task-manager).
 *
 *  - getCurrentPosition: live fix with timeout; last-known fallback only when the live fix fails.
 *  - Foreground tracking: every 20 s while the app is open (Android + iOS).
 *  - Background tracking: Android only, via a foreground-service task (persistent notification). iOS never
 *    starts it (the app declares no location background mode).
 *  - 403 from the upload endpoint stops BOTH watchers and clears the persisted state.
 *  - `stopAllTracking()` is registered with the auth store teardown (sign-out) when available.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { LocationAccuracy } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  DEFAULT_LAST_KNOWN_MAX_AGE_MS,
  DEFAULT_POSITION_TIMEOUT_MS,
  LocationError,
  TRACKING_INTERVAL_MS,
  withTimeout,
  type LocationFix,
  type Position,
  type PositionOptions,
  type TrackingOptions,
} from './locationLogic';
import {
  clearPersistedTracking,
  persistTracking,
  readPersistedTracking,
  registerTrackingTeardown,
  resetUploadGate,
  uploadFixes,
} from './trackingCore';

export { LocationError, TRACKING_INTERVAL_MS } from './locationLogic';
export type { Position, PositionOptions, TrackingOptions, LocationSender, LocationPayload } from './locationLogic';

export const LOCATION_TASK_NAME = 'clockyn-location-task';
/** v1 foreground-service notification wording (kept verbatim). */
const BG_NOTIFICATION_TITLE = 'Location Tracking Active';
const BG_NOTIFICATION_BODY = 'Your location is being shared for field work';

type Session = { userId: string; orgId: string; send?: TrackingOptions['send']; intervalMs?: number };

let fgSubscription: Location.LocationSubscription | null = null;
let fgSession: Session | null = null;
let fgStarting: Promise<boolean> | null = null;

// ── permissions ──────────────────────────────────────────────────────────────────────────────

const ACCURACY: Record<NonNullable<PositionOptions['accuracy']>, LocationAccuracy> = {
  high: LocationAccuracy.High,
  balanced: LocationAccuracy.Balanced,
  low: LocationAccuracy.Low,
};

export async function requestLocationPermission(kind: 'foreground' | 'background'): Promise<boolean> {
  try {
    let fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return false;
    if (kind === 'foreground') return true;
    if (Platform.OS !== 'android') return false; // background location is Android-only
    let bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
    return bg.granted;
  } catch {
    return false;
  }
}

/** True when "Allow all the time" is granted (Android). Always false elsewhere. */
export async function hasBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return (await Location.getBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// ── one-off position ─────────────────────────────────────────────────────────────────────────

function toPosition(loc: Location.LocationObject): Position {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? undefined,
    timestamp: loc.timestamp,
    mocked: loc.mocked,
  };
}

export async function getCurrentPosition(opts: PositionOptions = {}): Promise<Position> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_POSITION_TIMEOUT_MS;
  const allowLastKnown = opts.allowLastKnown ?? true;

  let granted = false;
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    granted = perm.granted;
  } catch {
    granted = false;
  }
  if (!granted) throw new LocationError('denied');

  try {
    if (!(await Location.hasServicesEnabledAsync())) throw new LocationError('unavailable');
    const live = await withTimeout(Location.getCurrentPositionAsync({ accuracy: ACCURACY[opts.accuracy ?? 'high'] }), timeoutMs);
    return toPosition(live);
  } catch (e) {
    // Only when the live fix failed do we accept an older one.
    if (allowLastKnown) {
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: opts.maxLastKnownAgeMs ?? DEFAULT_LAST_KNOWN_MAX_AGE_MS });
        if (last) return toPosition(last);
      } catch {
        /* fall through to the original error */
      }
    }
    if (e instanceof LocationError) throw e;
    throw new LocationError('unavailable');
  }
}

// ── foreground tracking ──────────────────────────────────────────────────────────────────────

function fixOf(loc: Location.LocationObject): LocationFix {
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy ?? undefined, timestamp: loc.timestamp };
}

async function startForeground(opts: TrackingOptions): Promise<boolean> {
  if (fgSubscription && fgSession?.userId === opts.userId && fgSession.orgId === opts.orgId) return true;
  stopForegroundTracking();
  if (!(await requestLocationPermission('foreground'))) return false;
  const session: Session = { userId: opts.userId, orgId: opts.orgId || opts.userId, send: opts.send, intervalMs: opts.intervalMs };
  try {
    fgSession = session;
    fgSubscription = await Location.watchPositionAsync(
      { accuracy: LocationAccuracy.High, timeInterval: session.intervalMs ?? TRACKING_INTERVAL_MS, distanceInterval: 0 },
      (loc) => {
        void uploadFixes(session, [fixOf(loc)]).then((ok) => {
          if (!ok) void stopAllTracking(); // 403 → stop foreground AND background
        });
      },
    );
    await persistTracking(session.userId, session.orgId);
    return true;
  } catch {
    fgSession = null;
    fgSubscription = null;
    return false;
  }
}

/** Starts the 20 s foreground watcher (idempotent). Resolves `false` when permission is missing. */
export function startForegroundTracking(opts: TrackingOptions): Promise<boolean> {
  if (!fgStarting) {
    fgStarting = startForeground(opts).finally(() => {
      fgStarting = null;
    });
  }
  return fgStarting;
}

export function stopForegroundTracking(): void {
  try {
    fgSubscription?.remove();
  } catch {
    /* already removed */
  }
  fgSubscription = null;
  fgSession = null;
}

// ── background tracking (Android) ────────────────────────────────────────────────────────────

// Registered at module scope so the OS can start JS and deliver locations after the app was killed.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const locations = data?.locations ?? [];
  if (locations.length === 0) return;
  const persisted = await readPersistedTracking();
  if (!persisted) {
    // Nobody is tracking any more (signed out / punched out) — make sure the service dies.
    await stopBackgroundTracking();
    return;
  }
  const ok = await uploadFixes({ userId: persisted.userId, orgId: persisted.orgId }, locations.map(fixOf));
  if (!ok) await stopAllTracking();
});

/**
 * Starts the Android foreground-service location task. Never prompts: when "Allow all the time" is not
 * granted it resolves `false` (use `requestLocationPermission('background')` in context first).
 */
export async function startBackgroundTracking(opts: TrackingOptions): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await persistTracking(opts.userId, opts.orgId || opts.userId);
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) return true;
    if (!(await hasBackgroundLocationPermission())) return false;
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: LocationAccuracy.High,
      timeInterval: opts.intervalMs ?? TRACKING_INTERVAL_MS,
      distanceInterval: 0,
      deferredUpdatesInterval: opts.intervalMs ?? TRACKING_INTERVAL_MS,
      pausesUpdatesAutomatically: false,
      foregroundService: { notificationTitle: BG_NOTIFICATION_TITLE, notificationBody: BG_NOTIFICATION_BODY },
    });
    return true;
  } catch {
    return false; // e.g. Expo Go (no background location) or the service could not start
  }
}

/** Stops the background task and clears the persisted "tracking" intent. Safe to call when not running. */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {
    /* not registered */
  }
  await clearPersistedTracking();
}

// ── lifecycle ────────────────────────────────────────────────────────────────────────────────

/** Stops foreground + background tracking and forgets the session. Used on punch-out, 403 and sign-out. */
export async function stopAllTracking(): Promise<void> {
  stopForegroundTracking();
  await stopBackgroundTracking();
  resetUploadGate();
}

/**
 * Call once at app start (after auth hydration). Resumes tracking only when a tracking session was
 * persisted AND `shouldResume()` confirms the user is still punched in (a failing check keeps tracking,
 * like v1). Without a `shouldResume` callback nothing is resumed.
 */
export async function resumeTrackingIfNeeded(opts?: {
  shouldResume?: () => Promise<boolean>;
  /** When given, a persisted session of a different user is discarded. */
  userId?: string;
  send?: TrackingOptions['send'];
}): Promise<boolean> {
  const persisted = await readPersistedTracking();
  if (!persisted || !opts?.shouldResume) return false;
  if (opts.userId && opts.userId !== persisted.userId) {
    await stopAllTracking();
    return false;
  }
  let stillPunchedIn = true;
  try {
    stillPunchedIn = await opts.shouldResume();
  } catch {
    stillPunchedIn = true;
  }
  if (!stillPunchedIn) {
    await stopAllTracking();
    return false;
  }
  const t: TrackingOptions = { userId: persisted.userId, orgId: persisted.orgId, send: opts.send };
  const fg = await startForegroundTracking(t);
  const bg = await startBackgroundTracking(t);
  return fg || bg;
}

registerTrackingTeardown(stopAllTracking);
