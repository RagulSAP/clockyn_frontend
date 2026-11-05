/**
 * Trusted-device token store, keyed by the login mobile number.
 * The token is issued by the server after an OTP login; it survives sign-out so the OTP can be skipped next time.
 */
import { getString, remove, setString, STORAGE_KEYS, storageKeyFor } from '@/lib/storage';

const keyFor = (mobile: string): string => storageKeyFor(STORAGE_KEYS.deviceToken, mobile);

/** The stored token for this mobile number, or `null`. */
export async function getDeviceToken(mobile: string): Promise<string | null> {
  const value = await getString(keyFor(mobile));
  return value && value.trim() !== '' ? value : null;
}

export async function setDeviceToken(mobile: string, token: string): Promise<void> {
  if (!token) return;
  await setString(keyFor(mobile), token);
}

/** Forget the token (an approved device change invalidates it on the server). */
export async function clearDeviceToken(mobile: string): Promise<void> {
  await remove(keyFor(mobile));
}
