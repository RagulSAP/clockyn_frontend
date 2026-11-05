import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { homeApi, requestsApi } from '@/api';
import { monthRange, todayIST } from '@/lib/datetime';
import { getErrorMessage } from '@/lib/api/errors';
import type { AttendanceDay } from '@/types/api/attendance';

import { buildMonthDays, type DayCell } from '../utils/attendanceDerive';
import { directoryKeys } from './keys';
import { useStaffScopeId } from './useStaffScope';

export interface MonthAttendance {
  records: AttendanceDay[];
  /** Classified days of the month (empty until the attendance has loaded). */
  cells: DayCell[];
  isLoading: boolean;
  isRefetching: boolean;
  /** Attendance request failed: the screen shows an error + retry instead of an all-absent month (v1 masked errors). */
  isError: boolean;
  errorMessage: string;
  /** Approved leaves could not be merged (the attendance itself loaded). */
  leavesFailed: boolean;
  refetch: () => Promise<void>;
}

/**
 * One month of a staff member's attendance, merged with the staff's approved leaves. The query key carries the staff,
 * org scope, year and month — returning to a month always shows that month's data (v1 kept the previous month's rows
 * under the current month's grid).
 */
export function useMonthAttendance(staffId: string, year: number, month: number): MonthAttendance {
  const scope = useStaffScopeId();
  const enabled = !!scope && !!staffId;

  const attendance = useQuery({
    queryKey: directoryKeys.attendance(scope, staffId, year, month),
    queryFn: () => homeApi.getMonthlyAttendance(staffId, scope, month, year),
    enabled,
  });

  const leaves = useQuery({
    queryKey: directoryKeys.leaves(scope, staffId, year, month),
    queryFn: async () => {
      const { start, end } = monthRange(year, month);
      const days = await requestsApi.getRequestCalendar(staffId, scope, start, end);
      return days.filter((d) => d.type === 'leave' && d.status === 'approved').map((d) => d.date);
    },
    enabled,
    retry: false,
  });

  const records = attendance.data?.days;
  const leaveList = leaves.data;
  const cells = useMemo<DayCell[]>(
    () => (records ? buildMonthDays(year, month, records, new Set(leaveList ?? []), todayIST()) : []),
    [records, leaveList, year, month],
  );

  const refetchAttendance = attendance.refetch;
  const refetchLeaves = leaves.refetch;
  const refetch = useCallback(async () => {
    await Promise.allSettled([refetchAttendance(), refetchLeaves()]);
  }, [refetchAttendance, refetchLeaves]);

  return {
    records: records ?? [],
    cells,
    isLoading: enabled && attendance.isLoading,
    isRefetching: attendance.isRefetching,
    isError: attendance.isError,
    errorMessage: attendance.isError ? getErrorMessage(attendance.error, 'Failed to load attendance data') : '',
    leavesFailed: leaves.isError,
    refetch,
  };
}
