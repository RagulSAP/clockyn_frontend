import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppActive } from '@/hooks';
import { getPermissionDetail, type PermissionDetail, type PermissionKind } from '@/lib/platform/permissions';

/** The permissions listed on the App Permissions screen. */
export const LISTED_PERMISSIONS: readonly PermissionKind[] = ['location', 'camera', 'notifications'];

export type PermissionStatusMap = Record<PermissionKind, PermissionDetail | undefined>;

/** Delay before re-reading a permission after sending the user to the OS / browser settings. */
export const RECHECK_AFTER_SETTINGS_MS = 1000;

async function readAll(): Promise<Partial<PermissionStatusMap>> {
  const entries = await Promise.all(LISTED_PERMISSIONS.map(async (k) => [k, await getPermissionDetail(k)] as const));
  return Object.fromEntries(entries);
}

/**
 * Live status of the listed permissions: read on mount, whenever the app returns to the foreground
 * (`refresh()` is also called 1 s after opening the OS settings).
 */
export function usePermissionStatus(): { status: PermissionStatusMap; refresh: () => Promise<void>; refreshSoon: () => void } {
  const [status, setStatus] = useState<PermissionStatusMap>({ location: undefined, camera: undefined, notifications: undefined, photos: undefined });
  const active = useAppActive();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const read = await readAll();
    setStatus((prev) => ({ ...prev, ...read }));
  }, []);

  // Read on mount and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    void readAll().then((read) => {
      if (!cancelled) setStatus((prev) => ({ ...prev, ...read }));
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), RECHECK_AFTER_SETTINGS_MS);
  }, [refresh]);

  return { status, refresh, refreshSoon };
}
