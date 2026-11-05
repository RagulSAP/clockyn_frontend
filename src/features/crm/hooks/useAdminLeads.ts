import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import * as leadsApi from '@/api/leads';
import { queryKeys } from '@/lib/query/queryKeys';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { useOrgId, useUserId } from '@/store/auth';
import type { CarryForwardRequest } from '@/types/api/leads';

import type { CrmLead } from '../types';
import { buildCrmLeads } from '../utils/leads';

export interface AdminLeadsData {
  /** One row per lead with its carry-forward marker. */
  leads: CrmLead[];
  /** Every carry-forward request of the organisation (newest first, as served). */
  requests: CarryForwardRequest[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** True while a manual / background refetch runs (for pull-to-refresh). */
  isRefetching: boolean;
  refetchAll: () => Promise<void>;
}

/**
 * Leads + carry-forward requests of the organisation, joined (shared by the hub, the assign list and the edit form).
 * Both lists are cached per org; the carry-forward list is fetched ONCE (v1 fetched it twice).
 * The leads call is plan-gated by the backend (403 -> `error` carries the server message); pass `active=false`
 * to skip fetching (e.g. while the plan blocks CRM).
 */
export function useAdminLeads(active = true): AdminLeadsData {
  const orgId = useOrgId();
  const enabled = active && orgId !== '';
  const leadsQ = useQuery({ queryKey: queryKeys.leads.list(orgId), queryFn: () => leadsApi.listLeads(orgId), enabled });
  const cfrQ = useQuery({
    queryKey: queryKeys.leads.carryForward(orgId),
    queryFn: () => leadsApi.listCarryForwardRequests(orgId),
    enabled,
  });

  const rows = leadsQ.data;
  const requests = useMemo(() => cfrQ.data ?? [], [cfrQ.data]);
  const leads = useMemo(() => (rows ? buildCrmLeads(rows, requests) : []), [rows, requests]);

  const refetchLeads = leadsQ.refetch;
  const refetchCfr = cfrQ.refetch;
  const refetchAll = useCallback(async () => {
    await Promise.all([refetchLeads(), refetchCfr()]);
  }, [refetchLeads, refetchCfr]);

  return {
    leads,
    requests,
    isLoading: leadsQ.isLoading,
    isError: leadsQ.isError && !rows,
    error: leadsQ.error,
    isRefetching: leadsQ.isRefetching || cfrQ.isRefetching,
    refetchAll,
  };
}

export interface CfrActionVars {
  requestId: string;
  action: 'approved' | 'rejected';
}

/**
 * Approve / reject a carry-forward request. Approve toasts "CFR approved successfully"; reject is silent on success
 * (v1) - failures always toast the server message. The request card flips status immediately, leads are re-fetched.
 */
export function useCfrAction() {
  const orgId = useOrgId();
  const adminId = useUserId();
  const queryClient = useQueryClient();
  const mutation = useApiMutation((v: CfrActionVars) => leadsApi.actOnCarryForward(v.requestId, v.action, adminId), {
    invalidate: [queryKeys.leads.all(orgId)],
    successMessage: (_d, v) => (v.action === 'approved' ? 'CFR approved successfully' : undefined),
    errorMessage: 'Failed to update request',
    onSuccess: (_d, v) => {
      queryClient.setQueryData<CarryForwardRequest[]>(queryKeys.leads.carryForward(orgId), (old) =>
        old?.map((r) => (r.id === v.requestId ? { ...r, status: v.action } : r)),
      );
    },
  });
  const actioningId = mutation.isPending ? (mutation.variables?.requestId ?? null) : null;
  return { act: mutation.mutate, actioningId, busy: mutation.isPending };
}
