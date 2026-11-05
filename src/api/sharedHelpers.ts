/**
 * Small helpers shared by the domain modules owned by the chat / comms / payroll / reports / billing
 * group (`chat`, `groupChat`, `announcements`, `leads`, `payroll`, `salaryReports`, `reports`, `plans`,
 * `billing`, `support`, `system`). Pure functions only (the one side effect is throwing `ApiError`).
 */
import { buildUrl } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import { isRecord, rec } from './mappers/common';
import type { RawRecord } from '@/types/api/common';

/** Query value accepted by the URL helpers; `null`/`undefined`/`''` are dropped. */
export type QueryValue = string | number | boolean | null | undefined;

/** Encodes one URL path segment (ids are normally UUIDs but may come from user input, e.g. invoice numbers). */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

/** `?a=1&b=x` (URL-encoded, empty values dropped); `''` when there is nothing to send. */
export function buildQuery(params: Record<string, QueryValue> = {}): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Absolute backend URL for a path + query (used for file downloads that bypass the JSON client). */
export function apiUrl(path: string, query: Record<string, QueryValue> = {}): string {
  return buildUrl(path, cleanQuery(query));
}

/** Same as `query` but with empty values removed, typed for the client's `query` argument. */
export function cleanQuery(params: Record<string, QueryValue>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    out[key] = value;
  }
  return out;
}

/**
 * Throws an `ApiError` (carrying the server `message`) when a 200 response reports `success: false`.
 * Bodies without a `success` flag (bare arrays/objects) pass.
 */
export function ensureSuccess(body: unknown, fallback: string): void {
  assertSuccess(body, fallback);
}

/** `ensureSuccess` + the body as an object (empty object when the body is not an object). */
export function successBody(body: unknown, fallback: string): RawRecord {
  ensureSuccess(body, fallback);
  return rec(body);
}

/** Server `message` of a write response, falling back to a default. */
export function serverMessage(body: unknown, fallback: string): string {
  const m = isRecord(body) ? body.message : undefined;
  return typeof m === 'string' && m.trim() !== '' ? m.trim() : fallback;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

/** Mime type to upload with: the given one unless missing / `application/octet-stream`, else a guess from the extension. */
export function resolveMimeType(mimeType: string | null | undefined, fileName: string): string {
  const given = (mimeType ?? '').trim();
  if (given !== '' && given.toLowerCase() !== 'application/octet-stream') return given;
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

/** Chat message kind from the wire value (anything unknown is plain text). */
export function mapMessageType(v: unknown): 'text' | 'image' | 'file' {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return s === 'image' || s === 'file' ? s : 'text';
}

/** Returns the trimmed id, or throws when it is empty (guards against building `/x//y` paths). */
export function requireId(value: string | number | null | undefined, name: string): string {
  const s = value === null || value === undefined ? '' : String(value).trim();
  if (s === '') throw new Error(`${name} is required`);
  return s;
}
