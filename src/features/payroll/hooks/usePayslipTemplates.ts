import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPayslipTemplates } from '@/api/payroll';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';
import { deletablePayslipId, orderPayslipTemplates } from '../utils/payslipForm';

/**
 * Payslip templates of the current organisation, in the deterministic display order (oldest first), plus the id of the
 * only template that may be deleted. An empty list from the server replaces the cached list (never stale).
 */
export function usePayslipTemplates() {
  const orgId = useOrgId();
  const query = useQuery({
    queryKey: queryKeys.payroll.templates(orgId, 'payslip'),
    queryFn: () => listPayslipTemplates(orgId),
    enabled: orgId !== '',
  });
  const ordered = useMemo(() => orderPayslipTemplates(query.data ?? []), [query.data]);
  const deletableId = useMemo(() => deletablePayslipId(ordered), [ordered]);
  return { orgId, query, templates: ordered, deletableId };
}
