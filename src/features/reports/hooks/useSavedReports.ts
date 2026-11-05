/** Saved-report history of the current organisation: load (with file availability), open / share, delete (entry + file). */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useConfirm, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { openFile, savedFileExists, shareFile } from '@/lib/platform/files';
import { useOrgId } from '@/store/auth';
import type { SavedReport } from '../types';
import { deleteSavedReport, loadHistory } from '../utils/history';

export function isPdf(entry: Pick<SavedReport, 'mimeType'>): boolean {
  return entry.mimeType.toLowerCase().startsWith('application/pdf');
}

export function useSavedReports(active: boolean) {
  const orgId = useOrgId();
  const toast = useToast();
  const confirm = useConfirm();
  const [entries, setEntries] = useState<SavedReport[]>([]);
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    if (!orgId) return;
    setLoading(true);
    try {
      const list = await loadHistory(orgId);
      const gone = new Set<string>();
      for (const e of list) {
        if (!(await savedFileExists(e.uri))) gone.add(e.id);
      }
      setEntries(list);
      setMissing(gone);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not load saved reports.'));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [orgId, toast]);

  // Reloads whenever the screen regains focus on the View tab (returning from a generator) and when the tab opens.
  useFocusEffect(
    useCallback(() => {
      if (active) void reload();
    }, [active, reload]),
  );

  /** PDF → open in a viewer; every other format → share sheet / download. */
  const open = useCallback(
    async (entry: SavedReport): Promise<void> => {
      if (missing.has(entry.id)) {
        toast.error('This report is no longer available on this device. You can remove it from the list.');
        return;
      }
      try {
        const base = { uri: entry.uri, mimeType: entry.mimeType, filename: entry.filename, dialogTitle: entry.name };
        if (isPdf(entry)) await openFile(base);
        else await shareFile(base);
      } catch (e) {
        toast.error(getErrorMessage(e, 'Could not open report.'));
      }
    },
    [missing, toast],
  );

  const share = useCallback(
    async (entry: SavedReport): Promise<void> => {
      if (missing.has(entry.id)) {
        toast.error('This report is no longer available on this device. You can remove it from the list.');
        return;
      }
      try {
        await shareFile({ uri: entry.uri, mimeType: entry.mimeType, filename: entry.filename, dialogTitle: entry.name });
      } catch (e) {
        toast.error(getErrorMessage(e, 'Failed to share report.'));
      }
    },
    [missing, toast],
  );

  const remove = useCallback(
    async (entry: SavedReport): Promise<void> => {
      const ok = await confirm({
        title: 'Delete Report',
        message: 'Remove this report from the list and delete its file?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true,
      });
      if (!ok) return;
      try {
        setEntries(await deleteSavedReport(orgId, entry.id));
      } catch (e) {
        toast.error(getErrorMessage(e, 'Could not remove the report.'));
      }
    },
    [confirm, orgId, toast],
  );

  return { entries, missing, loading: loading && !loaded, refreshing: loading && loaded, reload, open, share, remove };
}
