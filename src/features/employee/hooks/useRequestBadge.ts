import { useQuery } from '@tanstack/react-query';

import { requestsApi } from '@/api';
import { useRefreshOnFocus } from '@/hooks';
import { addDaysStr, todayIST } from '@/lib/datetime';
import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';
import type { StaffRequest } from '@/types/api/requests';

import { countPendingRequests, type BadgeRequest } from '../utils/punchState';

const LEAVE_LOOKBACK_DAYS = 366;

function toBadgeRequest(r: StaffRequest): BadgeRequest {
  const rawStatus = r.raw.status;
  return {
    type: r.type,
    status: typeof rawStatus === 'string' ? rawStatus : undefined,
    dateStatuses: r.dateStatuses,
  };
}

/**
 * Pending requests of the employee. The server's employee list carries no per-date statuses, so for leave /
 * permission requests that lack them the request calendar (per-date statuses) is consulted for their date range.
 */
export async function loadPendingRequestCount(userId: string, orgId: string): Promise<number> {
  const requests = await requestsApi.listEmployeeRequests(userId, orgId);
  const badge = requests.map(toBadgeRequest);

  const undecided = requests.filter(
    (r, i) =>
      (r.type === 'leave' || r.type === 'permission') &&
      Object.keys(r.dateStatuses).length === 0 &&
      badge[i].status === undefined &&
      r.dates.length > 0,
  );
  if (undecided.length > 0) {
    const floor = addDaysStr(todayIST(), -LEAVE_LOOKBACK_DAYS);
    const dates = undecided
      .flatMap((r) => r.dates)
      .filter((d) => d >= floor)
      .sort();
    if (dates.length > 0) {
      try {
        const calendar = await requestsApi.getRequestCalendar(userId, orgId, dates[0], dates[dates.length - 1]);
        const byDate = new Map(calendar.map((c) => [c.date, c.status]));
        requests.forEach((r, i) => {
          if (!undecided.includes(r)) return;
          const statuses: Record<string, { status: string }> = {};
          for (const d of r.dates) {
            const s = byDate.get(d);
            if (s) statuses[d] = { status: s };
          }
          badge[i] = { ...badge[i], dateStatuses: statuses };
        });
      } catch {
        // the badge is best-effort: without per-date statuses these requests are simply not counted
      }
    }
  }
  return countPendingRequests(badge);
}

/** Pending request count for the Requests badge (re-read on every focus). */
export function useRequestBadge(): number {
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = session?.orgId ?? '';
  const query = useQuery({
    queryKey: queryKeys.requests.mine(userId, orgId, 'badge'),
    queryFn: () => loadPendingRequestCount(userId, orgId),
    enabled: userId !== '',
    staleTime: 0,
  });
  useRefreshOnFocus(query.refetch);
  return query.data ?? 0;
}
