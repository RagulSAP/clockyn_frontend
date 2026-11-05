/** Lead list logic shared by the admin hub and the assign list: merge, dedupe, overview counts, sorting. */
import type { CarryForwardRequest, Lead } from '@/types/api/leads';

import type { CrmLead, StatFilter } from '../types';
import { attachCarryForwardLatest } from './carryForward';
import { matchesLeadDate } from './dates';
import { isAssigned, normaliseWorkStatus } from './workStatus';

/**
 * `GET /api/leads/{org}` returns one row per (lead x assignment). v1 rendered every row (duplicate cards / keys).
 * Rows of the same lead are merged: the first assigned row is the primary one, the assignee names of any extra
 * assignment rows are joined for display.
 */
export function dedupeLeads(rows: readonly Lead[]): Lead[] {
  const groups = new Map<string, Lead[]>();
  for (const row of rows) {
    const list = groups.get(row.id);
    if (list) list.push(row);
    else groups.set(row.id, [row]);
  }
  const out: Lead[] = [];
  for (const group of groups.values()) {
    const primary = group.find((r) => r.assignedUserId) ?? group[0];
    if (group.length === 1) {
      out.push(primary);
      continue;
    }
    const names: string[] = [];
    for (const r of group) {
      if (r.assignedUserName && !names.includes(r.assignedUserName)) names.push(r.assignedUserName);
    }
    out.push({ ...primary, assignedUserName: names.length > 0 ? names.join(', ') : primary.assignedUserName });
  }
  return out;
}

/** Admin lead rows + carry-forward requests -> one CrmLead per lead. */
export function buildCrmLeads(rows: readonly Lead[], requests: readonly CarryForwardRequest[]): CrmLead[] {
  return attachCarryForwardLatest(dedupeLeads(rows), requests);
}

export type Bucket = Exclude<StatFilter, 'total'>;

/**
 * Overview bucket of a lead. A lead with status `carry_forward` counts as carry-forward even without an assignee;
 * otherwise unassigned leads are `unassigned`. Used for BOTH counts and the filtered list (v1 disagreed).
 */
export function bucketOf(lead: Pick<CrmLead, 'assignedUserId' | 'workStatus'>): Bucket {
  if (lead.workStatus === 'carry_forward') return 'carry_forward';
  if (!isAssigned(lead)) return 'unassigned';
  return normaliseWorkStatus(lead.workStatus) as Bucket;
}

export type BucketCounts = Record<StatFilter, number>;

export function countBuckets(leads: readonly CrmLead[]): BucketCounts {
  const counts: BucketCounts = { total: leads.length, unassigned: 0, pending: 0, working: 0, completed: 0, carry_forward: 0 };
  for (const lead of leads) counts[bucketOf(lead)] += 1;
  return counts;
}

export function filterByStat(leads: readonly CrmLead[], filter: StatFilter): CrmLead[] {
  return filter === 'total' ? [...leads] : leads.filter((l) => bucketOf(l) === filter);
}

export function filterByDate(leads: readonly CrmLead[], selected: string): CrmLead[] {
  return leads.filter((l) => matchesLeadDate(l, selected));
}

/** Completed leads last; otherwise the server order is kept (stable). */
export function sortCompletedLast<T extends Pick<CrmLead, 'workStatus'>>(leads: readonly T[]): T[] {
  return [...leads.filter((l) => l.workStatus !== 'completed'), ...leads.filter((l) => l.workStatus === 'completed')];
}

/** "N leads today" on the hub menu card. */
export function countForDay(leads: readonly CrmLead[], day: string): number {
  return leads.filter((l) => l.effectiveDate === day).length;
}

export function leadsTodayLabel(n: number): string {
  return `${n} ${n === 1 ? 'lead' : 'leads'} today`;
}

/** Same employee can appear twice in the picker list (v1 de-duplicated by `user_id`). */
export function uniqueByUserId<T extends { userId: string }>(items: readonly T[], excludeUserId?: string | null): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (item.userId === '' || seen.has(item.userId) || item.userId === excludeUserId) continue;
    seen.add(item.userId);
    out.push(item);
  }
  return out;
}
