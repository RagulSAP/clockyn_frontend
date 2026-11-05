import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { attendanceApi, authApi, companyApi, faceApi, shiftsApi, staffApi } from '@/api';
import { useRefreshOnFocus } from '@/hooks';
import { PLAN_STALE_TIME_MS } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';
import type { TodayAttendance } from '@/types/api/attendance';

import type { ShiftInfo } from '../utils/attendanceCalendar';
import { warmFace } from '../utils/warmFace';

/** v1 polled today's attendance every 10 s so admin edits show up without any action. */
export const ATTENDANCE_POLL_MS = 10_000;

const EMPTY_TODAY: TodayAttendance = { isPunchedIn: false, sessions: [], punchCount: 0, totalWorkHours: 0 };

export interface EmployeeHomeData {
  userId: string;
  orgId: string;
  roleId: 1 | 2 | 3 | null;
  username: string;
  companyName: string;
  logoUrl?: string;
  /** `GET /face/check` result; `false` while unknown (see `faceStatusKnown`). */
  isFaceRegistered: boolean;
  faceStatusKnown: boolean;
  /** Re-checks the face status; `undefined` when it could not be determined. */
  refetchFace: () => Promise<boolean | undefined>;
  /** Read from the FRESHLY fetched staff record (v1 only trusted a cache that never held it). */
  isFieldStaff: boolean;
  shift?: ShiftInfo;
  shiftLoading: boolean;
  today: TodayAttendance;
  /** First today-attendance response arrived. */
  attendanceLoaded: boolean;
  refetchToday: () => Promise<TodayAttendance | undefined>;
  refreshAll: () => Promise<void>;
  /** Per-org max daily punch sessions from company settings. */
  maxSessionsPerDay?: number;
}

/** Everything the employee home needs: identity, logo, face status, shift, field-staff flag and today's punches (10 s poll). */
export function useEmployeeHome(): EmployeeHomeData {
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = session?.orgId ?? '';

  const logo = useQuery({
    queryKey: queryKeys.company.logo(orgId),
    queryFn: () => authApi.getOrgLogoUrl(orgId),
    enabled: orgId !== '',
    staleTime: PLAN_STALE_TIME_MS,
  });
  const companyDetails = useQuery({
    queryKey: queryKeys.company.details(orgId),
    queryFn: () => companyApi.getCompanyDetails(orgId),
    enabled: orgId !== '',
    staleTime: PLAN_STALE_TIME_MS,
  });
  const face = useQuery({
    queryKey: queryKeys.face.registered(userId),
    queryFn: () => faceApi.isFaceRegistered(userId),
    enabled: userId !== '',
    staleTime: PLAN_STALE_TIME_MS,
  });
  const staff = useQuery({
    queryKey: queryKeys.home.employee(userId, orgId),
    queryFn: () => staffApi.getStaff(userId),
    enabled: userId !== '',
    staleTime: PLAN_STALE_TIME_MS,
  });
  const shiftId = staff.data?.shiftId ?? 0;
  const shiftQuery = useQuery({
    queryKey: queryKeys.shifts.detail(orgId, shiftId),
    queryFn: () => shiftsApi.getShift(shiftId, orgId),
    enabled: orgId !== '' && shiftId > 0,
    staleTime: PLAN_STALE_TIME_MS,
  });
  const todayQuery = useQuery({
    queryKey: queryKeys.attendance.today(userId),
    queryFn: () => attendanceApi.getToday(userId),
    enabled: userId !== '',
    staleTime: 0,
    refetchInterval: ATTENDANCE_POLL_MS,
    refetchIntervalInBackground: false,
  });
  useRefreshOnFocus(todayQuery.refetch);

  const shift = useMemo<ShiftInfo | undefined>(() => {
    const s = shiftQuery.data;
    return s && s.startTime && s.endTime ? { name: s.name, start: s.startTime, end: s.endTime } : undefined;
  }, [shiftQuery.data]);

  const faceRegistered = face.data === true;
  useEffect(() => {
    if (faceRegistered) warmFace(userId);
  }, [faceRegistered, userId]);

  const { refetch: refetchFaceQuery } = face;
  const { refetch: refetchTodayQuery } = todayQuery;
  const { refetch: refetchLogo } = logo;
  const { refetch: refetchStaff } = staff;
  const { refetch: refetchShift } = shiftQuery;
  const { refetch: refetchCompanyDetails } = companyDetails;

  return {
    userId,
    orgId,
    roleId: session?.roleId ?? null,
    username: staff.data?.name || session?.name || 'User',
    companyName: session?.orgName || 'Company Name',
    logoUrl: logo.data ?? undefined,
    isFaceRegistered: face.data === true,
    faceStatusKnown: face.data !== undefined,
    refetchFace: async () => {
      const r = await refetchFaceQuery();
      return r.data === undefined ? undefined : r.data === true;
    },
    isFieldStaff: staff.data?.isFieldStaff === true,
    shift,
    shiftLoading: shiftQuery.isLoading,
    today: todayQuery.data ?? EMPTY_TODAY,
    attendanceLoaded: todayQuery.data !== undefined,
    refetchToday: async () => (await refetchTodayQuery()).data,
    refreshAll: async () => {
      await Promise.allSettled([refetchTodayQuery(), refetchFaceQuery(), refetchLogo(), refetchStaff(), refetchCompanyDetails(), shiftId > 0 ? refetchShift() : Promise.resolve()]);
    },
    maxSessionsPerDay: companyDetails.data?.maxSessionsPerDay,
  };
}
