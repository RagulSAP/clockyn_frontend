/** The app's one clickstream instance (see ./clickstream.ts). Safe to call from anywhere: it records nothing until a user is signed in. */
import { Platform } from 'react-native';

import { sendClickstream } from '@/api/analytics';
import { env } from '@/config/env';
import { getCurrentVersion } from '@/lib/platform/appUpdate';

import { createClickstream } from './clickstream';

export { screenName, cleanLabel, FLUSH_INTERVAL_MS } from './clickstream';

const instance = createClickstream({
  send: sendClickstream,
  platform: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android',
  appVersion: getCurrentVersion(),
});

/** Switched off for a build with EXPO_PUBLIC_ANALYTICS=off: every call becomes a no-op. */
export const clickstream = env.analyticsEnabled
  ? instance
  : { ...instance, setIdentity: () => undefined, screenView: () => undefined, click: () => undefined, resume: () => undefined, flush: async () => undefined };
