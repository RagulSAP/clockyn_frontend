import { useCallback, useMemo, useState } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';

import { requestsApi, shiftsApi } from '@/api';
import { currentMonthIST } from '@/lib/datetime';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useSession } from '@/store/auth';
import type { RequestCalendarDay, StaffRequest } from '@/types/api/requests';
import type { Shift } from '@/types/api/shifts';

import { buildStatusMap, calendarMonthKey, calendarRange, countPendingByType, type CalendarKind, type PendingByType } from '../utils/requestRules';

/** The employee's own requests (all types, newest first). Keyed per user + org. */
export function myRequestsOptions(userId: string, orgId: string) {
  return queryOptions({
    queryKey: queryKeys.requests.mine(userId, orgId),
    queryFn: (): Promise<StaffRequest[]> => requestsApi.listEmployeeRequests(userId, orgId),
  });
}

/** Calendar days of one kind for an IST month; one cache entry per month (v1 kept only the last month). */
export function requestCalendarOptions(userId: string, orgId: string, kind: CalendarKind, year: number, month: number) {
  const { start, end } = calendarRange(year, month);
  return queryOptions({
    queryKey: queryKeys.requests.calendar(userId, orgId, kind, calendarMonthKey(year, month)),
    queryFn: async (): Promise<RequestCalendarDay[]> => {
      const days = await requestsApi.getRequestCalendar(userId, orgId, start, end);
      return days.filter((d) => d.type === kind);
    },
  });
}

export function orgShiftsOptions(orgId: string) {
  return queryOptions({
    queryKey: queryKeys.shifts.list(orgId),
    queryFn: (): Promise<Shift[]> => shiftsApi.listShifts(orgId),
  });
}

export function useMyRequests() {
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = useOrgId();
  return useQuery({ ...myRequestsOptions(userId, orgId), enabled: userId !== '' });
}

/** Pending counters for the hub cards. */
export function usePendingByType(): { counts: PendingByType; query: ReturnType<typeof useMyRequests> } {
  const query = useMyRequests();
  const counts = useMemo(() => countPendingByType(query.data ?? []), [query.data]);
  return { counts, query };
}

export function useOrgShifts() {
  const orgId = useOrgId();
  return useQuery({ ...orgShiftsOptions(orgId), enabled: orgId !== '' });
}

/** Displayed month (IST) + the existing-request statuses of that month. */
export function useRequestCalendarMonth(kind: CalendarKind) {
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = useOrgId();
  const [ym, setYm] = useState(() => currentMonthIST());
  const query = useQuery({ ...requestCalendarOptions(userId, orgId, kind, ym.year, ym.month), enabled: userId !== '' });
  const statuses = useMemo(() => buildStatusMap(query.data ?? [], kind), [query.data, kind]);
  return {
    year: ym.year,
    month: ym.month,
    setMonth: setYm,
    statuses,
    /** First load of the month, or a refresh (month change / after submit) - the card shows a spinner overlay. */
    loading: query.isFetching,
    /** No data yet for this month: picking is blocked so a date that is already requested cannot be chosen. */
    unresolved: query.isPending,
    error: query.isError,
    refetch: query.refetch,
  };
}

/**
 * After a successful submit, shows the submitted dates as Pending in the cached months right away
 * (the invalidation then confirms them from the server). Months that are not cached are left alone.
 */
export function useMarkRequested(kind: CalendarKind) {
  const queryClient = useQueryClient();
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = useOrgId();
  return useCallback(
    (dates: readonly string[]) => {
      const byMonth = new Map<string, string[]>();
      for (const d of dates) {
        const key = d.slice(0, 7);
        byMonth.set(key, [...(byMonth.get(key) ?? []), d]);
      }
      for (const [key, monthDates] of byMonth) {
        queryClient.setQueryData<RequestCalendarDay[]>(queryKeys.requests.calendar(userId, orgId, kind, key), (old) =>
          old ? [...old.filter((d) => !monthDates.includes(d.date)), ...monthDates.map((date) => ({ date, status: 'pending' as const, type: kind }))] : old,
        );
      }
    },
    [kind, orgId, queryClient, userId],
  );
}
