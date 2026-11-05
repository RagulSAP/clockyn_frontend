/**
 * Files — WEB / default implementation (Blob + anchor download).
 * The native implementation lives in `files.native.ts` (expo-file-system, expo-sharing, intent launcher).
 *
 * On the web there is no app-private file system. Saved files are kept as Blobs in an in-memory
 * registry so the report history can list/open/read/delete them for the lifetime of the page; the
 * browser's own download folder is the durable copy.
 */
import { authHeadersFor } from '@/lib/api/client';
import { base64ToBytes, mimeFromFileName, sanitizeFileName } from './fileNames';
import {
  FileOperationError,
  type DownloadOptions,
  type FileData,
  type OpenFileOptions,
  type SaveFileOptions,
  type SavedFileInfo,
  type SavedFileResult,
  type SaveToDownloadsOptions,
  type SaveToDownloadsResult,
} from './files.types';

export * from './files.types';
export { sanitizeFileName } from './fileNames';

type Entry = { blob: Blob; filename: string; mimeType: string; modifiedAt: number };
const registry = new Map<string, Entry>();

function toBlob(data: FileData, mimeType: string, encoding: 'utf8' | 'base64'): Blob {
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data;
  if (typeof data === 'string') {
    if (encoding === 'base64') return new Blob([base64ToBytes(data) as BlobPart], { type: mimeType });
    return new Blob([data], { type: mimeType });
  }
  return new Blob([data as BlobPart], { type: mimeType });
}

/** Triggers a browser download of `blob` as `filename`. */
export function triggerBrowserDownload(blob: Blob | string, filename: string): void {
  if (typeof document === 'undefined') {
    throw new FileOperationError('unavailable', 'Downloads are not available in this environment');
  }
  const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof blob !== 'string') setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function saveAndShareFile(opts: SaveFileOptions): Promise<SavedFileResult> {
  const filename = sanitizeFileName(opts.filename);
  const blob = toBlob(opts.data, opts.mimeType, opts.encoding ?? 'utf8');
  const typed = blob.type === opts.mimeType ? blob : new Blob([blob], { type: opts.mimeType });
  const uri = URL.createObjectURL(typed);
  registry.set(uri, { blob: typed, filename, mimeType: opts.mimeType, modifiedAt: Date.now() });
  if (opts.share !== false) triggerBrowserDownload(uri, filename);
  return { uri, filename, mimeType: opts.mimeType, size: typed.size };
}

/** The server's own `detail` / `message` of a failed download (JSON error body), else `Server returned <status>`. */
async function failureMessage(res: Response): Promise<string> {
  try {
    const body: unknown = JSON.parse(await res.text());
    if (typeof body === 'object' && body !== null) {
      const { detail, message } = body as { detail?: unknown; message?: unknown };
      for (const v of [detail, message]) if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
  } catch {
    /* not JSON: fall through */
  }
  return `Server returned ${res.status}`;
}

export async function downloadAndOpen(opts: DownloadOptions): Promise<SavedFileResult> {
  const filename = sanitizeFileName(opts.filename);
  let res: Response;
  try {
    res = await fetch(opts.url, { headers: { ...authHeadersFor(opts.url), ...(opts.headers ?? {}) } });
  } catch (e) {
    throw new FileOperationError('download_failed', e instanceof Error ? e.message : 'Download failed');
  }
  if (!res.ok) throw new FileOperationError('download_failed', await failureMessage(res));
  const mimeType = opts.mimeType ?? (res.headers.get('content-type')?.split(';')[0] || mimeFromFileName(filename));
  const blob = await res.blob();
  return saveAndShareFile({ filename, mimeType, data: blob, share: opts.open !== false });
}

/** Opens a previously saved file: PDFs/images/HTML open in a new tab, everything else downloads. */
export async function openFile(opts: OpenFileOptions): Promise<void> {
  const entry = registry.get(opts.uri);
  const filename = opts.filename ?? entry?.filename ?? 'file';
  const mimeType = opts.mimeType ?? entry?.mimeType ?? mimeFromFileName(filename);
  const viewable = /^(application\/pdf|image\/|text\/html|text\/plain)/.test(mimeType);
  if (viewable && typeof window !== 'undefined') {
    const w = window.open(opts.uri, '_blank', 'noopener');
    if (w) return;
  }
  triggerBrowserDownload(opts.uri, filename);
}

export async function shareFile(opts: OpenFileOptions): Promise<void> {
  const entry = registry.get(opts.uri);
  const filename = opts.filename ?? entry?.filename ?? 'file';
  const mimeType = opts.mimeType ?? entry?.mimeType ?? mimeFromFileName(filename);
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { canShare?: (d: unknown) => boolean }) : undefined;
  if (entry && nav?.share && nav.canShare) {
    const file = new File([entry.blob], filename, { type: mimeType });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: opts.dialogTitle ?? filename });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return; // user closed the share sheet
      }
    }
  }
  triggerBrowserDownload(opts.uri, filename);
}

/** Web: the "save to Downloads" helper is simply a browser download. */
export async function saveToDownloads(opts: SaveToDownloadsOptions): Promise<SaveToDownloadsResult> {
  triggerBrowserDownload(opts.uri, sanitizeFileName(opts.filename));
  return { saved: true, uri: opts.uri };
}

export async function listSavedFiles(): Promise<SavedFileInfo[]> {
  return [...registry.entries()]
    .map(([uri, e]) => ({ uri, filename: e.filename, mimeType: e.mimeType, size: e.blob.size, modifiedAt: e.modifiedAt }))
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
}

export async function deleteSavedFile(uri: string): Promise<void> {
  if (registry.delete(uri)) URL.revokeObjectURL(uri);
}

export async function readTextFile(uri: string): Promise<string> {
  const entry = registry.get(uri);
  if (entry) return entry.blob.text();
  try {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.text();
  } catch {
    throw new FileOperationError('not_found', 'File is no longer available');
  }
}

/** Returns true when `uri` is still readable (web blob URLs die with the page session). */
export async function savedFileExists(uri: string): Promise<boolean> {
  return registry.has(uri);
}
