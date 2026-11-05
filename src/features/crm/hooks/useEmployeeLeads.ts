import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import * as leadsApi from '@/api/leads';
import { queryKeys } from '@/lib/query/queryKeys';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { useOrgId, useUserId } from '@/store/auth';
import type { Lead, LeadWorkStatus } from '@/types/api/leads';

import { buildEmployeeLeads, type EmployeeLead } from '../utils/employeeLeads';

/**
 * The signed-in employee's lead list (server: assigned to me AND dated today or undated). Shared by the My Leads
 * screen and the CRM badge sync, so both read one cache entry.
 */
export function useEmployeeLeadsQuery(opts: { enabled?: boolean; refetchInterval?: number | false } = {}) {
  const orgId = useOrgId();
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.leads.employee(orgId, userId),
    queryFn: () => leadsApi.listEmployeeLeads(orgId, userId),
    enabled: (opts.enabled ?? true) && orgId !== '' && userId !== '',
    refetchInterval: opts.refetchInterval ?? false,
  });
}

export interface EmployeeLeadsData {
  leads: EmployeeLead[];
  /** Raw server rows (ids for the seen-leads logic). */
  rows: Lead[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isRefetching: boolean;
  refetchAll: () => Promise<void>;
}

/** My leads joined with my own carry-forward requests. */
export function useEmployeeLeads(enabled = true): EmployeeLeadsData {
  const orgId = useOrgId();
  const userId = useUserId();
  const leadsQ = useEmployeeLeadsQuery({ enabled });
  const cfrQ = useQuery({
    queryKey: queryKeys.leads.myCarryForward(orgId, userId),
    queryFn: () => leadsApi.listMyCarryForwardRequests(orgId, userId),
    enabled: enabled && orgId !== '' && userId !== '',
  });
  const rows = useMemo(() => leadsQ.data ?? [], [leadsQ.data]);
  const myRequests = cfrQ.data;
  const leads = useMemo(() => buildEmployeeLeads(rows, myRequests ?? []), [rows, myRequests]);
  const refetchLeads = leadsQ.refetch;
  const refetchCfr = cfrQ.refetch;
  const refetchAll = useCallback(async () => {
    await Promise.all([refetchLeads(), refetchCfr()]);
  }, [refetchLeads, refetchCfr]);
  return {
    leads,
    rows,
    isLoading: leadsQ.isLoading,
    isError: leadsQ.isError && !leadsQ.data,
    error: leadsQ.error,
    isRefetching: leadsQ.isRefetching || cfrQ.isRefetching,
    refetchAll,
  };
}

/** Update my work status on a lead (pending / working / completed). */
export function useUpdateWorkStatus() {
  const orgId = useOrgId();
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useApiMutation((v: { leadId: string; status: LeadWorkStatus }) => leadsApi.updateLeadWorkStatus(v.leadId, v.status, userId), {
    invalidate: [queryKeys.leads.employee(orgId, userId)],
    errorMessage: 'Failed to update status',
    onSuccess: (_d, v) => {
      // Optimistic-on-success patch; the invalidation above re-syncs from the server.
      queryClient.setQueryData<Lead[]>(queryKeys.leads.employee(orgId, userId), (old) =>
        old?.map((l) => (l.id === v.leadId ? { ...l, workStatus: v.status } : l)),
      );
    },
  });
}

/** Raise a carry-forward request (reason required, optional forward date). Failures toast the server message. */
export function useRequestCarryForward() {
  const orgId = useOrgId();
  const userId = useUserId();
  return useApiMutation(
    (v: { leadId: string; description: string; forwardDate: string }) =>
      leadsApi.requestCarryForward({ leadId: v.leadId, orgId, userId, description: v.description, forwardDate: v.forwardDate || null }),
    {
      invalidate: [queryKeys.leads.myCarryForward(orgId, userId), queryKeys.leads.employee(orgId, userId), queryKeys.leads.carryForward(orgId)],
      errorMessage: 'Failed to submit request',
    },
  );
}
