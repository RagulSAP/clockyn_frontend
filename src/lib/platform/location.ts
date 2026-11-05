/**
 * Location — WEB / default implementation (browser Geolocation API).
 *
 *  - getCurrentPosition: live fix; last-known fallback (cached fix or browser-cached position) only when it fails.
 *  - Foreground tracking: `watchPosition` throttled to one upload per 20 s while the tab is open.
 *  - Background tracking does not exist on the web: `startBackgroundTracking` resolves `false`
 *    (documented no-op); `stopBackgroundTracking` only clears the persisted intent.
 * The native implementation lives in `location.native.ts`.
 */
import {
  DEFAULT_LAST_KNOWN_MAX_AGE_MS,
  DEFAULT_POSITION_TIMEOUT_MS,
  LocationError,
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

type Session = { userId: string; orgId: string; send?: TrackingOptions['send']; intervalMs?: number };

let watchId: number | null = null;
let session: Session | null = null;
let lastFix: Position | null = null;

function geo(): Geolocation | null {
  return typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null;
}

function fromBrowser(p: GeolocationPosition): Position {
  return {
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracy: p.coords.accuracy ?? undefined,
    timestamp: p.timestamp,
  };
}

function toError(e: GeolocationPositionError | unknown): LocationError {
  const code = (e as GeolocationPositionError | undefined)?.code;
  if (code === 1) return new LocationError('denied'); // PERMISSION_DENIED
  if (code === 3) return new LocationError('timeout'); // TIMEOUT
  return new LocationError('unavailable');
}

function browserFix(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    const g = geo();
    if (!g) return reject(new LocationError('unavailable', 'Geolocation is not supported by this browser'));
    g.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: (options.accuracy ?? 'high') === 'high',
      timeout: options.timeoutMs ?? DEFAULT_POSITION_TIMEOUT_MS,
      maximumAge: 0,
    });
  });
}

export async function requestLocationPermission(kind: 'foreground' | 'background'): Promise<boolean> {
  if (kind === 'background' || !geo()) return false; // no background location on the web
  try {
    await browserFix({ timeoutMs: DEFAULT_POSITION_TIMEOUT_MS, accuracy: 'low' });
    return true;
  } catch (e) {
    // A timeout / unavailable fix still means the user granted access; only an explicit denial is "no".
    return (e instanceof LocationError ? e : toError(e)).code !== 'denied';
  }
}

export async function hasBackgroundLocationPermission(): Promise<boolean> {
  return false;
}

export async function getCurrentPosition(opts: PositionOptions = {}): Promise<Position> {
  try {
    const live = fromBrowser(await browserFix(opts));
    lastFix = live;
    return live;
  } catch (e) {
    const err = e instanceof LocationError ? e : toError(e);
    if (err.code === 'denied') throw err;
    if (opts.allowLastKnown ?? true) {
      const maxAge = opts.maxLastKnownAgeMs ?? DEFAULT_LAST_KNOWN_MAX_AGE_MS;
      if (lastFix && Date.now() - (lastFix.timestamp ?? 0) <= maxAge) return lastFix;
      // Ask the browser for whatever it has cached.
      const cached = await new Promise<Position | null>((resolve) => {
        const g = geo();
        if (!g) return resolve(null);
        g.getCurrentPosition((p) => resolve(fromBrowser(p)), () => resolve(null), { enableHighAccuracy: false, timeout: 1_000, maximumAge: maxAge });
      });
      if (cached) return cached;
    }
    throw err;
  }
}

export async function startForegroundTracking(opts: TrackingOptions): Promise<boolean> {
  const g = geo();
  if (!g) return false;
  if (watchId !== null && session?.userId === opts.userId && session.orgId === (opts.orgId || opts.userId)) return true;
  stopForegroundTracking();
  const s: Session = { userId: opts.userId, orgId: opts.orgId || opts.userId, send: opts.send, intervalMs: opts.intervalMs };
  session = s;
  watchId = g.watchPosition(
    (p) => {
      const pos = fromBrowser(p);
      lastFix = pos;
      const fix: LocationFix = { latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy, timestamp: pos.timestamp ?? Date.now() };
      void uploadFixes(s, [fix]).then((ok) => {
        if (!ok) void stopAllTracking(); // 403 → stop everything
      });
    },
    (err) => {
      if (err.code === 1) stopForegroundTracking(); // permission revoked
    },
    { enableHighAccuracy: true, maximumAge: 0 },
  );
  await persistTracking(s.userId, s.orgId);
  return true;
}

export function stopForegroundTracking(): void {
  if (watchId !== null) geo()?.clearWatch(watchId);
  watchId = null;
  session = null;
}

/** Web has no background location. Resolves `false`. */
export async function startBackgroundTracking(_opts: TrackingOptions): Promise<boolean> {
  return false;
}

export async function stopBackgroundTracking(): Promise<void> {
  await clearPersistedTracking();
}

export async function stopAllTracking(): Promise<void> {
  stopForegroundTracking();
  await stopBackgroundTracking();
  resetUploadGate();
}

export async function resumeTrackingIfNeeded(opts?: {
  shouldResume?: () => Promise<boolean>;
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
  return startForegroundTracking({ userId: persisted.userId, orgId: persisted.orgId, send: opts.send });
}

registerTrackingTeardown(stopAllTracking);
