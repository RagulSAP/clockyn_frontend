import { queryOptions, useQuery } from '@tanstack/react-query';

import { expensesApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';
import type { Expense, ExpenseType, OdometerReading } from '@/types/api/expenses';

import { expensesOnDate } from '../utils/expenseRules';

/** Readings of one day (cache entry per user + date; v1 kept a single global list for "the last viewed date"). */
export function odometerOptions(userId: string, date: string) {
  return queryOptions({
    queryKey: queryKeys.expenses.odometer(userId, date),
    queryFn: (): Promise<OdometerReading[]> => expensesApi.getOdometerReadings(userId, date),
  });
}

/**
 * Tickets / bills of one day. The list call is asked for the date and the rows are filtered again client-side, so a
 * server that ignores the filter (v1 downloaded the whole history) still shows the right day.
 */
export function expenseListOptions(userId: string, type: ExpenseType, date: string) {
  return queryOptions({
    queryKey: [...queryKeys.expenses.mine(userId, type), date] as const,
    queryFn: async (): Promise<Expense[]> => expensesOnDate(await expensesApi.listMyExpenses(userId, { type, date }), date),
  });
}

export function useOdometerReadings(date: string) {
  const userId = useSession()?.userId ?? '';
  return useQuery({ ...odometerOptions(userId, date), enabled: userId !== '' });
}

export function useExpenseList(type: ExpenseType, date: string) {
  const userId = useSession()?.userId ?? '';
  return useQuery({ ...expenseListOptions(userId, type, date), enabled: userId !== '' });
}
