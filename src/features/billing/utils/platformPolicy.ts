import { Platform } from 'react-native';

/**
 * Store policy: the native iOS app is VIEW-ONLY for billing (no plan picker, upgrade, renew, checkout or web-portal
 * link). Android and web can purchase.
 */
export function canPurchase(os: string = Platform.OS): boolean {
  return os !== 'ios';
}

/** The "manage billing on the web" link is shown on Android only, and only when a portal URL is configured. */
export function showWebPortalLink(os: string, portalUrl: string): boolean {
  return os === 'android' && portalUrl.trim() !== '';
}
