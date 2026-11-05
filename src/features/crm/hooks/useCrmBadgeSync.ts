import { useEffect, useMemo } from 'react';
import { usePathname } from 'expo-router';

import { routes } from '@/config/routes';
import { useAppActive, useOrgPlan } from '@/hooks';
import { useRole, useUserId } from '@/store/auth';

import { markCrmSeen, syncCrmBadge, tracksCrmBadge } from '../seenLeads';
import { useEmployeeLeadsQuery } from './useEmployeeLeads';

/** v1 computed the badge once per launch; it is refreshed every 5 minutes while the app is in the foreground. */
export const CRM_BADGE_REFRESH_MS = 5 * 60_000;

/**
 * Feeds `@/store/badges.crm` for managers and staff (admins get none): the number of employee leads not yet seen on
 * this device. Mount once in the app bootstrap. While the CRM tab is open everything counts as seen (badge 0).
 */
export function useCrmBadgeSync(): void {
  const role = useRole();
  const userId = useUserId();
  const plan = useOrgPlan();
  const active = useAppActive();
  const pathname = usePathname();

  const tracked = tracksCrmBadge(role);
  // No lead fetch while the plan loads or blocks CRM (v1 checked the plan before loading anything).
  const blocked = plan.isBlocked('crm') || plan.isLoading;
  const query = useEmployeeLeadsQuery({
    enabled: tracked && !blocked,
    refetchInterval: tracked && !blocked && active ? CRM_BADGE_REFRESH_MS : false,
  });
  const ids = useMemo(() => query.data?.map((l) => l.id), [query.data]);
  const onCrmTab = pathname === routes.staff.crm;

  useEffect(() => {
    if (!tracked || !ids) return;
    void (onCrmTab ? markCrmSeen(userId, ids) : syncCrmBadge(userId, role, ids)).catch(() => undefined);
  }, [tracked, ids, onCrmTab, userId, role]);
}
