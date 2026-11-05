/**
 * Files — NATIVE implementation (Android / iOS).
 * Uses the SDK 58 object API of expo-file-system (`File`, `Directory`, `Paths`), expo-sharing for the
 * share sheet and expo-intent-launcher for the Android "open with" (VIEW) intent.
 */
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { authHeadersFor } from '@/lib/api/client';
import { mimeFromFileName, sanitizeFileName, utiForMime } from './fileNames';
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

const FLAG_GRANT_READ_URI_PERMISSION = 1;
const SAVED_DIR_NAME = 'clockyn-files';

/** App-private, persistent folder that holds generated/downloaded files (report history). */
function savedDir(): Directory {
  const dir = new Directory(Paths.document, SAVED_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function toBytes(data: FileData): Promise<Uint8Array> {
  if (typeof data === 'string') throw new Error('toBytes: string handled by caller');
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(await (data as Blob).arrayBuffer());
}

async function writeInto(file: File, data: FileData, encoding: 'utf8' | 'base64'): Promise<void> {
  if (file.exists) file.delete();
  file.create({ intermediates: true, overwrite: true });
  if (typeof data === 'string') {
    if (encoding === 'base64') await file.write(data, { encoding: 'base64' });
    else await file.write(data);
    return;
  }
  await file.write(await toBytes(data));
}

export async function shareFile(opts: OpenFileOptions): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new FileOperationError('unavailable', 'Sharing is not available on this device.');
  }
  const mimeType = opts.mimeType ?? mimeFromFileName(opts.filename ?? opts.uri);
  await Sharing.shareAsync(opts.uri, {
    mimeType,
    UTI: utiForMime(mimeType),
    dialogTitle: opts.dialogTitle ?? opts.filename,
  });
}

/**
 * Opens a saved file in an external viewer.
 * Android: VIEW intent with a content:// uri (falls back to the share sheet when no app can handle it).
 * iOS: share sheet / Quick Look handoff (the iOS equivalent of "open in…").
 */
export async function openFile(opts: OpenFileOptions): Promise<void> {
  const file = new File(opts.uri);
  if (!file.exists) throw new FileOperationError('not_found', 'The file is no longer available.');
  const mimeType = opts.mimeType ?? mimeFromFileName(opts.filename ?? opts.uri);
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: file.contentUri,
        flags: FLAG_GRANT_READ_URI_PERMISSION,
        type: mimeType,
      });
      return;
    } catch {
      // No viewer installed for this type — let the user pick any target through the share sheet.
    }
  }
  await shareFile({ ...opts, mimeType });
}

export async function saveAndShareFile(opts: SaveFileOptions): Promise<SavedFileResult> {
  const filename = sanitizeFileName(opts.filename);
  const file = new File(savedDir(), filename);
  try {
    await writeInto(file, opts.data, opts.encoding ?? 'utf8');
  } catch (e) {
    throw new FileOperationError('write_failed', e instanceof Error ? e.message : 'Could not save the file');
  }
  if (opts.share !== false) {
    await shareFile({ uri: file.uri, mimeType: opts.mimeType, filename, dialogTitle: opts.dialogTitle });
  }
  return { uri: file.uri, filename, mimeType: opts.mimeType, size: file.size };
}

export async function downloadAndOpen(opts: DownloadOptions): Promise<SavedFileResult> {
  const filename = sanitizeFileName(opts.filename);
  const dest = new File(savedDir(), filename);
  if (dest.exists) dest.delete();
  let saved: File;
  try {
    saved = await File.downloadFileAsync(opts.url, dest, { headers: { ...authHeadersFor(opts.url), ...(opts.headers ?? {}) }, idempotent: true });
  } catch (e) {
    if (dest.exists) dest.delete(); // never leave an error body behind as a "report"
    throw new FileOperationError('download_failed', e instanceof Error ? e.message : 'Download failed');
  }
  const mimeType = opts.mimeType ?? mimeFromFileName(filename);
  if (opts.open !== false) await openFile({ uri: saved.uri, mimeType, filename });
  return { uri: saved.uri, filename, mimeType, size: saved.size };
}

/**
 * "Save a copy to Downloads / any folder".
 * Android: Storage Access Framework — the user picks a folder once (e.g. Downloads) and we write the file there.
 * iOS: the share sheet already offers "Save to Files".
 */
export async function saveToDownloads(opts: SaveToDownloadsOptions): Promise<SaveToDownloadsResult> {
  if (Platform.OS !== 'android') {
    await shareFile({ uri: opts.uri, mimeType: opts.mimeType, filename: opts.filename });
    return { saved: true, uri: opts.uri };
  }
  let target: Directory;
  try {
    target = await Directory.pickDirectoryAsync();
  } catch {
    return { saved: false, cancelled: true };
  }
  try {
    const source = new File(opts.uri);
    const bytes = await source.bytes();
    const dest = target.createFile(sanitizeFileName(opts.filename), opts.mimeType);
    await dest.write(bytes);
    return { saved: true, uri: dest.uri };
  } catch (e) {
    throw new FileOperationError('write_failed', e instanceof Error ? e.message : 'Could not save the file');
  }
}

export async function listSavedFiles(): Promise<SavedFileInfo[]> {
  const dir = savedDir();
  const out: SavedFileInfo[] = [];
  for (const item of dir.list()) {
    if (!(item instanceof File)) continue;
    out.push({
      uri: item.uri,
      filename: item.name,
      mimeType: mimeFromFileName(item.name),
      size: item.size ?? undefined,
      modifiedAt: item.modificationTime ?? undefined,
    });
  }
  return out.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
}

export async function deleteSavedFile(uri: string): Promise<void> {
  const file = new File(uri);
  if (file.exists) file.delete();
}

export async function readTextFile(uri: string): Promise<string> {
  const file = new File(uri);
  if (!file.exists) throw new FileOperationError('not_found', 'The file is no longer available.');
  return file.text();
}

export async function savedFileExists(uri: string): Promise<boolean> {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
