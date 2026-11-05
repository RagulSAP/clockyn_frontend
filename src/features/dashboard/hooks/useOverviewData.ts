import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { attendanceApi, authApi, homeApi } from '@/api';
import { parseDateParts } from '@/lib/datetime';
import { queryKeys } from '@/lib/query/queryKeys';
import type { StaffMember } from '@/types/api/staff';

import {
  buildPunchMaps,
  dedupeByUserId,
  resolveDaySessions,
  sortByName,
  statusBucketOf,
  type DaySession,
  type OverviewFilter,
  type PunchMaps,
} from '../utils/overviewLogic';

export type OverviewList = {
  rows: StaffMember[];
  maps: PunchMaps;
  loading: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Staff of one status bucket for a day (+ branch). `total` is served by the daily attendance report (all active
 * staff for THAT date and branch, which is what the Total count counts); the other buckets use the live-status
 * endpoints. The punch times for the right-hand column always come from the daily report; if that request
 * fails the list still shows (without times), as in v1.
 */
export function useOverviewList(orgId: string, date: string, branchId: string, filter: OverviewFilter): OverviewList {
  const bucket = statusBucketOf(filter);
  const daily = useQuery({
    queryKey: queryKeys.home.list(orgId, { kind: 'daily-attendance', date, branchId }),
    queryFn: () => homeApi.getDailyAttendance(orgId, date, { branchId }),
    enabled: orgId !== '',
  });
  const status = useQuery({
    queryKey: queryKeys.home.staffByStatus(orgId, bucket ?? 'total', { date, branchId }),
    queryFn: () => homeApi.getStaffByStatus(bucket ?? 'absent', orgId, { date, branchId }),
    enabled: orgId !== '' && bucket !== null,
  });

  const source: StaffMember[] | undefined = bucket === null ? daily.data : status.data;
  const rows = useMemo(() => (source ? sortByName(dedupeByUserId(source)) : []), [source]);
  const maps = useMemo(() => buildPunchMaps(daily.data ?? [], filter), [daily.data, filter]);
  const primary = bucket === null ? daily : status;

  return {
    rows,
    maps,
    loading: primary.isLoading,
    error: primary.error,
    refetch: () => void primary.refetch(),
  };
}

export type StaffDay = {
  loading: boolean;
  /** Both the monthly record and the sessions failed to load. */
  failed: boolean;
  totalHours: number | undefined;
  sessions: DaySession[];
  photoUrl: string | null;
  refetch: () => void;
};

/**
 * One staff member's attendance on one date: sessions (times + photos) with a fallback to the monthly record,
 * total hours and the profile photo (only fetched when the list row had none).
 */
export function useStaffDay(orgId: string, staffId: string, date: string, listPhotoUrl: string | undefined): StaffDay {
  const parts = parseDateParts(date);
  const month = parts?.month ?? 1;
  const year = parts?.year ?? 1970;
  const enabled = orgId !== '' && staffId !== '' && parts !== null;

  const monthly = useQuery({
    queryKey: queryKeys.home.list(orgId, { kind: 'staff-month', staffId, year, month }),
    queryFn: () => homeApi.getMonthlyAttendance(staffId, orgId, month, year),
    enabled,
  });
  const sessions = useQuery({
    queryKey: queryKeys.home.list(orgId, { kind: 'staff-sessions', staffId, date }),
    queryFn: () => attendanceApi.getSessions(staffId, date),
    enabled,
    retry: false,
  });
  const photo = useQuery({
    queryKey: queryKeys.company.employeePhoto(staffId),
    queryFn: () => authApi.getEmployeePhotoUrl(staffId),
    enabled: enabled && !listPhotoUrl,
    retry: false,
  });

  const day = monthly.data?.days.find((d) => d.date === date) ?? null;
  const resolved = useMemo(() => resolveDaySessions(sessions.data, day), [sessions.data, day]);

  return {
    loading: monthly.isLoading || sessions.isLoading,
    failed: monthly.isError && sessions.isError,
    totalHours: day?.totalHours,
    sessions: resolved,
    photoUrl: listPhotoUrl || photo.data || null,
    refetch: () => {
      void monthly.refetch();
      void sessions.refetch();
    },
  };
}
