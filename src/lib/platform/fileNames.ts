/**
 * Pure helpers for file names / mime types shared by the platform file + export modules.
 * No platform imports — safe in unit tests.
 */

export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'doc';

/** Characters that are illegal in file names on at least one supported OS (plus control chars). */
const ILLEGAL_CHARS = /[\u0000-\u001f\u007f<>:"/\\|?*]+/g;
const MAX_BASE_LENGTH = 120;

/**
 * Makes `name` safe to use as a file name on Android, iOS and the web.
 * Unicode letters/digits are kept (v1 replaced every non-ASCII char with `_`), path separators and
 * reserved characters become `_`, whitespace is collapsed, leading dots/spaces are stripped and the
 * base name is capped (the extension is preserved).
 */
export function sanitizeFileName(name: string, fallback = 'file'): string {
  const raw = (name ?? '').toString().normalize('NFC');
  const dot = raw.lastIndexOf('.');
  const tail = dot > 0 ? raw.slice(dot + 1) : '';
  const hasExt = /^[A-Za-z0-9]{1,10}$/.test(tail);
  const ext = hasExt ? tail.toLowerCase() : '';
  let base = hasExt ? raw.slice(0, dot) : raw;
  base = base
    .replace(ILLEGAL_CHARS, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s_]+|[.\s_]+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .trim();
  // Windows reserved device names.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) base = `_${base}`;
  if (!base) base = fallback;
  return ext ? `${base}.${ext}` : base;
}

export const FORMAT_META: Record<ExportFormat, { ext: string; mimeType: string }> = {
  pdf: { ext: 'pdf', mimeType: 'application/pdf' },
  xlsx: { ext: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  csv: { ext: 'csv', mimeType: 'text/csv' },
  doc: { ext: 'doc', mimeType: 'application/msword' },
};

/** Sanitises `filename` and forces the extension that belongs to `format`. */
export function fileNameForFormat(filename: string, format: ExportFormat): string {
  const { ext } = FORMAT_META[format];
  const safe = sanitizeFileName(filename, 'report');
  const dot = safe.lastIndexOf('.');
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  // Only strip a trailing extension that is a known report/document extension (keeps "Report v1.2").
  const known = dot > 0 ? safe.slice(dot + 1).toLowerCase() : '';
  const stripped = ['pdf', 'xlsx', 'xls', 'csv', 'doc', 'docx', 'html', 'htm', 'txt'].includes(known) ? base : safe;
  return `${stripped}.${ext}`;
}

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html',
  htm: 'text/html',
  txt: 'text/plain',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

/** Best-effort mime type from a file name; falls back to `application/octet-stream`. */
export function mimeFromFileName(filename: string): string {
  return EXT_TO_MIME[extensionOf(filename)] ?? 'application/octet-stream';
}

const MIME_TO_UTI: Record<string, string> = {
  'application/pdf': 'com.adobe.pdf',
  'text/csv': 'public.comma-separated-values-text',
  'text/html': 'public.html',
  'text/plain': 'public.plain-text',
  'application/msword': 'com.microsoft.word.doc',
  'application/vnd.ms-excel': 'com.microsoft.excel.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'org.openxmlformats.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'org.openxmlformats.wordprocessingml.document',
  'image/png': 'public.png',
  'image/jpeg': 'public.jpeg',
};

/** iOS Uniform Type Identifier for a mime type (undefined when unknown — the OS then infers it). */
export function utiForMime(mimeType: string): string | undefined {
  return MIME_TO_UTI[mimeType.split(';')[0].trim().toLowerCase()];
}

/** Decodes base64 into bytes without relying on `atob`/`Buffer` being present (RN, web and node). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]*;base64,/, '').replace(/[\r\n\s]/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  lookup['-'.charCodeAt(0)] = 62;
  lookup['_'.charCodeAt(0)] = 63;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const len = Math.floor((clean.length * 3) / 4) - padding;
  const out = new Uint8Array(Math.max(len, 0));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    const n = ((a & 63) << 18) | ((b & 63) << 12) | ((c & 63) << 6) | (d & 63);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
