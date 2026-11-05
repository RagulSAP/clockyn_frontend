import { useQuery } from '@tanstack/react-query';

import * as managersApi from '@/api/managers';
import * as staffApi from '@/api/staff';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';

/** Managers of the current organisation with their (branch, department) assignments. */
export function useManagers() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.managers.list(orgId),
    queryFn: () => managersApi.listManagers(orgId),
    enabled: !!orgId,
  });
}

/** Staff under a manager (loaded only while the sheet is open; always fresh). */
export function useStaffUnderManager(managerId: string | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.managers.staffUnder(orgId, managerId),
    queryFn: () => managersApi.getStaffUnderManager(managerId as string),
    enabled: !!orgId && !!managerId,
    staleTime: 0,
  });
}

/** Permission map of a manager (loaded only while the sheet is open; always fresh, never cached across opens). */
export function useManagerPermissionMap(managerId: string | null) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.managers.permissions(orgId, managerId),
    queryFn: () => managersApi.getManagerPermissions(managerId as string),
    enabled: !!orgId && !!managerId,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Active role-3 staff that can be promoted, filtered by branch / department ('' = all). */
export function usePromotableStaff(branchId: string, deptId: string) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: [...queryKeys.managers.promotable(orgId), branchId, deptId] as const,
    queryFn: () => managersApi.getPromotableStaff(orgId, branchId || null, deptId),
    enabled: !!orgId,
  });
}

/** Branch choices for the manager forms (admin view, role 1). */
export function useBranchChoices() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: ['managers', orgId, 'options', 'branches'] as const,
    queryFn: () => staffApi.getBranchOptions(orgId, 1),
    enabled: !!orgId,
  });
}

/** Department choices for the manager forms (admin view, role 1). */
export function useDepartmentChoices() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: ['managers', orgId, 'options', 'departments'] as const,
    queryFn: () => staffApi.getDepartmentOptions(orgId, 1),
    enabled: !!orgId,
  });
}
