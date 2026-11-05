/**
 * Typed AsyncStorage wrapper + the registry of every persisted key.
 *
 * Rules
 *  - Keys are only ever written via `STORAGE_KEYS` (all prefixed `@clockyn/`).
 *  - Keys that are scoped to a user / org / mobile / date use `storageKeyFor(base, id)` => `base:id`.
 *  - Data caches that v1 kept in storage (lists, calendars, shifts, leads …) are NOT persisted any more:
 *    they live in the react-query cache. Refresh flags (`*_need_refresh`) are replaced by query invalidation.
 *  - All helpers swallow storage errors (storage is a best-effort layer) and report success as a boolean / null.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  // ── identity (persisted session) ────────────────────────────────────────────
  /** Persisted `{ session }` blob of the auth store. */
  auth: '@clockyn/auth',
  /** Trusted-device token. Scope: login mobile number. Survives sign-out (OTP can be skipped on re-login). */
  deviceToken: '@clockyn/device-token',
  /** Last viewed organisation of an admin. Scope: user id. Survives sign-out (restored on next login). */
  lastOrg: '@clockyn/last-org',
  /** Epoch ms of the last login (grace window before the single-device session check). */
  lastLoginAt: '@clockyn/last-login-at',

  // ── push / permissions / location ──────────────────────────────────────────
  /** Cached push token (cleared on sign-out). */
  pushToken: '@clockyn/push-token',
  /** 'true' once the notification permission prompt was shown (cleared on sign-out). */
  pushPermissionAsked: '@clockyn/push-permission-asked',
  /** 'true' | 'false': background/foreground location tracking intent (cleared on sign-out). */
  locationTrackingEnabled: '@clockyn/location-tracking-enabled',
  /** 'true' once the permission onboarding was completed. Scope: user id (unifies v1 admin/employee keys). */
  permissionsOnboardingDone: '@clockyn/permissions-onboarding-done',

  // ── UI preferences ──────────────────────────────────────────────────────────
  /** Theme preference ('system' | 'light' | 'dark') — owned by the ThemeProvider. */
  themePreference: '@clockyn/theme-preference',
  /** Chat group colour themes `{ [groupId]: index }`. Scope: user id. */
  groupThemes: '@clockyn/group-themes',
  /** Image URL cache prefix (`@clockyn/img/<key>`). */
  imageCachePrefix: '@clockyn/img/',

  // ── per-user seen / badge state ─────────────────────────────────────────────
  /** JSON string[] of announcement ids already seen (broadcast class). Scope: user id. */
  announcementSeenBroadcast: '@clockyn/announcement-seen-broadcast',
  /** JSON string[] of announcement ids already seen (targeted class). Scope: user id. */
  announcementSeenTargeted: '@clockyn/announcement-seen-targeted',
  /** JSON string[] of lead ids already seen by an employee. Scope: user id. */
  crmSeenLeadIds: '@clockyn/crm-seen-lead-ids',
  /** Last <= 50 punch notifications `{ id, title, body, image_url, type, received_at }`. Scope: user id. */
  punchNotifications: '@clockyn/punch-notifications',

  // ── local history ───────────────────────────────────────────────────────────
  /** Saved-report history (real file uris + mime). Scope: org id. */
  generatedReports: '@clockyn/generated-reports',
  /** Downloaded invoice history. Scope: org id. */
  downloadedInvoices: '@clockyn/downloaded-invoices',

  // ── app-level prompts ───────────────────────────────────────────────────────
  /** Rate-the-app prompt: qualifying-event counter (number string). */
  rateAppOpenCount: '@clockyn/rate-app-open-count',
  /** Rate-the-app prompt: 'true' = never ask again. */
  rateAppDone: '@clockyn/rate-app-done',
  /** Rate-the-app prompt: epoch ms the user chose "maybe later". */
  rateAppSnoozedAt: '@clockyn/rate-app-snoozed-at',
  /** Plan-expiry popup already shown. Scope: `YYYY-MM-DD` (+ org id: use `storageKeyFor(storageKeyFor(base, date), orgId)`). */
  planPopupShown: '@clockyn/plan-popup-shown',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Bases wiped on sign-out (any `:<scope>` suffix included). Everything else survives:
 * deviceToken, lastOrg, themePreference, imageCachePrefix, rateApp*, permissionsOnboardingDone, planPopupShown.
 */
export const SESSION_SCOPED_KEYS: readonly string[] = [
  STORAGE_KEYS.auth,
  STORAGE_KEYS.lastLoginAt,
  STORAGE_KEYS.pushToken,
  STORAGE_KEYS.pushPermissionAsked,
  STORAGE_KEYS.locationTrackingEnabled,
  STORAGE_KEYS.groupThemes,
  STORAGE_KEYS.announcementSeenBroadcast,
  STORAGE_KEYS.announcementSeenTargeted,
  STORAGE_KEYS.crmSeenLeadIds,
  STORAGE_KEYS.punchNotifications,
  STORAGE_KEYS.generatedReports,
  STORAGE_KEYS.downloadedInvoices,
];

/** Scope a key: `storageKeyFor(STORAGE_KEYS.lastOrg, userId)` => `@clockyn/last-org:<userId>`. */
export function storageKeyFor(key: string, id: string | number | null | undefined): string {
  const scope = id === null || id === undefined ? '' : String(id).trim();
  return scope ? `${key}:${scope}` : key;
}

/** Base part of a (possibly scoped) key. */
export function baseOfStorageKey(fullKey: string): string {
  const i = fullKey.indexOf(':', fullKey.indexOf('/') + 1);
  return i === -1 ? fullKey : fullKey.slice(0, i);
}

export async function getString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setString(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Read + JSON.parse. Returns `fallback` (default null) when missing, unreadable or corrupt. */
export async function getJSON<T>(key: string, fallback: T | null = null): Promise<T | null> {
  const raw = await getString(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<boolean> {
  try {
    return await setString(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export async function remove(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export async function multiRemove(keys: readonly string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  try {
    await AsyncStorage.multiRemove([...keys]);
    return true;
  } catch {
    return false;
  }
}

/** All stored keys that start with `prefix` (empty list on failure). */
export async function keysWithPrefix(prefix: string): Promise<string[]> {
  try {
    const all = await AsyncStorage.getAllKeys();
    return all.filter((k) => k.startsWith(prefix));
  } catch {
    return [];
  }
}

/** Remove every session-scoped key (see `SESSION_SCOPED_KEYS`), including scoped variants. Used by sign-out. */
export async function clearSessionStorage(): Promise<boolean> {
  try {
    const all = await AsyncStorage.getAllKeys();
    const doomed = all.filter((k) => k.startsWith('@clockyn/') && SESSION_SCOPED_KEYS.includes(baseOfStorageKey(k)));
    return await multiRemove(doomed);
  } catch {
    return false;
  }
}
