import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import * as systemApi from '@/api/system';
import { useToast } from '@/components/ui';
import { useMounted } from '@/hooks/useMounted';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';
import type { Holiday } from '@/types/api/system';

import { describeBatchFailure, runBatch, type BatchTask } from '../utils/batch';
import { computeEditDiff, holidayDateLabel, plural, splitDuplicateDates, type HolidayGroup } from '../utils/holidayLogic';

export type BusyKey = 'add' | 'edit' | 'addDates' | 'offDays' | 'delete';

export type AddHolidayInput = {
  name: string;
  dates: string[];
  branchName: string;
  deptName: string;
  blockAttendance: boolean;
};

export type AddOutcome = { ok: boolean; /** Dates that failed (keep them selected so the user can retry). */ remaining: string[] };

/**
 * Write operations of the holiday screen. Unlike v1 every response is checked: a rejected request produces an error
 * toast (never a success toast), partial failures say how many dates failed, and loading flags always clear.
 */
export function useHolidayActions(existing: readonly Holiday[]) {
  const orgId = useOrgId();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isMounted = useMounted();
  const [busy, setBusy] = useState<Record<BusyKey, boolean>>({ add: false, edit: false, addDates: false, offDays: false, delete: false });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.holidays.all(orgId) });
  }, [queryClient, orgId]);

  const guard = useCallback(
    async <T>(key: BusyKey, fallback: string, fn: () => Promise<T>): Promise<T | undefined> => {
      setBusy((b) => ({ ...b, [key]: true }));
      try {
        return await fn();
      } catch (e) {
        toast.error(getErrorMessage(e, fallback));
        return undefined;
      } finally {
        if (isMounted()) setBusy((b) => ({ ...b, [key]: false }));
      }
    },
    [toast, isMounted],
  );

  const addDatesWithScope = useCallback(
    async (input: AddHolidayInput, key: BusyKey, successText: (added: number) => string, failFallback: string): Promise<AddOutcome> => {
      const name = input.name.trim();
      const scope = { name, branchName: input.branchName || null, deptName: input.deptName || null };
      const { fresh, duplicates } = splitDuplicateDates(input.dates, existing, scope);
      if (fresh.length === 0) {
        toast.error(`"${name}" already exists on ${duplicates.length === 1 ? 'that date' : 'those dates'}.`);
        return { ok: false, remaining: [] };
      }
      const result = await guard(key, failFallback, () =>
        systemApi.addHolidayDates(orgId, { name, branchName: scope.branchName, deptName: scope.deptName, blockAttendance: input.blockAttendance }, fresh),
      );
      if (!result) return { ok: false, remaining: input.dates };
      refresh();
      const remaining = result.failed.map((f) => f.date);
      if (result.failed.length === 0) {
        const skipped = duplicates.length > 0 ? ` (${plural(duplicates.length, 'date already existed', 'dates already existed')} and ${duplicates.length === 1 ? 'was' : 'were'} skipped)` : '';
        toast.success(`${successText(result.added)}${skipped}`);
        return { ok: true, remaining: [] };
      }
      const first = result.failed[0];
      toast.error(
        result.added > 0
          ? `Added ${result.added} of ${fresh.length}. ${holidayDateLabel(first.date)}: ${first.message}`
          : `${failFallback}: ${first.message}`,
      );
      return { ok: false, remaining };
    },
    [existing, guard, orgId, refresh, toast],
  );

  /** Adds the typed holiday on every selected date. */
  const addHolidays = useCallback(
    async (input: AddHolidayInput): Promise<AddOutcome> => {
      if (!input.name.trim()) {
        toast.error('Please enter a holiday name');
        return { ok: false, remaining: input.dates };
      }
      if (input.dates.length === 0) return { ok: false, remaining: [] };
      return addDatesWithScope(input, 'add', (n) => `${n} holiday(s) added successfully`, 'Failed to add holiday');
    },
    [addDatesWithScope, toast],
  );

  /** "Add Dates" on an existing holiday: same name, scope and punch policy. */
  const addDatesToGroup = useCallback(
    (group: HolidayGroup, dates: string[]): Promise<AddOutcome> =>
      addDatesWithScope(
        { name: group.name, dates, branchName: group.branchName ?? '', deptName: group.deptName ?? '', blockAttendance: group.blockAttendance },
        'addDates',
        (n) => `${n} date(s) added`,
        'Failed to add dates',
      ),
    [addDatesWithScope],
  );

  /** Edit as a diff of per-date records (kept dates renamed / re-flagged, removed dates deleted, new dates created). */
  const saveEdit = useCallback(
    async (group: HolidayGroup, v: { name: string; dates: string[]; blockAttendance: boolean }): Promise<boolean> => {
      const name = v.name.trim();
      if (!name) {
        toast.error('Please enter a holiday name');
        return false;
      }
      const diff = computeEditDiff(group.entries, v.dates);
      const tasks: BatchTask[] = [
        ...diff.toUpdate
          .filter((e) => e.name !== name || e.blockAttendance !== v.blockAttendance)
          .map((e) => ({ label: holidayDateLabel(e.date), run: () => systemApi.updateHoliday(orgId, e.id, { name, blockAttendance: v.blockAttendance }) })),
        ...diff.toDelete.map((e) => ({ label: holidayDateLabel(e.date), run: () => systemApi.deleteHoliday(orgId, e.id) })),
        ...diff.toAdd.map((date) => ({
          label: holidayDateLabel(date),
          run: () => systemApi.addHoliday(orgId, { name, date, branchName: group.branchName, deptName: group.deptName, blockAttendance: v.blockAttendance }),
        })),
      ];
      if (tasks.length === 0) return true;
      const result = await guard('edit', 'Failed to update', () => runBatch(tasks));
      if (!result) return false;
      refresh();
      const failure = describeBatchFailure(result, 'Update');
      if (failure) {
        toast.error(failure);
        return false;
      }
      toast.success('Holiday updated');
      return true;
    },
    [guard, orgId, refresh, toast],
  );

  /** Deletes one or more per-date records. */
  const deleteEntries = useCallback(
    async (entries: readonly Holiday[]): Promise<boolean> => {
      const tasks: BatchTask[] = entries.map((e) => ({ label: holidayDateLabel(e.date), run: () => systemApi.deleteHoliday(orgId, e.id) }));
      const result = await guard('delete', 'Failed to delete', () => runBatch(tasks));
      if (!result) return false;
      refresh();
      const failure = describeBatchFailure(result, 'Delete');
      if (failure) {
        toast.error(failure);
        return false;
      }
      toast.success(entries.length > 1 ? `${entries.length} holidays deleted` : 'Holiday deleted');
      return true;
    },
    [guard, orgId, refresh, toast],
  );

  const saveOffDays = useCallback(
    async (days: number[]): Promise<boolean> => {
      const ok = await guard('offDays', 'Failed to save off days', async () => {
        await systemApi.setWeeklyOffs(orgId, days);
        return true;
      });
      if (!ok) return false;
      void queryClient.invalidateQueries({ queryKey: queryKeys.holidays.offDays(orgId) });
      toast.success('Off days updated');
      return true;
    },
    [guard, orgId, queryClient, toast],
  );

  return { busy, addHolidays, addDatesToGroup, saveEdit, deleteEntries, saveOffDays };
}
