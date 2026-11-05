import { brand } from '@/config/brand';
import type { UpdateInfo } from '@/lib/platform/appUpdate';

export type UpdatePromptCopy = {
  title: string;
  message: string;
  /** A forced update has no "Later" and cannot be dismissed. */
  dismissible: boolean;
  primaryLabel: string;
  secondaryLabel: string | null;
};

/** Minimum time between two automatic update checks (start + foreground events). */
export const UPDATE_CHECK_MIN_INTERVAL_MS = 10 * 60 * 1000;

/** Copy of the update modal (v1 wording; the hard-coded store name is dropped so it is right on every platform). */
export function updatePromptCopy(info: Pick<UpdateInfo, 'forceUpdate' | 'message'>): UpdatePromptCopy {
  if (info.forceUpdate) {
    return {
      title: 'Update Required',
      message: info.message || `A new version is required to continue using ${brand.name}. Please update now.`,
      dismissible: false,
      primaryLabel: 'Update Now',
      secondaryLabel: null,
    };
  }
  return {
    title: 'Update Available',
    message: info.message || 'A new version is available with the latest features & fixes.',
    dismissible: true,
    primaryLabel: 'Update Now',
    secondaryLabel: 'Later',
  };
}

/** Should an automatic check run now? (first run, or at least `minIntervalMs` since the last one). */
export function shouldRunUpdateCheck(lastCheckAt: number, now: number, minIntervalMs = UPDATE_CHECK_MIN_INTERVAL_MS): boolean {
  return lastCheckAt === 0 || now - lastCheckAt >= minIntervalMs;
}
