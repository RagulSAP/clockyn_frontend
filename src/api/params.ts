/**
 * Request-building helpers for the core domain modules (dates, uploads). Business dates are IST
 * (`@/lib/datetime`); v1 sent the UTC date of the device clock, which was wrong between 00:00 and 05:30 IST.
 */
import { toDateStr } from '@/lib/datetime';
import type { UploadFile } from '@/lib/api/client';
import type { DateString, UploadFileInput } from '@/types/api/common';
import { resolveMimeType } from './sharedHelpers';

/**
 * `YYYY-MM-DD` (IST) for an API date parameter. Plain date strings pass through unchanged; `Date`s and
 * timestamps are converted to their IST calendar date. `undefined` stays `undefined`; an unparseable
 * value is a programming error and throws.
 */
export function dateParam(value: DateString | Date | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const s = toDateStr(value);
  if (s === '') throw new Error(`Invalid date: ${String(value)}`);
  return s;
}

/** Like `dateParam` but the date is mandatory. */
export function requiredDateParam(value: DateString | Date, name = 'date'): string {
  const s = dateParam(value);
  if (s === undefined) throw new Error(`${name} is required`);
  return s;
}

function extensionOf(mimeType: string): string {
  const sub = mimeType.split('/')[1] ?? 'jpg';
  return sub === 'jpeg' ? 'jpg' : sub.split('+')[0] || 'jpg';
}

/**
 * Describes a picked file for `api.upload`. Photos default to `image/jpeg` and a generated file name
 * (`<baseName>_<timestamp>.<ext>`) when the picker did not provide them.
 */
export function toUploadFile(file: UploadFileInput, fieldName: string, baseName: string): UploadFile {
  const initialMime = file.mimeType && file.mimeType.trim() !== '' ? file.mimeType : 'image/jpeg';
  const fileName = file.fileName && file.fileName.trim() !== '' ? file.fileName : `${baseName}_${Date.now()}.${extensionOf(initialMime)}`;
  return { fileUri: file.uri, fieldName, fileName, mimeType: resolveMimeType(initialMime, fileName) };
}
