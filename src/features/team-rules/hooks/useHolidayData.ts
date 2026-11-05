import { useQuery } from '@tanstack/react-query';

import * as staffApi from '@/api/staff';
import * as systemApi from '@/api/system';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useRole } from '@/store/auth';

/** Holidays of one month (year, month 1-12). */
export function useHolidays(year: number, month: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.holidays.month(orgId, year, month),
    queryFn: () => systemApi.listHolidays(orgId, year, month),
    enabled: !!orgId,
  });
}

/** Weekly off days (Monday = 0 ... Sunday = 6); the API defaults to Sunday when none were saved. */
export function useWeeklyOffs() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.holidays.offDays(orgId),
    queryFn: () => systemApi.getWeeklyOffs(orgId),
    enabled: !!orgId,
  });
}

/** Branch / department NAMES used to scope a holiday (the backend stores the scope by name). */
export function useScopeNames() {
  const orgId = useOrgId();
  const role = useRole() ?? 1;
  const branches = useQuery({
    queryKey: queryKeys.holidays.scopeOptions(orgId, 'branches'),
    queryFn: async () => (await staffApi.getBranchOptions(orgId, role)).map((b) => b.name).filter(Boolean),
    enabled: !!orgId,
  });
  const departments = useQuery({
    queryKey: queryKeys.holidays.scopeOptions(orgId, 'departments'),
    queryFn: async () => (await staffApi.getDepartmentOptions(orgId, role)).map((d) => d.name).filter(Boolean),
    enabled: !!orgId,
  });
  return { branches, departments };
}
