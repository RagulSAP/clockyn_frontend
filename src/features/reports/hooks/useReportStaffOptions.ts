/** Staff the attendance PDF screen can pick: admin → all org staff; manager → the manager (as "(Me)") + the team. */
import { useQuery } from '@tanstack/react-query';
import { getAllStaff } from '@/api/home';
import { getStaffUnderManager } from '@/api/managers';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useRole, useSession } from '@/store/auth';
import type { ReportStaffOption } from '../types';

/** First entry per user id wins (the picker de-duplicates like v1). */
export function dedupeOptions(options: readonly ReportStaffOption[]): ReportStaffOption[] {
  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.userId) ? false : (seen.add(o.userId), true)));
}

/** Case-insensitive substring match on name or employee id. */
export function filterOptions(options: readonly ReportStaffOption[], query: string): ReportStaffOption[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...options];
  return options.filter((o) => o.name.toLowerCase().includes(q) || o.empId.toLowerCase().includes(q));
}

export function useReportStaffOptions() {
  const orgId = useOrgId();
  const role = useRole();
  const session = useSession();
  const isManager = role === 2;
  const managerId = session?.userId ?? '';
  const managerName = session?.name?.trim();

  const query = useQuery({
    queryKey: queryKeys.reports.run(orgId, 'staff-options', { manager: isManager ? managerId : '' }),
    enabled: orgId !== '' && (!isManager || managerId !== ''),
    queryFn: async (): Promise<ReportStaffOption[]> => {
      if (!isManager) {
        const staff = await getAllStaff(orgId);
        return dedupeOptions(
          staff.map((s) => ({ userId: s.userId, name: s.name, empId: s.empId, department: s.department, isActive: s.isActive })),
        );
      }
      const team = await getStaffUnderManager(managerId);
      const me: ReportStaffOption = {
        userId: managerId,
        name: managerName ? `${managerName} (Me)` : 'Manager (Me)',
        empId: managerId,
        department: '',
        isActive: true,
        isSelf: true,
      };
      return dedupeOptions([me, ...team.map((t) => ({ userId: t.userId, name: t.name, empId: t.empId, department: t.department, isActive: true }))]);
    },
  });
  return { ...query, isManager, managerId, orgId };
}
