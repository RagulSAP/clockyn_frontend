/**
 * Pending / unread model of the admin request badges.
 *
 *  - `pending[type]`  = requests of that type that still need a decision (any pending date, or a pending status).
 *  - `unread[type]`   = pending requests the admin has NOT seen yet. "Seen" is a set of request ids per type that is
 *    replaced by the ids pending at the moment the list of that type is open. So:
 *      * opening a list clears its badge, for every one of the four types (v1 only did it for leave);
 *      * handling requests never hides new ones (v1 kept a high-water COUNT, so after handling 2 and receiving 2
 *        the badge stayed at 0);
 *      * the set never grows beyond the pending requests.
 *  The Home tile keeps showing `pending.total` (v1 behaviour).
 */
import { hasPending } from '@/api/mappers/requests';
import type { RequestType, StaffRequest } from '@/types/api/requests';

import { REQUEST_TYPES } from './requestLogic';

export type TypeCounts = Record<RequestType, number> & { total: number };
export type SeenIds = Partial<Record<RequestType, readonly string[]>>;

export const ZERO_COUNTS: TypeCounts = { leave: 0, permission: 0, shift_change: 0, device_change: 0, total: 0 };

function withTotal(c: Record<RequestType, number>): TypeCounts {
  return { ...c, total: c.leave + c.permission + c.shift_change + c.device_change };
}

/** Ids of the pending requests of one type. */
export function pendingIds(requests: readonly StaffRequest[], type: RequestType): string[] {
  return requests.filter((r) => r.type === type && hasPending(r)).map((r) => r.id);
}

export function countPending(requests: readonly StaffRequest[]): TypeCounts {
  const out = { leave: 0, permission: 0, shift_change: 0, device_change: 0 };
  for (const t of REQUEST_TYPES) out[t] = pendingIds(requests, t).length;
  return withTotal(out);
}

/** Pending requests whose id is not in the seen set of their type. */
export function countUnread(requests: readonly StaffRequest[], seen: SeenIds | undefined): TypeCounts {
  const out = { leave: 0, permission: 0, shift_change: 0, device_change: 0 };
  for (const t of REQUEST_TYPES) {
    const known = new Set(seen?.[t] ?? []);
    out[t] = pendingIds(requests, t).filter((id) => !known.has(id)).length;
  }
  return withTotal(out);
}

/** True when two id lists hold the same ids (order-insensitive). */
export function sameIds(a: readonly string[] | undefined, b: readonly string[]): boolean {
  if (!a) return b.length === 0;
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** Badge text: nothing for 0, `99+` above 99. */
export function badgeText(count: number): string | null {
  if (!(count > 0)) return null;
  return count > 99 ? '99+' : String(Math.floor(count));
}
