import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { homeApi } from '@/api';
import { isValidDateStr, todayIST } from '@/lib/datetime';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';
import type { StaffMember } from '@/types/api/staff';

import { filterRoster, liveStatusFor, mergeRoleInfo, normalizeRosterFilter, type RosterFilter } from '../utils/rosterFilters';
import { useStaffScopeId } from './useStaffScope';

export interface RosterParams {
  filter?: string;
  branchId?: string;
  date?: string;
  deptId?: string;
}

export interface StaffRoster {
  filter: RosterFilter;
  date: string;
  /** Roster rows after the branch / department scope of the route (still before chip + search). */
  members: StaffMember[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  isRefetching: boolean;
  /** No organisation id is available (signed out): nothing can load. */
  scopeMissing: boolean;
  refetch: () => Promise<void>;
}

const cleanId = (v: string | undefined): string => {
  const t = (v ?? '').trim();
  return t === '0' ? '' : t;
};

/**
 * Roster data for the staff directory.
 *  - `total`: the full roster (`/home/all-staff`).
 *  - live filters: the matching live-status list for `date` (+ `branchId` on the server), enriched with role / active /
 *    photo from the full roster so the Staff / Manager / Inactive chips work on tile-driven views.
 *  - `deptId` (department tiles) and, for the full roster, `branchId` narrow the rows client-side — a department with
 *    no matching staff yields an EMPTY list (v1 fell back to listing everyone).
 */
export function useStaffRoster(params: RosterParams): StaffRoster {
  const scope = useStaffScopeId();
  const orgId = useOrgId();
  const filter = normalizeRosterFilter(params.filter);
  const live = liveStatusFor(filter);
  const date = params.date && isValidDateStr(params.date) ? params.date : todayIST();
  const branchId = cleanId(params.branchId);
  const deptId = cleanId(params.deptId);
  const needBranchName = !live && !!branchId;

  const all = useQuery({
    queryKey: queryKeys.home.allStaff(scope),
    queryFn: () => homeApi.getAllStaff(scope),
    enabled: !!scope,
  });
  const liveQuery = useQuery({
    queryKey: queryKeys.home.staffByStatus(scope, live ?? 'none', { date, branchId }),
    queryFn: () => homeApi.getStaffByStatus(live ?? 'absent', scope, { date, branchId }),
    enabled: !!scope && !!live,
  });
  const departments = useQuery({
    queryKey: queryKeys.home.departments(orgId),
    queryFn: () => homeApi.getDepartments(orgId),
    enabled: !!orgId && !!deptId,
  });
  const branches = useQuery({
    queryKey: queryKeys.home.branches(orgId),
    queryFn: () => homeApi.getBranches(orgId),
    enabled: !!orgId && needBranchName,
  });

  const primary = live ? liveQuery : all;
  const deptName = deptId ? departments.data?.find((d) => d.id === deptId)?.name : undefined;
  const branchName = needBranchName ? branches.data?.find((b) => b.id === branchId)?.name : undefined;
  const deptMissing = !!deptId && departments.isSuccess && deptName === undefined;
  const branchMissing = needBranchName && branches.isSuccess && branchName === undefined;

  const liveData = liveQuery.data;
  const allData = all.data;
  const members = useMemo<StaffMember[]>(() => {
    if (deptMissing || branchMissing) return [];
    const base = live ? mergeRoleInfo(liveData ?? [], allData) : (allData ?? []);
    return filterRoster(base, { role: 'all', search: '', deptName: deptName, branchName: branchName });
  }, [live, liveData, allData, deptName, branchName, deptMissing, branchMissing]);

  const resolving = (!!deptId && departments.isLoading) || (needBranchName && branches.isLoading);
  const lookupError = (!!deptId && departments.isError) || (needBranchName && branches.isError);
  const isError = primary.isError || lookupError;
  const failed = primary.isError ? primary.error : departments.isError ? departments.error : branches.error;

  const primaryRefetch = primary.refetch;
  const allRefetch = all.refetch;
  const deptRefetch = departments.refetch;
  const branchRefetch = branches.refetch;
  const refetch = useCallback(async () => {
    const jobs: Promise<unknown>[] = [primaryRefetch()];
    if (live) jobs.push(allRefetch());
    if (deptId) jobs.push(deptRefetch());
    if (needBranchName) jobs.push(branchRefetch());
    await Promise.allSettled(jobs);
  }, [primaryRefetch, allRefetch, deptRefetch, branchRefetch, live, deptId, needBranchName]);

  return {
    filter,
    date,
    members,
    isLoading: !!scope && (primary.isLoading || resolving),
    isError,
    errorMessage: isError ? getErrorMessage(failed, 'Failed to load staff') : '',
    isRefetching: primary.isRefetching,
    scopeMissing: !scope,
    refetch,
  };
}
