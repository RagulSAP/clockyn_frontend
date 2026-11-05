/** Write actions of the staff detail screen. Every one toasts failures and invalidates what it changed. */
import { homeApi, salaryReportsApi, staffApi } from '@/api';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { queryKeys } from '@/lib/query/queryKeys';
import { getSession } from '@/store/auth';
import type { AttendanceEditInput } from '@/types/api/attendance';

import { directoryKeys } from './keys';
import { useStaffScopeId } from './useStaffScope';

/** Staff + dashboard caches that a roster change (delete / deactivate / profile edit) must refresh. */
function rosterKeys(scope: string) {
  return [queryKeys.staff.all(scope), queryKeys.home.all(scope)] as const;
}

/**
 * Same as `rosterKeys` but WITHOUT the directory namespace of the person that just left the roster (deleted /
 * deactivated): their open detail screen is about to close, and refetching their detail / attendance only produces
 * 404s (and a flash of the error state) while navigating back.
 */
function rosterKeysExceptDirectory(scope: string) {
  const staffPrefix = queryKeys.staff.all(scope);
  const others = ['list', 'detail', 'profile', 'picker', 'count', 'next-employee-id', 'options', 'edit-record', 'personal'].map((k) => [...staffPrefix, k] as const);
  return [...others, queryKeys.home.all(scope)] as const;
}

/** Edit a day's punch times (success refreshes that staff's attendance and the dashboard counters). */
export function useEditPunch(staffId: string, onDone: () => void) {
  const scope = useStaffScopeId();
  return useApiMutation((input: Omit<AttendanceEditInput, 'staffId' | 'orgId'>) => homeApi.updateAttendancePunch({ ...input, staffId, orgId: scope }), {
    successMessage: 'Attendance updated successfully',
    errorMessage: 'Failed to update attendance',
    invalidate: [directoryKeys.staff(scope, staffId), queryKeys.home.all(scope), queryKeys.attendance.all(staffId)],
    onSuccess: onDone,
  });
}

/** Record an advance (admin) — refreshes the history and the salary reports. */
export function useCreateAdvance(staffId: string, onDone: () => void) {
  const scope = useStaffScopeId();
  return useApiMutation(
    (input: { amount: number; date: string }) =>
      salaryReportsApi.createAdvance({ orgId: scope, userId: staffId, createdBy: getSession()?.userId ?? '', amount: input.amount, date: input.date }),
    {
      errorMessage: 'Failed to save advance',
      invalidate: [directoryKeys.advances(scope, staffId), queryKeys.salaryReports.all(scope)],
      onSuccess: onDone,
    },
  );
}

/** Permanently delete a staff member (role 1 only). Hosts refresh through the staff / home invalidation. */
export function usePermanentDelete(staffId: string, onDone: () => void) {
  const scope = useStaffScopeId();
  return useApiMutation((roleId: number) => staffApi.permanentlyDeleteStaff(staffId, roleId), {
    successMessage: (data) => data.message || 'Staff member permanently deleted',
    errorMessage: 'Failed to delete staff member',
    invalidate: rosterKeysExceptDirectory(scope),
    onSuccess: onDone,
  });
}

/** Activate / deactivate from the detail screen. */
export function useSetActive(staffId: string, onDone: (active: boolean) => void) {
  const scope = useStaffScopeId();
  return useApiMutation((active: boolean) => staffApi.setStaffActive(staffId, active).then((r) => ({ ...r, active })), {
    successMessage: (data) => data.message,
    errorMessage: 'Failed to update status',
    // Deactivating closes the detail screen (see the host): do not refetch the person who just left the roster.
    invalidate: (data) => (data.active ? rosterKeys(scope) : rosterKeysExceptDirectory(scope)),
    onSuccess: (data) => onDone(data.active),
  });
}
