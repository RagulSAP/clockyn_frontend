import { useQuery } from '@tanstack/react-query';

import { branchesApi, departmentsApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';

/** Branches visible to the viewer (`scopeId` = org for admins, the manager's own user id for managers). */
export function useBranchList(scopeId: string) {
  return useQuery({
    queryKey: queryKeys.branches.list(scopeId),
    queryFn: () => branchesApi.listBranches(scopeId),
    enabled: scopeId !== '',
  });
}

/** Departments of the organisation (admin only; never manager-scoped by the server). */
export function useDepartmentList(orgId: string) {
  return useQuery({
    queryKey: queryKeys.departments.list(orgId),
    queryFn: () => departmentsApi.listDepartments(orgId),
    enabled: orgId !== '',
  });
}
