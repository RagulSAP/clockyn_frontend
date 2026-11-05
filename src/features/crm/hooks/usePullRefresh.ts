import { useCallback, useState } from 'react';

import { useMounted } from '@/hooks';

/** Pull-to-refresh state: `refreshing` is true only for a user-initiated refresh and always clears (try/finally). */
export function usePullRefresh(refetch: () => Promise<unknown>): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);
  const isMounted = useMounted();
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      try {
        await refetch();
      } catch {
        // query errors are surfaced by the screens (error states); the spinner must still stop
      } finally {
        if (isMounted()) setRefreshing(false);
      }
    })();
  }, [refetch, isMounted]);
  return { refreshing, onRefresh };
}
