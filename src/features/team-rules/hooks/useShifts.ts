import { useQuery } from '@tanstack/react-query';

import * as shiftsApi from '@/api/shifts';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';

/** Active shifts of the current organisation (times as `HH:mm`). */
export function useShiftList() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.shifts.list(orgId),
    queryFn: () => shiftsApi.listShifts(orgId),
    enabled: !!orgId,
  });
}

/** Staff on / available for a shift. Loaded only while the assign sheet is open, always fresh. */
export function useShiftAssignment(shiftId: number | null) {
  const orgId = useOrgId();
  const enabled = !!orgId && shiftId !== null;
  const assigned = useQuery({
    queryKey: queryKeys.shifts.assigned(orgId, shiftId),
    queryFn: () => shiftsApi.getAssignedStaff(orgId, shiftId as number),
    enabled,
    staleTime: 0,
    retry: false,
  });
  const unassigned = useQuery({
    queryKey: queryKeys.shifts.unassigned(orgId, shiftId),
    queryFn: () => shiftsApi.getUnassignedStaff(orgId, shiftId as number),
    enabled,
    staleTime: 0,
    retry: false,
  });
  return { assigned, unassigned };
}
