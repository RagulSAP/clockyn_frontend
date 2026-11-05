/**
 * Helpers for the backend's response envelopes (shared/api/README.md §3).
 * Domain modules use these so `{ success: false }` bodies delivered with HTTP 200 become `ApiError`s.
 */
import { businessError } from './errors';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** True when the body explicitly says `success: false` (also `success: 'false'` / 0). */
export function isFailureBody(body: unknown): boolean {
  if (!isRecord(body) || !('success' in body)) return false;
  const s = body.success;
  return s === false || s === 0 || s === 'false';
}

/** Throws `ApiError` (status 200, server message) for `{ success: false }`; otherwise returns the body unchanged. */
export function assertSuccess<T>(body: T, fallbackMessage?: string): T {
  if (isFailureBody(body)) throw businessError(body, fallbackMessage);
  return body;
}

/** `{ success, data }` -> `data` (throws on `success:false`). A bare value is returned as is. */
export function unwrapData<T>(body: unknown, key = 'data'): T {
  assertSuccess(body);
  if (isRecord(body) && key in body) return body[key] as T;
  return body as T;
}

/** Normalise "bare array" and "{ success, data: [] }" (or custom key) responses into an array. Never returns null. */
export function unwrapList<T>(body: unknown, key = 'data'): T[] {
  assertSuccess(body);
  if (Array.isArray(body)) return body as T[];
  if (isRecord(body)) {
    const v = body[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}
