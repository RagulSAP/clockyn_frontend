import { useMemo } from 'react';
import type { QueryKey } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';

export interface OrgScope {
  userId: string;
  /** `current_org_id || user_id` of the session. */
  orgId: string;
  roleId: 0 | 1 | 2 | 3;
  /**
   * Id sent as "org" by the branch / staff-edit calls: the org for admins, the manager's OWN user id for managers
   * (the backend resolves a manager's scope from it; v1 contract).
   */
  scopeId: string;
  isManager: boolean;
}

/** Org / role context of the org-structure screens (admin, or a manager holding the matching permission). */
export function useOrgScope(): OrgScope {
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = session?.orgId ?? '';
  const roleId = session?.roleId ?? 0;
  return useMemo(
    () => ({ userId, orgId, roleId, scopeId: roleId === 2 ? userId : orgId, isManager: roleId === 2 }),
    [userId, orgId, roleId],
  );
}

/** Query keys to invalidate after a branch / department / staff change (deduplicated across the two scope ids). */
export function orgStructureKeys(scope: Pick<OrgScope, 'orgId' | 'scopeId'>, domains: ('branches' | 'departments' | 'staff' | 'home' | 'shifts')[]): QueryKey[] {
  const ids = Array.from(new Set([scope.orgId, scope.scopeId].filter((id) => id !== '')));
  const keys: QueryKey[] = [];
  for (const id of ids) {
    for (const domain of domains) keys.push([...queryKeys[domain].all(id)]);
  }
  return keys;
}
