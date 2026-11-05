/** Pure helpers of the app-update check (unit-tested). */

export type UpdateInfo = {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  /** Where "Update now" goes (backend value, else the env-configured store URL; empty when unknown). */
  storeUrl: string;
  forceUpdate: boolean;
  message: string;
};

/** Shape returned by `@/api/system` `checkAppVersion`. */
export type BackendVersionCheck = {
  updateRequired: boolean;
  latestVersion: string | null;
  forceUpdate: boolean;
  message: string | null;
  storeUrl: string | null;
};

/** True only when `latest` is strictly newer than `current` (component-wise numeric compare, missing = 0). */
export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.split('.').map((p) => (Number.parseInt(p, 10) || 0));
  const a = parse(current);
  const b = parse(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (y > x) return true;
    if (y < x) return false;
  }
  return false;
}

/** Store URL chosen from the backend value or the env fallback (never scraped). */
export function pickStoreUrl(backendUrl: string | null | undefined, platform: string, env: { androidStoreUrl: string; iosStoreUrl: string }): string {
  if (backendUrl) return backendUrl;
  return platform === 'ios' ? env.iosStoreUrl : platform === 'android' ? env.androidStoreUrl : '';
}

/**
 * Turns the backend answer into `UpdateInfo`. The backend is authoritative (`updateRequired`, `forceUpdate`),
 * but a "required" answer that is not actually newer than the installed version is ignored.
 */
export function interpretVersionCheck(
  raw: BackendVersionCheck,
  currentVersion: string,
  platform: string,
  env: { androidStoreUrl: string; iosStoreUrl: string },
): UpdateInfo {
  const latest = raw.latestVersion ?? currentVersion;
  const newer = raw.latestVersion ? isNewerVersion(currentVersion, raw.latestVersion) : true;
  const hasUpdate = raw.updateRequired && newer;
  return {
    hasUpdate,
    latestVersion: latest,
    currentVersion,
    storeUrl: pickStoreUrl(raw.storeUrl, platform, env),
    forceUpdate: hasUpdate && raw.forceUpdate,
    message: raw.message ?? '',
  };
}
