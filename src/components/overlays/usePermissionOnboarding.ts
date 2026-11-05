import { useCallback, useEffect, useState } from 'react';

import { getString, remove, setString, STORAGE_KEYS, storageKeyFor } from '@/lib/storage';
import { useSession } from '@/store/auth';

/** Show the intro shortly after the home screen has loaded (v1: 1.5 s for admins). */
export const ONBOARDING_DELAY_MS = 1500;

/** Completion flag for one user. Per-user for every role (v1 used one global key for admins). */
export const onboardingKeyFor = (userId: string): string => storageKeyFor(STORAGE_KEYS.permissionsOnboardingDone, userId);

export async function isOnboardingDone(userId: string): Promise<boolean> {
  return (await getString(onboardingKeyFor(userId))) === 'true';
}

export async function markOnboardingDone(userId: string): Promise<void> {
  await setString(onboardingKeyFor(userId), 'true');
}

/** Forget completion so the intro appears again (e.g. right after a fresh registration). */
export async function resetOnboarding(userId: string): Promise<void> {
  await remove(onboardingKeyFor(userId));
}

/**
 * Decides whether `<PermissionOnboarding />` should show for the signed-in user: once per user per device, after a
 * short delay. Call from each home screen: `const { visible, complete } = usePermissionOnboarding();`.
 * Survives sign-out (the key is not session-scoped), so a returning user is not asked twice.
 */
export function usePermissionOnboarding(opts: { delayMs?: number } = {}): { visible: boolean; complete: () => void } {
  const userId = useSession()?.userId ?? '';
  const delayMs = opts.delayMs ?? ONBOARDING_DELAY_MS;
  // The user the intro is currently shown for; a different (or no) user means hidden.
  const [shownFor, setShownFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void isOnboardingDone(userId).then((done) => {
      if (cancelled || done) return;
      timer = setTimeout(() => {
        if (!cancelled) setShownFor(userId);
      }, delayMs);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId, delayMs]);

  const complete = useCallback(() => {
    setShownFor(null);
    if (userId) void markOnboardingDone(userId);
  }, [userId]);

  return { visible: !!userId && shownFor === userId, complete };
}
