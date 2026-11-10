/**
 * Runtime configuration (all values come from EXPO_PUBLIC_* env vars — see `.env.example`).
 * Never hard-code URLs, e-mail addresses or keys elsewhere; import from here.
 */
const read = (v: string | undefined, fallback = ''): string => (v && v.trim().length > 0 ? v.trim() : fallback);

export const env = {
  /** Backend base URL, no trailing slash. */
  apiBaseUrl: read(process.env.EXPO_PUBLIC_API_BASE_URL, 'https://pykmtbmmxn.ap-south-1.awsapprunner.com').replace(/\/+$/, ''),
  supportEmail: read(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
  salesEmail: read(process.env.EXPO_PUBLIC_SALES_EMAIL),
  privacyPolicyUrl: read(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL),
  webPortalUrl: read(process.env.EXPO_PUBLIC_WEB_PORTAL_URL),
  androidStoreUrl: read(process.env.EXPO_PUBLIC_ANDROID_STORE_URL),
  iosStoreUrl: read(process.env.EXPO_PUBLIC_IOS_STORE_URL),
  /** Employee Access (staff / manager sign-in) is for the Android / iOS app only. Set to `true` ONLY for the browser test build. */
  /** Usage analytics (screen views and button taps, no typed text). Set `off` to switch it off for a build. */
  analyticsEnabled: !['off', 'false', '0'].includes(read(process.env.EXPO_PUBLIC_ANALYTICS).toLowerCase()),
  allowWebEmployee: read(process.env.EXPO_PUBLIC_ALLOW_WEB_EMPLOYEE).toLowerCase() === 'true',
} as const;

/** WebSocket base derived from the API base (http→ws, https→wss). */
export const wsBaseUrl = env.apiBaseUrl.replace(/^http/, 'ws');
