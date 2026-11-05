import { useQuery } from '@tanstack/react-query';

import { listEmployeeAnnouncements } from '@/api/announcements';
import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';

/** Staff members never see admin tools; admins have no announcement feed / badge (role 1). */
export function useAnnouncementViewer(): { userId: string; enabled: boolean } {
  const session = useSession();
  const userId = session?.userId ?? '';
  return { userId, enabled: userId !== '' && session?.roleId !== 1 };
}

/**
 * Every announcement visible to the signed-in staff member / manager (`/api/announcements/employee/{userId}`).
 * Shared by the two feeds and the unread sync (same query key), so the realtime layer's invalidation of
 * `queryKeys.announcements.mine(userId)` refreshes all of them.
 */
export function useEmployeeAnnouncements() {
  const { userId, enabled } = useAnnouncementViewer();
  return useQuery({
    queryKey: queryKeys.announcements.mine(userId),
    queryFn: () => listEmployeeAnnouncements(userId),
    enabled,
    staleTime: 30_000,
  });
}
