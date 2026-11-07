import { useQuery } from '@tanstack/react-query';

import { supportApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';

/** Active Video Hub guide videos. Links are presigned for hours; 5 minutes keeps new / hidden videos fresh. */
export function useSupportVideos() {
  return useQuery({
    queryKey: queryKeys.support.videos(),
    queryFn: () => supportApi.listSupportVideos(),
    staleTime: 5 * 60_000,
  });
}
