/**
 * Shared primitive types used across features.
 * API DTOs live in `src/types/api/*` (owned by the API layer); the Session type lives in `@/store/auth`.
 */
import type { RoleId } from '@/config/routes';

export type { RoleId };

/** Opaque identifier as sent by the backend (UUID strings, but some ids are numeric strings). */
export type Id = string;

/** Calendar date, `YYYY-MM-DD` (business time is IST — see `@/lib/datetime`). */
export type ISODate = string;

/** Absolute timestamp, ISO-8601 (usually UTC with `Z` / `+00:00`). */
export type ISOTimestamp = string;

/** Time of day: `HH:mm` (24h) when sent to the API, or a display string such as `09:15 AM`. */
export type TimeOfDay = string;

/** `YYYY-MM` path segment used by report endpoints. */
export type ISOMonth = string;

/** Month number 1-12. */
export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Generic list wrapper for locally paginated / enveloped results. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Inclusive date range (`YYYY-MM-DD` both ends). */
export interface DateRange {
  start: ISODate;
  end: ISODate;
}

/** Make selected keys optional. */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** `T | null | undefined`. */
export type Maybe<T> = T | null | undefined;

/** Build a `Paginated` result from an already-loaded array slice. */
export function paginate<T>(all: readonly T[], page: number, pageSize: number): Paginated<T> {
  const safeSize = Math.max(1, Math.floor(pageSize) || 1);
  const safePage = Math.max(1, Math.floor(page) || 1);
  const start = (safePage - 1) * safeSize;
  const items = all.slice(start, start + safeSize);
  return { items, total: all.length, page: safePage, pageSize: safeSize, hasMore: start + items.length < all.length };
}
