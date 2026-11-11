import { useQuery } from '@tanstack/react-query';

import { referralApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useRole } from '@/store/auth';

/** This organisation's referral page (code, share text, reward counts, referred organisations). */
export function useReferral() {
  const orgId = useOrgId();
  const role = useRole();
  return useQuery({
    queryKey: queryKeys.referral.mine(orgId),
    queryFn: () => referralApi.getMyReferral(orgId),
    enabled: orgId !== '' && role === 1, // the endpoint is org-admin only
    staleTime: 0,
  });
}
