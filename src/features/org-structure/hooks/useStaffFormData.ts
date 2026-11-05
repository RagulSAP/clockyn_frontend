/** Read side of the staff form: option lists (loaded once, cached), staff-limit info, and the edit-mode record. */
import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { authApi, plansApi, staffApi } from '@/api';
import { useToast } from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks';
import { queryKeys } from '@/lib/query/queryKeys';

import { parseStaffLimit, type StaffLimitInfo } from '../utils/staffForm';

/**
 * Branch / department / shift choices. Cached by react-query, so they load ONCE per form (v1 reloaded them on every
 * focus, which also overwrote a typed employee id). Shifts are refetched when the screen regains focus (the user may
 * have just created one in Shift Settings).
 */
export function useStaffOptions(scopeId: string, roleId: number) {
  const toast = useToast();
  const enabled = scopeId !== '' && roleId !== 0;

  const branches = useQuery({
    queryKey: queryKeys.staff.options(scopeId, 'branches'),
    queryFn: () => staffApi.getBranchOptions(scopeId, roleId),
    enabled,
  });
  const departments = useQuery({
    queryKey: queryKeys.staff.options(scopeId, 'departments'),
    queryFn: () => staffApi.getDepartmentOptions(scopeId, roleId),
    enabled,
  });
  const shifts = useQuery({
    queryKey: queryKeys.shifts.list(scopeId),
    queryFn: () => staffApi.getShiftOptions(scopeId),
    enabled,
  });

  useRefreshOnFocus(shifts.refetch);

  const failed = branches.isError || departments.isError;
  const toasted = useRef(false);
  useEffect(() => {
    if (failed && !toasted.current) {
      toasted.current = true;
      toast.error('Failed to load form options');
    }
    if (!failed) toasted.current = false;
  }, [failed, toast]);

  const loading = enabled && (branches.isLoading || departments.isLoading || shifts.isLoading);
  const retry = () => {
    void branches.refetch();
    void departments.refetch();
    void shifts.refetch();
  };

  return {
    branches: branches.data ?? [],
    departments: departments.data ?? [],
    shifts: shifts.data ?? [],
    loading,
    failed,
    retry,
  };
}

/**
 * "Staff: X / Y" banner data (Add mode only). Resolves `null` (no banner, no gating) while loading, on any failure,
 * or when the plan reports no limit — like v1. Re-read when the screen regains focus.
 */
export function useStaffLimit(orgId: string, enabled: boolean): StaffLimitInfo | null {
  const on = enabled && orgId !== '';
  const q = useQuery({
    queryKey: [...queryKeys.staff.count(orgId), 'limit-info'] as const,
    queryFn: async (): Promise<StaffLimitInfo | null> => {
      const [subscription, current] = await Promise.all([plansApi.getSubscription(orgId), staffApi.getActiveStaffCount(orgId)]);
      const limit = parseStaffLimit(subscription.raw);
      return limit > 0 ? { current, limit } : null;
    },
    enabled: on,
    retry: false,
  });
  useRefreshOnFocus(q.refetch);
  return on ? (q.data ?? null) : null;
}

/** Edit mode: the editable record + the current profile photo (a failed photo lookup is not an error). */
export function useStaffRecord(scopeId: string, staffId: string | undefined) {
  const on = !!staffId && scopeId !== '';
  const record = useQuery({
    queryKey: [...queryKeys.staff.all(scopeId), 'edit-record', staffId ?? ''] as const,
    queryFn: () => staffApi.getStaff(staffId ?? ''),
    enabled: on,
    staleTime: 0,
    gcTime: 0,
  });
  const photo = useQuery({
    queryKey: queryKeys.company.employeePhoto(staffId),
    queryFn: async () => {
      try {
        return await authApi.getEmployeePhotoUrl(staffId ?? '');
      } catch {
        return null;
      }
    },
    enabled: on,
    staleTime: 0,
    gcTime: 0,
  });
  return useMemo(
    () => ({
      record: record.data,
      photoUrl: photo.data ?? null,
      /** Both lookups have settled for THIS mount (never hydrate the form from a stale cache entry). */
      ready: on && record.isFetchedAfterMount && !record.isFetching && photo.isFetchedAfterMount && !photo.isFetching,
      error: record.isError,
      loading: on && !record.isError && !(record.isFetchedAfterMount && photo.isFetchedAfterMount),
      refetch: () => {
        void record.refetch();
        void photo.refetch();
      },
    }),
    [on, record, photo],
  );
}
