/** Runs the branch delete / reassign flow (see `utils/branchDeleteFlow.ts`) against the API. */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { branchesApi } from '@/api';
import { useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import type { Branch } from '@/types/api/branches';

import { INITIAL_DELETE_FLOW, deleteFlowReducer, remainingAfter } from '../utils/branchDeleteFlow';
import { orgStructureKeys, type OrgScope } from './useOrgScope';

export function useBranchDeleteFlow(scope: Pick<OrgScope, 'orgId' | 'scopeId'>) {
  const [state, dispatch] = useReducer(deleteFlowReducer, INITIAL_DELETE_FLOW);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Latest state for async continuations (the reducer ignores stale actions, this guards the API calls).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { orgId, scopeId } = scope;
  // v1 never refreshed other screens' branch caches after a delete / reassign.
  const refresh = useCallback(() => {
    for (const key of orgStructureKeys({ orgId, scopeId }, ['branches', 'home', 'staff'])) {
      void queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined);
    }
  }, [queryClient, orgId, scopeId]);

  /** Trash tapped: look up the branch's staff, then open the confirm dialog (none) or the reassign sheet. */
  const start = useCallback(
    async (branch: Branch) => {
      if (stateRef.current.step !== 'idle') return;
      dispatch({ type: 'start', branch });
      try {
        const staff = await branchesApi.getBranchStaff(branch.id, scopeId);
        dispatch({ type: 'staffLoaded', staff });
      } catch (e) {
        // v1 fell through to a plain delete dialog here; show the failure instead.
        dispatch({ type: 'staffFailed' });
        toast.error(getErrorMessage(e, 'Could not check the staff in this branch'));
      }
    },
    [scopeId, toast],
  );

  const cancel = useCallback(() => {
    const s = stateRef.current;
    if (s.step === 'reassign' && s.busy) return;
    if (s.step === 'confirm' && s.deleting) return;
    dispatch({ type: 'cancel' });
  }, []);

  /** Plain delete of an empty branch (confirm dialog). */
  const confirmDelete = useCallback(async () => {
    const s = stateRef.current;
    if (s.step !== 'confirm' || s.deleting) return;
    dispatch({ type: 'deleteStarted' });
    try {
      await branchesApi.deleteBranch(s.branch.id, scopeId);
      dispatch({ type: 'deleted' });
      refresh();
      toast.success('Branch deleted successfully');
    } catch (e) {
      const message = getErrorMessage(e, 'Failed to delete branch');
      dispatch({ type: 'deleteFailed', message });
      toast.error(message);
    }
  }, [scopeId, refresh, toast]);

  /** Moves the selected staff; when none are left the branch is deleted (reassign first, delete second — v1 sequence). */
  const reassign = useCallback(async () => {
    const s = stateRef.current;
    if (s.step !== 'reassign' || s.busy) return;
    if (s.selectedIds.length === 0 || s.targetId === '') {
      toast.error('Please select staff and target branch');
      return;
    }
    const moved = [...s.selectedIds];
    dispatch({ type: 'busy' });
    try {
      await branchesApi.reassignStaff({ staffIds: moved, newBranchId: s.targetId, orgId: scopeId });
    } catch (e) {
      const message = getErrorMessage(e, 'Failed to reassign staff');
      dispatch({ type: 'failed', message });
      toast.error(message);
      return;
    }
    refresh();
    const remaining = remainingAfter(s.staff, moved);
    dispatch({ type: 'reassigned', movedIds: moved });
    if (remaining.length > 0) {
      toast.success(`${moved.length} staff reassigned`);
      return;
    }
    dispatch({ type: 'busy' });
    try {
      await branchesApi.deleteBranch(s.branch.id, scopeId);
      dispatch({ type: 'deleted' });
      refresh();
      toast.success('Staff reassigned and branch deleted');
    } catch (e) {
      // The staff HAVE moved: say so (v1 claimed the reassignment failed) and let the user retry the delete.
      const message = getErrorMessage(e, 'the branch could not be deleted');
      dispatch({ type: 'deleteFailed', message });
      toast.error(`Staff reassigned, but the branch was not deleted: ${message}`);
    }
  }, [scopeId, refresh, toast]);

  return {
    state,
    start,
    cancel,
    confirmDelete,
    reassign,
    toggleStaff: (userId: string) => dispatch({ type: 'toggleStaff', userId }),
    toggleAll: () => dispatch({ type: 'toggleAll' }),
    setTarget: (branchId: string) => dispatch({ type: 'setTarget', branchId }),
  };
}
