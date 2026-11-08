import { useQuery } from '@tanstack/react-query';

import { supportApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';

/** Active FAQs for Support > FAQ. They change rarely, so 5 minutes keeps newly added or hidden ones fresh enough. */
export function useSupportFaqs() {
  return useQuery({
    queryKey: queryKeys.support.faqs(),
    queryFn: () => supportApi.listFaqs(),
    staleTime: 5 * 60_000,
  });
}
