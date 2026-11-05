import { useCallback, useEffect, useState } from 'react';

import { useAppActive } from '@/hooks';
import { getPermissionDetail } from '@/lib/platform/permissions';

import { PERMISSIONS, UNKNOWN_PERMISSIONS, type PermissionMap } from '../utils/permissionsLogic';

async function readAll(): Promise<PermissionMap> {
  const entries = await Promise.all(PERMISSIONS.map(async (p) => [p.kind, await getPermissionDetail(p.kind)] as const));
  return Object.fromEntries(entries) as PermissionMap;
}

/**
 * Device permission status for the permissions screen. Re-checks on mount and every time the app returns to the
 * foreground (e.g. coming back from the OS settings) — never by polling.
 */
export function usePermissionStatuses() {
  const [map, setMap] = useState<PermissionMap>(UNKNOWN_PERMISSIONS);
  const [loaded, setLoaded] = useState(false);
  const active = useAppActive();

  const refresh = useCallback(async () => {
    setMap(await readAll());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    readAll()
      .then((next) => {
        if (cancelled) return;
        setMap(next);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { map, loaded, refresh };
}
