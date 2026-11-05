/**
 * App update check. The backend (`/version/check`) decides whether an update exists and whether it is
 * mandatory; the store URL falls back to the env-configured one. There is no store scraping.
 * Web has no store: the check is skipped (`null`); a service-worker "reload" prompt would be the web analogue.
 */
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { checkAppVersion as fetchVersionCheck } from '@/api/system';
import { env } from '@/config/env';
import { interpretVersionCheck, type BackendVersionCheck, type UpdateInfo } from './appUpdateLogic';

export { isNewerVersion, interpretVersionCheck, pickStoreUrl } from './appUpdateLogic';
export type { UpdateInfo, BackendVersionCheck } from './appUpdateLogic';

export function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Native application id (iOS bundle identifier / Android package), sent so the backend picks this app's version rows. */
export function getAppId(): string | undefined {
  const cfg = Constants.expoConfig;
  return (Platform.OS === 'ios' ? cfg?.ios?.bundleIdentifier : cfg?.android?.package) || undefined;
}

/**
 * Resolves `UpdateInfo`, or `null` when the check is not applicable (web) or failed (offline, server
 * error) — failures are silent by design (v1 behaviour).
 */
export async function checkAppVersion(opts?: {
  /** Test seam / override for the backend call. */
  fetchCheck?: (platform: string, version: string, appId?: string) => Promise<BackendVersionCheck>;
}): Promise<UpdateInfo | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  const current = getCurrentVersion();
  try {
    const raw = await (opts?.fetchCheck ?? fetchVersionCheck)(Platform.OS, current, getAppId());
    return interpretVersionCheck(raw, current, Platform.OS, env);
  } catch {
    return null;
  }
}

/** Opens the store listing. Resolves `false` when no URL is known or it cannot be opened. */
export async function openStore(url?: string): Promise<boolean> {
  const target = url || (Platform.OS === 'ios' ? env.iosStoreUrl : env.androidStoreUrl);
  if (!target) return false;
  try {
    await Linking.openURL(target);
    return true;
  } catch {
    return false;
  }
}
