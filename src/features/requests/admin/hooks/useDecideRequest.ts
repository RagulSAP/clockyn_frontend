import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { requestsApi } from '@/api';
import { useConfirm } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useSession } from '@/store/auth';
import type { RequestType, StaffRequest } from '@/types/api/requests';

import { applyDecision, decisionCopy, decisionTargets, displayDate, formatDatesLine } from '../utils/requestLogic';
import { failureMessage, runDecision } from '../utils/runDecision';

export interface DecideArgs {
  request: StaffRequest;
  status: 'approved' | 'rejected';
  /** Permission cards: the card's date. */
  date?: string;
  /** True for the "Change to ..." action on an already decided card. */
  isChange: boolean;
}

/**
 * Confirm -> decide -> patch the cache -> refresh. Every transition goes through a confirmation dialog; the action
 * is busy-guarded (double taps are ignored) and never reports success for a call that failed or was not made.
 * Sends `action_by` = acting user and `role_id` = acting role (1 admin / 2 manager).
 */
export function useDecideRequest(type: RequestType): { decide: (args: DecideArgs) => Promise<void>; busy: boolean } {
  const queryClient = useQueryClient();
  const session = useSession();
  const orgId = useOrgId();
  const confirm = useConfirm();

  const action = useAsyncAction(
    async (args: DecideArgs & { successMessage: string }) => {
      if (!session) throw new Error('You are signed out');
      const targets = decisionTargets(type, args.request, args.date);
      const outcome = await runDecision(
        requestsApi.updateRequestStatus,
        { requestId: args.request.id, status: args.status, actionBy: session.userId, roleId: session.roleId },
        targets,
      );
      if (outcome.succeeded.length > 0) {
        queryClient.setQueryData<StaffRequest[]>(queryKeys.requests.admin(orgId), (old) =>
          old
            ? applyDecision(old, {
                requestId: args.request.id,
                status: args.status,
                dates: outcome.succeeded,
                actionBy: session.userId,
                at: new Date().toISOString(),
              })
            : old,
        );
      }
      // Reconcile with the server whatever happened (also after a partial failure).
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all(orgId) }).catch(() => undefined);
      const failure = failureMessage(outcome);
      if (failure) throw new Error(failure);
      return args.successMessage;
    },
    { successMessage: (message) => message, errorMessage: 'Failed to update' },
  );

  const run = action.run;
  const decide = useCallback(
    async (args: DecideArgs) => {
      const when = type === 'leave' ? formatDatesLine(args.request.dates.length > 0 ? args.request.dates : args.date ? [args.date] : []) : displayDate(args.date);
      const copy = decisionCopy({ type, status: args.status, isChange: args.isChange, staffName: args.request.staffName, when });
      const ok = await confirm({
        title: copy.title,
        message: copy.message,
        confirmText: copy.confirmText,
        destructive: args.status === 'rejected',
      });
      if (!ok) return;
      await run({ ...args, successMessage: copy.successMessage });
    },
    [type, confirm, run],
  );

  return { decide, busy: action.loading };
}
