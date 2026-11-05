import * as leadsApi from '@/api/leads';
import { queryKeys } from '@/lib/query/queryKeys';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { useOrgId } from '@/store/auth';
import type { UpdateLeadInput, LeadInput } from '@/types/api/leads';

/** Delete a lead (admin). */
export function useDeleteLead() {
  const orgId = useOrgId();
  return useApiMutation((leadId: string) => leadsApi.deleteLead(leadId), {
    invalidate: [queryKeys.leads.all(orgId)],
    successMessage: 'Lead deleted successfully',
    errorMessage: 'Failed to delete lead',
  });
}

export interface AssignVars {
  leadId: string;
  userId: string;
  branchId?: string | null;
  deptId?: string | null;
  /** True when the lead already has an assignee (PUT assignment) - false creates the assignment (POST). */
  reassign: boolean;
}

/** Assign / reassign a lead to an employee (the employee's own branch / department are sent, like v1). */
export function useAssignLead() {
  const orgId = useOrgId();
  return useApiMutation(
    (v: AssignVars) =>
      v.reassign
        ? leadsApi.reassignLead({ leadId: v.leadId, userId: v.userId, branchId: v.branchId, deptId: v.deptId })
        : leadsApi.assignLead({ leadId: v.leadId, orgId, userId: v.userId, branchId: v.branchId, deptId: v.deptId }),
    {
      invalidate: [queryKeys.leads.all(orgId)],
      errorMessage: (_e, v) => (v.reassign ? 'Failed to reassign lead' : 'Failed to assign lead'),
    },
  );
}

export type SaveLeadVars = { leadId: null; input: LeadInput } | { leadId: string; input: UpdateLeadInput };

/**
 * Create (no lead id) or update a lead. The follow-up refresh is an invalidation (not part of the save, so a
 * refetch failure can no longer report a saved lead as failed). Failures are NOT toasted here: the admin form toasts
 * them, the staff sheet shows them inline - use `mutateAsync` in try/catch.
 */
export function useSaveLead() {
  const orgId = useOrgId();
  return useApiMutation(
    async (v: SaveLeadVars) => {
      if (v.leadId === null) await leadsApi.createLead(v.input);
      else await leadsApi.updateLead(v.leadId, v.input);
    },
    { invalidate: [queryKeys.leads.all(orgId)], silentError: true },
  );
}

export const SAVE_FAILED_MESSAGE = { create: 'Failed to save lead', update: 'Failed to update lead' } as const;
