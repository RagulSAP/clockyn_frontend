/**
 * Platform-neutral plumbing for location tracking: upload with 403 handling, de-duplication across the
 * foreground watcher and the background task, persistence of "I am tracking" (so a restart can resume),
 * and sign-out teardown registration. No native-only imports.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/lib/storage';
import {
  TRACKING_INTERVAL_MS,
  buildLocationPayload,
  isForbiddenError,
  parsePersistedTracking,
  selectFixesToSend,
  type LocationFix,
  type LocationSender,
  type PersistedTracking,
} from './locationLogic';

/** Shared watermark: the foreground watcher and the background task never double-upload the same slot. */
let lastSentAt: number | null = null;

export function resetUploadGate(): void {
  lastSentAt = null;
}

/** Resolves the uploader: an explicit `send`, else `logLocation` from `@/api/location` (loaded lazily). */
export function resolveSender(send?: LocationSender): LocationSender {
  if (send) return send;
  return async (payload) => {
    // Lazy + guarded so this module has no import-time dependency on the API layer (and no cycles).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/api/location') as { logLocation?: (input: typeof payload) => Promise<unknown> } | undefined;
    if (!mod?.logLocation) throw new Error('Location upload is not configured');
    return mod.logLocation(payload);
  };
}

/**
 * Uploads the worthwhile fixes of a batch (oldest first). Returns `false` when the server answered 403
 * (not a field-staff member / not authorised) — the caller must then stop ALL tracking.
 * Other failures are dropped (no offline queue in this phase) and never thrown.
 */
export async function uploadFixes(
  session: { userId: string; orgId: string; send?: LocationSender; intervalMs?: number },
  fixes: LocationFix[],
): Promise<boolean> {
  const { toSend, lastSentAt: watermark } = selectFixesToSend(fixes, lastSentAt, session.intervalMs ?? TRACKING_INTERVAL_MS);
  if (toSend.length === 0) return true;
  lastSentAt = watermark;
  const send = resolveSender(session.send);
  for (const fix of toSend) {
    try {
      await send(buildLocationPayload(session.userId, session.orgId, fix));
    } catch (e) {
      if (isForbiddenError(e)) return false;
      // Dropped upload; never log coordinates or identifiers.
      console.warn('[location] upload failed');
    }
  }
  return true;
}

// ── persistence ──────────────────────────────────────────────────────────────────────────────

export async function persistTracking(userId: string, orgId: string): Promise<void> {
  const value: PersistedTracking = { userId, orgId, startedAt: Date.now() };
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.locationTrackingEnabled, JSON.stringify(value));
  } catch {
    /* best-effort */
  }
}

export async function readPersistedTracking(): Promise<PersistedTracking | null> {
  try {
    return parsePersistedTracking(await AsyncStorage.getItem(STORAGE_KEYS.locationTrackingEnabled));
  } catch {
    return null;
  }
}

export async function clearPersistedTracking(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.locationTrackingEnabled);
  } catch {
    /* best-effort */
  }
}

// ── sign-out teardown ────────────────────────────────────────────────────────────────────────

/** Registers `stop` with the auth store's teardown registry when it exists (it is created by the auth store owner). */
export function registerTrackingTeardown(stop: () => Promise<void> | void): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/store/auth') as { registerTeardown?: (fn: () => Promise<void> | void) => unknown } | undefined;
    if (typeof mod?.registerTeardown === 'function') mod.registerTeardown(stop);
  } catch {
    /* auth store not available (tests / early boot) — the root bootstrap can call stopAllTracking() itself */
  }
}
