/**
 * Work-status state machine (assignment level, `leads_assignment_info.status`).
 *
 *   (none) --admin assigns--> pending
 *   pending | working | completed  <--employee-->  pending | working | completed   (no ordering restriction)
 *   "Carry Forward" is NOT a status change in the app: it opens a carry-forward request (CFR); the status is never
 *   persisted as `carry_forward` by the backend (deferred, see docs/changes/B10.md).
 *   completed leads are locked for the admin (no edit / delete / assign).
 */
import type { LeadWorkStatus } from '@/types/api/leads';

import type { CrmLead } from '../types';

export const WORK_STATUS_LABEL: Record<LeadWorkStatus, string> = {
  pending: 'Pending',
  working: 'Working',
  completed: 'Completed',
  carry_forward: 'Carry Forward',
};

/** Statuses an employee can write directly with `PUT work-status`. */
export const DIRECT_STATUSES: readonly LeadWorkStatus[] = ['pending', 'working', 'completed'];

/** Order of the employee status picker (the last row opens the carry-forward request instead of updating). */
export const EMPLOYEE_STATUS_ORDER: readonly LeadWorkStatus[] = ['pending', 'working', 'completed', 'carry_forward'];

/** An unassigned / unknown status counts as pending (v1 `work_status || 'pending'`). */
export function normaliseWorkStatus(status: LeadWorkStatus | null | undefined): LeadWorkStatus {
  return status ?? 'pending';
}

export type StatusChange = { kind: 'noop' } | { kind: 'update'; status: LeadWorkStatus } | { kind: 'carry_forward' };

/** What picking `next` in the employee status picker does (see the state machine above). */
export function resolveStatusChange(current: LeadWorkStatus | null | undefined, next: LeadWorkStatus): StatusChange {
  if (next === 'carry_forward') return { kind: 'carry_forward' };
  if (normaliseWorkStatus(current) === next) return { kind: 'noop' };
  return { kind: 'update', status: next };
}

/** Admin lock: completed leads cannot be edited, deleted or (re)assigned. */
export function isLeadLocked(lead: Pick<CrmLead, 'workStatus'>): boolean {
  return lead.workStatus === 'completed';
}

export const isAssigned = (lead: Pick<CrmLead, 'assignedUserId'>): boolean => !!lead.assignedUserId;

/** Assign vs reassign is decided by the presence of an assignee (a POST would create a duplicate assignment row). */
export function assignActionFor(lead: Pick<CrmLead, 'assignedUserId'>): 'assign' | 'reassign' {
  return isAssigned(lead) ? 'reassign' : 'assign';
}
