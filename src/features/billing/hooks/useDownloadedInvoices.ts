import { useCallback, useEffect, useRef, useState } from 'react';

import { savedFileExists } from '@/lib/platform/files';
import { STORAGE_KEYS, getJSON, setJSON, storageKeyFor } from '@/lib/storage';

import { parseDownloads, removeDownload, upsertDownload, type DownloadedInvoice } from '../utils/downloads';

/**
 * Persisted registry of downloaded invoice PDFs, scoped by organisation. Entries whose file vanished (OS cache purge,
 * reinstall) are dropped when the registry is loaded, instead of failing later with a generic error.
 */
export function useDownloadedInvoices(orgId: string) {
  const [items, setItems] = useState<DownloadedInvoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const itemsRef = useRef<DownloadedInvoice[]>([]);
  const key = storageKeyFor(STORAGE_KEYS.downloadedInvoices, orgId);

  const persist = useCallback(
    async (next: DownloadedInvoice[]) => {
      itemsRef.current = next;
      setItems(next);
      await setJSON(key, next);
    },
    [key],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = parseDownloads(await getJSON<unknown>(key, []));
      const alive: DownloadedInvoice[] = [];
      for (const entry of stored) {
        if (await savedFileExists(entry.filePath)) alive.push(entry);
      }
      if (cancelled) return;
      itemsRef.current = alive;
      setItems(alive);
      setLoaded(true);
      if (alive.length !== stored.length) await setJSON(key, alive);
    })().catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const add = useCallback((entry: DownloadedInvoice) => persist(upsertDownload(itemsRef.current, entry)), [persist]);
  const remove = useCallback((invoiceNumber: string) => persist(removeDownload(itemsRef.current, invoiceNumber)), [persist]);

  return { items, loaded, add, remove };
}
