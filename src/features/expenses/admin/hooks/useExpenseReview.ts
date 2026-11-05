import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { expensesApi } from '@/api';
import { useConfirm, useToast } from '@/components/ui';
import { useAsyncAction, useRefreshOnFocus } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';
import type { Expense, ExpenseType, OdometerReading } from '@/types/api/expenses';

import { DEFAULT_RATE_PER_KM, effectiveRate } from '../utils/odometerMath';
import { reviewFailureMessage } from '../utils/recordFilter';

type Decision = 'approved' | 'rejected';

/** Pull-to-refresh state shared by the three review screens (background refetches do not show the spinner). */
function usePullRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, refresh };
}

/** Travel tickets (`travel`) or other bills (`bill`) of the org with approve / reject (decisions are final). */
export function useExpenseReview(kind: ExpenseType) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const key = queryKeys.expenses.admin(orgId, kind);
  const query = useQuery({
    queryKey: key,
    queryFn: () => expensesApi.listExpenses(orgId, kind),
    enabled: orgId !== '',
  });
  useRefreshOnFocus(query.refetch);

  const review = useAsyncAction(
    async (p: { expense: Expense; status: Decision }) => {
      let result;
      try {
        result = await expensesApi.reviewExpense(p.expense.expenseId, p.status, orgId);
      } catch (e) {
        // the server message wins; otherwise the v1 wording ("Failed to approve ticket" / "Failed to reject bill")
        throw new Error(getErrorMessage(e, reviewFailureMessage(kind === 'travel' ? 'ticket' : 'bill', p.status)));
      }
      queryClient.setQueryData<Expense[]>(key, (old) => old?.map((e) => (e.expenseId === p.expense.expenseId ? { ...e, status: p.status } : e)));
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(orgId) }).catch(() => undefined);
      return result;
    },
    { errorMessage: 'Failed to update' },
  );

  const noun = kind === 'travel' ? 'ticket' : 'bill';
  const run = review.run;
  const decide = useCallback(
    async (expense: Expense, status: Decision, amountText: string) => {
      const approve = status === 'approved';
      const ok = await confirm({
        title: `${approve ? 'Approve' : 'Reject'} ${noun}`,
        message: `${approve ? 'Approve' : 'Reject'} the ${noun} of ${expense.userName || 'this employee'} for ${amountText}? This cannot be changed later.`,
        confirmText: approve ? 'Approve' : 'Reject',
        destructive: !approve,
      });
      if (!ok) return;
      const result = await run({ expense, status });
      if (result) {
        // success feedback is a toast (rejection is not an error)
        const text = `${noun === 'ticket' ? 'Ticket' : 'Bill'} ${status}`;
        if (approve) toast.success(text);
        else toast.info(text);
      }
    },
    [confirm, toast, noun, run],
  );

  const { refreshing, refresh } = usePullRefresh(query.refetch);
  return { query, items: query.data ?? [], decide, busy: review.loading, refreshing, refresh };
}

/** Odometer readings + the org per-km rate, with approve / reject and the rate editor. */
export function useOdometerReview() {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const readingsKey = queryKeys.expenses.adminOdometer(orgId);
  const rateKey = queryKeys.expenses.allowanceRate(orgId);

  const readings = useQuery({
    queryKey: readingsKey,
    queryFn: () => expensesApi.listOdometerReadings(orgId),
    enabled: orgId !== '',
  });
  const rateQuery = useQuery({
    queryKey: rateKey,
    queryFn: () => expensesApi.getAllowanceRate(orgId),
    enabled: orgId !== '',
  });
  const refetchReadings = readings.refetch;
  const refetchRate = rateQuery.refetch;
  const refetchBoth = useCallback(() => Promise.all([refetchReadings(), refetchRate()]), [refetchReadings, refetchRate]);
  useRefreshOnFocus(refetchBoth);

  const ratePerKm = effectiveRate(rateQuery.data ?? DEFAULT_RATE_PER_KM);

  const review = useAsyncAction(
    async (p: { reading: OdometerReading; status: Decision }) => {
      let result;
      try {
        result = await expensesApi.reviewOdometerReading(p.reading.readingId, p.status, orgId);
      } catch (e) {
        throw new Error(getErrorMessage(e, reviewFailureMessage('reading', p.status)));
      }
      queryClient.setQueryData<OdometerReading[]>(readingsKey, (old) =>
        old?.map((r) => (r.readingId === p.reading.readingId ? { ...r, status: p.status } : r)),
      );
      void queryClient.invalidateQueries({ queryKey: readingsKey }).catch(() => undefined);
      return result;
    },
    { errorMessage: 'Failed to update' },
  );

  const saveRate = useAsyncAction(
    async (rate: number) => {
      const result = await expensesApi.setAllowanceRate(orgId, rate);
      queryClient.setQueryData<number>(rateKey, rate);
      return result;
    },
    { successMessage: 'Rate updated successfully', errorMessage: 'Failed to save rate' },
  );

  const runReview = review.run;
  const decide = useCallback(
    async (reading: OdometerReading, status: Decision, amountText: string) => {
      const approve = status === 'approved';
      const ok = await confirm({
        title: `${approve ? 'Approve' : 'Reject'} reading`,
        message: `${approve ? 'Approve' : 'Reject'} the odometer reading of ${reading.userName || 'this employee'} (${amountText})? This cannot be changed later.`,
        confirmText: approve ? 'Approve' : 'Reject',
        destructive: !approve,
      });
      if (!ok) return;
      const result = await runReview({ reading, status });
      if (result) {
        const text = `Reading ${status} successfully`;
        if (approve) toast.success(text);
        else toast.info(text);
      }
    },
    [confirm, toast, runReview],
  );

  const { refreshing, refresh } = usePullRefresh(refetchBoth);
  return {
    readings,
    items: readings.data ?? [],
    ratePerKm,
    decide,
    busy: review.loading,
    saveRate: saveRate.run,
    savingRate: saveRate.loading,
    refreshing,
    refresh,
  };
}
