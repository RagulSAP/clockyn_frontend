import { useQuery } from '@tanstack/react-query';

import * as leadsApi from '@/api/leads';
import { queryKeys } from '@/lib/query/queryKeys';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { useOrgId } from '@/store/auth';

/** Lead categories of the organisation (not plan-gated by the backend). */
export function useLeadCategories(enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.leads.categories(orgId),
    queryFn: () => leadsApi.listLeadCategories(orgId),
    enabled: enabled && orgId !== '',
  });
}

/** Add a category; resolves to its id/name so the caller can select it. Failures toast the server message. */
export function useAddCategory() {
  const orgId = useOrgId();
  return useApiMutation(
    async (name: string) => {
      const { id } = await leadsApi.createLeadCategory(orgId, name);
      return { id, name: name.trim() };
    },
    { invalidate: [queryKeys.leads.categories(orgId)], successMessage: 'Category added successfully', errorMessage: 'Failed to add category' },
  );
}

export function useDeleteCategory() {
  const orgId = useOrgId();
  return useApiMutation((categoryId: string) => leadsApi.deleteLeadCategory(categoryId), {
    invalidate: [queryKeys.leads.categories(orgId)],
    successMessage: 'Category deleted successfully',
    errorMessage: 'Failed to delete category',
  });
}
