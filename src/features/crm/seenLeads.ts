/**
 * `crmSeen` - which employee leads a user has already seen, and the CRM tab badge derived from it.
 *
 * - Roles 2 (manager) and 3 (staff) only; admins never get a badge (v1).
 * - The seen list is stored on this device, scoped to the user (`STORAGE_KEYS.crmSeenLeadIds:<userId>`) and wiped on
 *   sign-out (`SESSION_SCOPED_KEYS`).
 * - Badge = number of leads of the employee list (server: dated today or undated) whose id is not in the seen list.
 * - Opening the CRM tab marks every fetched lead as seen (overwrite, like v1) and clears the badge.
 */
import { STORAGE_KEYS, getJSON, setJSON, storageKeyFor } from '@/lib/storage';
import { badges } from '@/store/badges';

/** Roles that receive the CRM badge. */
export function tracksCrmBadge(roleId: number | null | undefined): boolean {
  return roleId === 2 || roleId === 3;
}

export const seenStorageKey = (userId: string): string => storageKeyFor(STORAGE_KEYS.crmSeenLeadIds, userId);

const asIds = (ids: readonly (string | number)[]): string[] => ids.map((id) => String(id));

/** Number of lead ids that are not in `seen`. */
export function countUnseen(leadIds: readonly (string | number)[], seen: readonly string[]): number {
  const seenSet = new Set(seen);
  return new Set(asIds(leadIds).filter((id) => id !== '' && !seenSet.has(id))).size;
}

export async function readSeenIds(userId: string): Promise<string[]> {
  if (userId === '') return [];
  const stored = await getJSON<unknown>(seenStorageKey(userId), []);
  return Array.isArray(stored) ? stored.map((v) => String(v)) : [];
}

export async function writeSeenIds(userId: string, ids: readonly (string | number)[]): Promise<void> {
  if (userId === '') return;
  await setJSON(seenStorageKey(userId), asIds(ids));
}

/** Unseen count for the fetched list. */
export async function computeUnseen(userId: string, leadIds: readonly (string | number)[]): Promise<number> {
  return countUnseen(leadIds, await readSeenIds(userId));
}

/** Recomputes the badge from a freshly fetched list and publishes it to the badge store. */
export async function syncCrmBadge(userId: string, roleId: number | null | undefined, leadIds: readonly (string | number)[]): Promise<number> {
  if (!tracksCrmBadge(roleId) || userId === '') return 0;
  const n = await computeUnseen(userId, leadIds);
  badges.set('crm', n);
  return n;
}

/** The CRM tab was opened with this list: everything counts as seen and the badge clears. */
export async function markCrmSeen(userId: string, leadIds: readonly (string | number)[]): Promise<void> {
  badges.markRead('crm');
  await writeSeenIds(userId, leadIds);
}

export const crmSeen = { tracks: tracksCrmBadge, countUnseen, readSeenIds, writeSeenIds, computeUnseen, syncBadge: syncCrmBadge, markSeen: markCrmSeen };
