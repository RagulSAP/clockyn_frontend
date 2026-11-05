/**
 * Saved-report history ("View Reports"): pure list logic + a small storage/file layer.
 *
 * Storage: `STORAGE_KEYS.generatedReports` scoped by organisation id (v1 kept one unscoped list). Each entry points to
 * a real file in the platform files store with its REAL mime type and extension, so it opens/shares correctly.
 * The list is capped at `HISTORY_CAP` (newest kept); evicted entries have their files deleted. Deleting an entry
 * deletes its file too.
 */
import { deleteSavedFile } from '@/lib/platform/files';
import { getJSON, setJSON, STORAGE_KEYS, storageKeyFor } from '@/lib/storage';
import type { SavedReport } from '../types';

/** Maximum number of saved reports kept per organisation. */
export const HISTORY_CAP = 50;

const isString = (v: unknown): v is string => typeof v === 'string' && v !== '';

/** Tolerant reader: drops malformed entries (also handles the legacy `{type:'pdf'}` shape without a mime type). */
export function normalizeHistory(raw: unknown): SavedReport[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedReport[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (!isString(r.id) || !isString(r.uri) || !isString(r.name)) continue;
    const filename = isString(r.filename) ? r.filename : r.name;
    out.push({
      id: r.id,
      name: r.name,
      uri: r.uri,
      filename,
      mimeType: isString(r.mimeType) ? r.mimeType : 'application/octet-stream',
      date: isString(r.date) ? r.date : new Date(0).toISOString(),
      size: typeof r.size === 'number' ? r.size : undefined,
    });
  }
  return out;
}

export interface AddResult {
  list: SavedReport[];
  /** Entries removed from the list (cap or same file re-exported); delete their files unless still referenced. */
  evicted: SavedReport[];
}

/**
 * Prepends `entry` (newest first). An older entry with the same `uri` or file name is replaced (re-exporting the same file name
 * overwrites the file, so two entries would point at one file). Entries beyond `cap` are evicted, oldest first.
 */
export function addToHistory(list: readonly SavedReport[], entry: SavedReport, cap: number = HISTORY_CAP): AddResult {
  const evicted: SavedReport[] = [];
  const kept: SavedReport[] = [];
  for (const e of list) {
    // Same uri (native: the file was overwritten) or same file name (web: every export is a fresh blob URL).
    if (e.uri === entry.uri || e.filename === entry.filename) evicted.push(e);
    else kept.push(e);
  }
  const next = [entry, ...kept];
  const limit = Math.max(1, cap);
  while (next.length > limit) {
    const last = next.pop();
    if (last) evicted.push(last);
  }
  return { list: next, evicted };
}

export function removeFromHistory(list: readonly SavedReport[], id: string): { list: SavedReport[]; removed: SavedReport | undefined } {
  return { list: list.filter((e) => e.id !== id), removed: list.find((e) => e.id === id) };
}

/** Files that are no longer referenced by any entry of `remaining` (an evicted entry may share its file with a kept one). */
export function orphanedFiles(evicted: readonly SavedReport[], remaining: readonly SavedReport[]): string[] {
  const used = new Set(remaining.map((e) => e.uri));
  return [...new Set(evicted.map((e) => e.uri))].filter((uri) => !used.has(uri));
}

export function newReportId(now: number = Date.now()): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const historyKey = (orgId: string): string => storageKeyFor(STORAGE_KEYS.generatedReports, orgId);

// ─── storage layer (read-modify-write is serialised so concurrent exports cannot lose entries) ───────────────────────

let queue: Promise<unknown> = Promise.resolve();
function serialised<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function deleteFiles(uris: readonly string[]): Promise<void> {
  for (const uri of uris) {
    try {
      await deleteSavedFile(uri);
    } catch (e) {
      console.warn('Could not delete a saved report file', e);
    }
  }
}

async function persist(orgId: string, list: SavedReport[]): Promise<void> {
  if (!(await setJSON(historyKey(orgId), list))) throw new Error('Could not update the saved reports list.');
}

export async function loadHistory(orgId: string): Promise<SavedReport[]> {
  return normalizeHistory(await getJSON<unknown>(historyKey(orgId), []));
}

export interface NewReportInput {
  name: string;
  uri: string;
  filename: string;
  mimeType: string;
  size?: number;
}

/** Adds a freshly generated report to the history (pruning to the cap). Resolves to the updated list. */
export function recordSavedReport(orgId: string, input: NewReportInput): Promise<SavedReport[]> {
  return serialised(async () => {
    const entry: SavedReport = { ...input, id: newReportId(), date: new Date().toISOString() };
    const current = await loadHistory(orgId);
    const { list, evicted } = addToHistory(current, entry);
    await persist(orgId, list);
    await deleteFiles(orphanedFiles(evicted, list));
    return list;
  });
}

/** Removes an entry AND its file. Resolves to the updated list. */
export function deleteSavedReport(orgId: string, id: string): Promise<SavedReport[]> {
  return serialised(async () => {
    const current = await loadHistory(orgId);
    const { list, removed } = removeFromHistory(current, id);
    await persist(orgId, list);
    if (removed) await deleteFiles(orphanedFiles([removed], list));
    return list;
  });
}
