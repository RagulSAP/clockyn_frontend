import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { staffApi } from '@/api';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { queryKeys } from '@/lib/query/queryKeys';
import type { StaffMember } from '@/types/api/staff';

import { useStaffScopeId } from './useStaffScope';

export interface ToggleStaffActive {
  /** Flip a person's active flag. Ignored while that person's previous request is still running. */
  toggle: (userId: string, active: boolean) => void;
  /** User ids with a request in flight (their switch is disabled — v1 allowed duplicate requests). */
  pendingIds: ReadonlySet<string>;
}

/**
 * Active / inactive toggle. Updates the cached roster immediately after the server confirms, then invalidates the
 * staff + dashboard queries so live lists and counters (and any open detail) refresh.
 */
export function useToggleStaffActive(): ToggleStaffActive {
  const scope = useStaffScopeId();
  const client = useQueryClient();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const mutation = useApiMutation(({ userId, active }: { userId: string; active: boolean }) => staffApi.setStaffActive(userId, active), {
    successMessage: (data) => data.message,
    errorMessage: 'Failed to update status',
    invalidate: [queryKeys.staff.all(scope), queryKeys.home.all(scope)],
    onSuccess: (_data, vars) => {
      client.setQueryData<StaffMember[]>(queryKeys.home.allStaff(scope), (old) =>
        old?.map((m) => (m.userId === vars.userId ? { ...m, isActive: vars.active } : m)),
      );
    },
    onSettled: (_d, _e, vars) => {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(vars.userId);
        return next;
      });
    },
  });

  const { mutate } = mutation;
  const toggle = useCallback(
    (userId: string, active: boolean) => {
      if (pending.has(userId)) return;
      setPending((prev) => new Set(prev).add(userId));
      mutate({ userId, active });
    },
    [mutate, pending],
  );

  return { toggle, pendingIds: pending };
}
