/** Smaller data hooks of the detail screen: punch pins, day sessions and advance history. */
import { useQuery } from '@tanstack/react-query';

import { attendanceApi, locationApi, salaryReportsApi } from '@/api';
import { getErrorMessage } from '@/lib/api/errors';
import type { PunchSession } from '@/types/api/attendance';
import type { Advance } from '@/types/api/salaryReports';
import type { PunchPin } from '@/types/api/location';

import { directoryKeys } from './keys';
import { useStaffScopeId } from './useStaffScope';

export interface PunchPins {
  /** This staff member's pin for the date (`undefined` when none). */
  pin: PunchPin | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  refetch: () => void;
}

/**
 * Where the staff member punched in / out on `date`. The request uses the SAME scope as the rest of the screen (v1
 * used the logged-in user's own org id, wrong for managers). The endpoint returns every staff member's pins for the
 * day; there is no per-staff variant, so the match is made here.
 */
export function usePunchPins(staffId: string, date: string | null): PunchPins {
  const scope = useStaffScopeId();
  const q = useQuery({
    queryKey: directoryKeys.punchPins(scope, staffId, date ?? ''),
    queryFn: async () => (await locationApi.listPunchPins(scope, date ?? undefined)).find((p) => p.userId === staffId) ?? null,
    enabled: !!scope && !!staffId && !!date,
  });
  return {
    pin: q.data ?? undefined,
    isLoading: q.isLoading,
    isError: q.isError,
    errorMessage: q.isError ? getErrorMessage(q.error, 'Failed to load punch locations') : '',
    refetch: () => void q.refetch(),
  };
}

export interface DaySessions {
  sessions: PunchSession[];
  isLoading: boolean;
}

/** Punch sessions (times + photos) of one day; failures fall back to the attendance row (v1). */
export function useDaySessions(staffId: string, date: string | null): DaySessions {
  const scope = useStaffScopeId();
  const q = useQuery({
    queryKey: directoryKeys.sessions(scope, staffId, date ?? ''),
    queryFn: () => attendanceApi.getSessions(staffId, date ?? ''),
    enabled: !!scope && !!staffId && !!date,
    retry: false,
  });
  return { sessions: q.data ?? [], isLoading: q.isLoading };
}

export interface AdvanceHistory {
  advances: Advance[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  refetch: () => void;
}

/** Advance salary records of the staff member (loaded when the Advance tab is opened). */
export function useAdvanceHistory(staffId: string, enabled: boolean): AdvanceHistory {
  const scope = useStaffScopeId();
  const q = useQuery({
    queryKey: directoryKeys.advances(scope, staffId),
    queryFn: () => salaryReportsApi.listUserAdvances(staffId, scope),
    enabled: enabled && !!scope && !!staffId,
  });
  return {
    advances: q.data ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    errorMessage: q.isError ? getErrorMessage(q.error, 'Failed to load advances') : '',
    refetch: () => void q.refetch(),
  };
}
