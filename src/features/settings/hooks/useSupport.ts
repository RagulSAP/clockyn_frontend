import { useQuery } from '@tanstack/react-query';

import { supportApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';

/** Subjects of the new-ticket form (static, cached for the session). */
export function useSupportSubjects() {
  return useQuery({
    queryKey: queryKeys.support.subjects(),
    queryFn: () => supportApi.listSupportSubjects(),
    staleTime: 10 * 60_000,
  });
}

/** Tickets of the organisation (newest first) with their reply threads; scoped by organisation. */
export function useTickets() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.support.requests(orgId),
    queryFn: () => supportApi.listTickets(orgId),
    enabled: orgId !== '',
  });
}
