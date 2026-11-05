/**
 * Pure helpers shared by every mapper: defensive readers for loosely-typed server JSON and
 * normalisers for the legacy date/time/number formats. No imports from the app (unit-testable).
 */
import type { RawRecord, RoleId } from '@/types/api/common';

export function isRecord(v: unknown): v is RawRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Object view of `v` (empty object when it is not an object). */
export function rec(v: unknown): RawRecord {
  return isRecord(v) ? v : {};
}

/** Array view of `v` (empty array when it is not an array). */
export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** String view: null/undefined -> fallback; numbers/booleans are stringified; strings are trimmed. */
export function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

/** Like `str` but empty strings become `undefined`. */
export function optStr(v: unknown): string | undefined {
  const s = str(v);
  return s === '' ? undefined : s;
}

/** Numeric view; accepts numeric strings (`"8.5"`); anything else -> fallback. */
export function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Like `num` but `undefined` when the value is missing or not numeric. */
export function optNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = num(v, Number.NaN);
  return Number.isNaN(n) ? undefined : n;
}

/** Boolean view: `true`, `1`, `"1"`, `"true"`, `"yes"` are truthy. */
export function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'y'].includes(v.trim().toLowerCase());
  return false;
}

/** Normalises a legacy role id (number or numeric string) into 1 | 2 | 3. */
export function roleId(v: unknown): RoleId | undefined {
  const n = optNum(v);
  return n === 1 || n === 2 || n === 3 ? n : undefined;
}

/**
 * Extracts a list from any of the list envelopes the server uses: a bare array, `{data: []}`,
 * `{sessions: []}`, `{shifts: []}`, ...
 */
export function listOf(body: unknown, keys: string[] = ['data']): RawRecord[] {
  const candidates: unknown[] = [body];
  if (isRecord(body)) for (const k of keys) candidates.push(body[k]);
  for (const c of candidates) {
    if (Array.isArray(c)) return c.filter(isRecord);
  }
  return [];
}

/** Extracts an object from `{data: {...}}` or a bare object body. */
export function objectOf(body: unknown, keys: string[] = ['data']): RawRecord {
  if (isRecord(body)) {
    for (const k of keys) {
      if (isRecord(body[k])) return body[k] as RawRecord;
    }
    return body;
  }
  return {};
}

/** First present value among the candidate keys (legacy name inconsistencies). */
export function pick(r: RawRecord, ...keys: string[]): unknown {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null) return r[k];
  }
  return undefined;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** `YYYY-MM-DD` from a date or ISO timestamp string; `undefined` when not parseable. Does not shift time zones. */
export function dateOnly(v: unknown): string | undefined {
  const s = str(v);
  const m = DATE_RE.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*([AaPp][Mm])?$/;

/**
 * Converts the many wire time formats (`"09:15 AM"`, `"09:15:30 AM"`, `"09:30AM"`, `"14:05"`, `"14:05:00"`)
 * into `HH:mm` (24-hour). Returns `undefined` for empty / unparseable values.
 */
export function toHHmm(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const m = TIME_RE.exec(s);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const meridiem = m[4]?.toUpperCase();
  if (min > 59) return undefined;
  if (meridiem) {
    if (h < 1 || h > 12) return undefined;
    h = (h % 12) + (meridiem === 'PM' ? 12 : 0);
  } else if (h > 23) {
    return undefined;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** `HH:mm` -> the compact `hh:mmAM` form the shift endpoints use (`"09:30AM"`). */
export function toCompact12h(hhmm: string): string {
  const t = toHHmm(hhmm);
  if (!t) throw new Error(`Invalid time "${hhmm}"`);
  const [hs, ms] = t.split(':');
  const h = Number(hs);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${ms}${meridiem}`;
}

/** Hours as a number from `"8.5"`, `8.5`, `null`. */
export function hours(v: unknown): number | undefined {
  return optNum(v);
}

/** Parses a `"lat,lng"` pair into numbers. */
export function parseLatLng(v: unknown): { latitude: number; longitude: number } | undefined {
  const s = str(v);
  if (!s) return undefined;
  const parts = s.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return undefined;
  return { latitude: parts[0], longitude: parts[1] };
}

/** `message` field of a write response, with a fallback. */
export function messageOf(body: unknown, fallback = ''): string {
  const m = rec(body).message;
  return typeof m === 'string' && m.trim() ? m.trim() : fallback;
}

/** True when the body is an envelope that explicitly reports `success: false`. */
export function isFailureBody(body: unknown): boolean {
  return isRecord(body) && body.success === false;
}
