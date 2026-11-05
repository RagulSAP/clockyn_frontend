import { useQuery } from '@tanstack/react-query';

import * as branchesApi from '@/api/branches';
import * as companyApi from '@/api/company';
import * as departmentsApi from '@/api/departments';
import { queryKeys } from '@/lib/query/queryKeys';

/** Full company profile (contact, legal ids, logo). `orgId` is the company being viewed / edited. */
export function useCompanyDetails(orgId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.company.details(orgId),
    queryFn: () => companyApi.getCompanyDetails(orgId),
    enabled: enabled && !!orgId,
  });
}

/** Companies owned by the admin (drives the "Delete only when more than one company" rule). */
export function useCompanyList(userId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.company.list(userId),
    queryFn: () => companyApi.listCompanies(userId),
    enabled: enabled && !!userId,
  });
}

/** Branches of a company (only the count / names are used on these screens). */
export function useCompanyBranches(orgId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.branches.list(orgId, { source: 'company' }),
    queryFn: () => branchesApi.listBranches(orgId),
    enabled: enabled && !!orgId,
  });
}

/** Departments of a company. */
export function useCompanyDepartments(orgId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.departments.list(orgId, { source: 'company' }),
    queryFn: () => departmentsApi.listDepartments(orgId),
    enabled: enabled && !!orgId,
  });
}
