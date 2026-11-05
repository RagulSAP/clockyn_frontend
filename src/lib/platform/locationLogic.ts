/**
 * Pure location/tracking logic shared by the web and native location modules (unit-tested).
 */

/** Upload cadence while a field-staff member is punched in (same as the previous generation of the product). */
export const TRACKING_INTERVAL_MS = 20_000;
/** A fix may be sent slightly early to absorb OS timer jitter. */
export const INTERVAL_TOLERANCE = 0.9;

export type Position = { latitude: number; longitude: number; accuracy?: number; timestamp?: number; mocked?: boolean };

export type LocationFix = { latitude: number; longitude: number; accuracy?: number; /** epoch ms */ timestamp: number };

/** One upload (same shape as `LocationLogInput` of `@/api/location`). */
export type LocationPayload = {
  userId: string;
  orgId: string;
  latitude: number;
  longitude: number;
  /** ISO-8601 time of the fix (not of the upload). */
  timestamp: string;
};

/** Wire body of `POST /staff-location/log`. */
export function toLogBody(p: LocationPayload): { user_id: string; org_id: string; latitude: number; longitude: number; timestamp: string } {
  return { user_id: p.userId, org_id: p.orgId, latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp };
}

export type LocationSender = (payload: LocationPayload) => Promise<unknown>;

export type TrackingOptions = {
  userId: string;
  /** `current_org_id || user_id` (see Session.orgId). */
  orgId: string;
  /** Upload function. Defaults to `logLocation` from `@/api/location`. */
  send?: LocationSender;
  intervalMs?: number;
};

export type LocationErrorCode = 'denied' | 'unavailable' | 'timeout';

export class LocationError extends Error {
  readonly code: LocationErrorCode;
  constructor(code: LocationErrorCode, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'LocationError';
    this.code = code;
  }
}

const DEFAULT_MESSAGES: Record<LocationErrorCode, string> = {
  denied: 'Location permission denied',
  unavailable: 'Unable to get your location. Please check your GPS signal and try again.',
  timeout: 'Timed out while getting your location',
};

export type PositionOptions = {
  /** Default `high`. */
  accuracy?: 'high' | 'balanced' | 'low';
  /** Default 15 000 ms. */
  timeoutMs?: number;
  /** Fall back to the last known position when the live fix fails. Default `true`. */
  allowLastKnown?: boolean;
  /** Oldest acceptable last-known position. Default 5 minutes. */
  maxLastKnownAgeMs?: number;
};

export const DEFAULT_POSITION_TIMEOUT_MS = 15_000;
export const DEFAULT_LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

/** True when at least one (tolerance-adjusted) interval elapsed since the last upload. */
export function shouldSendFix(lastSentAt: number | null, fixTime: number, intervalMs = TRACKING_INTERVAL_MS): boolean {
  if (lastSentAt === null) return true;
  return fixTime - lastSentAt >= intervalMs * INTERVAL_TOLERANCE;
}

/**
 * Picks the fixes of a batch that are worth uploading. Fixes are processed oldest-first, so a whole
 * background batch is delivered (v1 sent only the first fix) while fixes that arrive faster than the
 * cadence (iOS ignores `timeInterval`) are dropped. Returns the new "last sent" watermark.
 */
export function selectFixesToSend(
  fixes: LocationFix[],
  lastSentAt: number | null,
  intervalMs = TRACKING_INTERVAL_MS,
): { toSend: LocationFix[]; lastSentAt: number | null } {
  const sorted = [...fixes].sort((a, b) => a.timestamp - b.timestamp);
  const toSend: LocationFix[] = [];
  let watermark = lastSentAt;
  for (const fix of sorted) {
    if (shouldSendFix(watermark, fix.timestamp, intervalMs)) {
      toSend.push(fix);
      watermark = fix.timestamp;
    }
  }
  return { toSend, lastSentAt: watermark };
}

export function buildLocationPayload(userId: string, orgId: string, fix: LocationFix): LocationPayload {
  return {
    userId,
    orgId: orgId || userId,
    latitude: fix.latitude,
    longitude: fix.longitude,
    timestamp: new Date(fix.timestamp).toISOString(),
  };
}

/** 403 from the log endpoint means "not a field-staff member / not authorised" → tracking must stop. */
export function isForbiddenError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const status = (e as { status?: unknown }).status;
  return status === 403;
}

/** Persisted (AsyncStorage) description of an active tracking session so it can resume after a restart. */
export type PersistedTracking = { userId: string; orgId: string; startedAt: number };

export const TRACKING_STORAGE_KEY = '@clockyn/location_tracking';

export function parsePersistedTracking(raw: string | null): PersistedTracking | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PersistedTracking>;
    if (typeof v.userId === 'string' && v.userId && typeof v.orgId === 'string') {
      return { userId: v.userId, orgId: v.orgId, startedAt: typeof v.startedAt === 'number' ? v.startedAt : 0 };
    }
  } catch {
    /* corrupt value → treated as "not tracking" */
  }
  return null;
}

/** Rejects with `LocationError('timeout')` when `promise` does not settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LocationError('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
