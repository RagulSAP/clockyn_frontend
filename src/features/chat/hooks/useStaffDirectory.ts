import { useQuery } from '@tanstack/react-query';

import { homeApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';

const FIVE_MINUTES = 5 * 60_000;

/**
 * Every role 2/3 user of the organisation (contact lookups, local staff search, group pickers).
 * Shares its cache entry with every other screen that lists the organisation's staff.
 */
export function useStaffDirectory(enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.home.allStaff(orgId),
    queryFn: () => homeApi.getAllStaff(orgId),
    enabled: enabled && orgId !== '',
    staleTime: FIVE_MINUTES,
  });
}

/** The organisation admin (the pinned conversation of managers / staff). */
export function useOrgAdminContact(enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.home.orgAdmin(orgId),
    queryFn: () => homeApi.getOrgAdmin(orgId),
    enabled: enabled && orgId !== '',
    staleTime: FIVE_MINUTES,
  });
}
