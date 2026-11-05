import { useQuery } from '@tanstack/react-query';

import { listBranches } from '@/api/branches';
import { listDepartments } from '@/api/departments';
import { listStaffForPicker } from '@/api/staff';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';

/**
 * Branches, departments and the (server-filtered) employee list of the assign view.
 * `branchId` / `deptId` of '' mean "All". Everything is scoped to the organisation.
 */
export function useAssignOptions(enabled: boolean, branchId: string, deptId: string) {
  const orgId = useOrgId();
  const on = enabled && orgId !== '';
  const branches = useQuery({ queryKey: queryKeys.home.branches(orgId), queryFn: () => listBranches(orgId), enabled: on });
  const departments = useQuery({ queryKey: queryKeys.home.departments(orgId), queryFn: () => listDepartments(orgId), enabled: on });
  const employees = useQuery({
    queryKey: queryKeys.staff.picker(orgId, { branchId, deptId, for: 'leads' }),
    queryFn: () => listStaffForPicker(orgId, { branchId, deptId }),
    enabled: on,
  });
  return { branches, departments, employees };
}
