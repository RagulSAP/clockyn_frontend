import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { attendanceApi, homeApi, payrollApi, requestsApi, salaryReportsApi, shiftsApi, staffApi } from '@/api';
import { monthRange } from '@/lib/datetime';
import { PLAN_STALE_TIME_MS } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import type { AttendanceDay } from '@/types/api/attendance';

import { buildShiftHistory, mergeApprovedLeave, type ShiftHistoryEntry, type ShiftInfo } from '../utils/attendanceCalendar';

/**
 * One month of the employee's attendance with approved leave overlaid on days that have no record.
 * Unlike v1 a failed month request is an error (retry state), not an empty month where every past day reads Absent.
 * The leave overlay is best-effort: if only that request fails the attendance is still shown.
 */
export function useAttendanceMonth(userId: string, orgId: string, year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.attendance.month(userId, year, month),
    queryFn: async (): Promise<AttendanceDay[]> => {
      const { start, end } = monthRange(year, month);
      const [monthly, calendar] = await Promise.all([
        homeApi.getMonthlyAttendance(userId, orgId, month, year),
        requestsApi.getRequestCalendar(userId, orgId, start, end).catch(() => []),
      ]);
      return mergeApprovedLeave(monthly.days, calendar);
    },
    enabled: userId !== '' && orgId !== '',
  });
}

export interface ShiftContext {
  employeeName: string;
  current?: ShiftInfo;
  history: ShiftHistoryEntry[];
}

/** Employee name, current shift and the approved shift-change timeline (each source is optional). */
export function useShiftContext(userId: string, orgId: string): ShiftContext {
  const staff = useQuery({
    queryKey: queryKeys.home.employee(userId, orgId),
    queryFn: () => staffApi.getStaff(userId),
    enabled: userId !== '',
    staleTime: PLAN_STALE_TIME_MS,
  });
  const shifts = useQuery({
    queryKey: queryKeys.shifts.list(orgId),
    queryFn: () => shiftsApi.listShifts(orgId),
    enabled: orgId !== '',
    staleTime: PLAN_STALE_TIME_MS,
  });
  const requests = useQuery({
    queryKey: queryKeys.requests.mine(userId, orgId, 'shift_change'),
    queryFn: () => requestsApi.listEmployeeRequests(userId, orgId),
    enabled: userId !== '' && orgId !== '',
    staleTime: PLAN_STALE_TIME_MS,
  });
  return useMemo(() => {
    const all = shifts.data ?? [];
    const own = staff.data?.shiftId ? all.find((s) => s.id === staff.data?.shiftId) : undefined;
    return {
      employeeName: staff.data?.name ?? '',
      current: own ? { name: own.name, start: own.startTime, end: own.endTime } : undefined,
      history: buildShiftHistory(requests.data ?? [], all),
    };
  }, [staff.data, shifts.data, requests.data]);
}

/** Punch sessions (times + photos) of one day; disabled until a day is opened. */
export function useDaySessions(userId: string, date: string | null) {
  return useQuery({
    queryKey: queryKeys.attendance.sessions(userId, date ?? ''),
    queryFn: () => attendanceApi.getSessions(userId, date as string),
    enabled: userId !== '' && !!date,
    staleTime: 0,
    retry: false,
  });
}

/**
 * The employee's assigned payslip (null when none is assigned). The preview endpoint takes no month: it always
 * returns the current month, so the sheet shows the month/year the response carries.
 */
export function usePayslip(orgId: string, userId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.payroll.preview(orgId, userId, { self: 1 }),
    queryFn: async () => {
      const payslipId = await payrollApi.getAssignedPayslipId(orgId, userId);
      if (!payslipId) return null;
      return payrollApi.getPayslipPreview(orgId, userId, payslipId);
    },
    enabled: enabled && orgId !== '' && userId !== '',
    staleTime: 0,
  });
}

/** Bonus / advance records paid to the employee. */
export function useAdvances(orgId: string, userId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.salaryReports.advances(userId, { orgId, self: 1 }),
    queryFn: () => salaryReportsApi.listUserAdvances(userId, orgId),
    enabled: enabled && orgId !== '' && userId !== '',
    staleTime: 0,
  });
}
