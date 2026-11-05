/**
 * Carry-forward request (CFR) lifecycle mapping.
 *
 * Lifecycle (backend semantics, unchanged):
 *   1. employee raises a CFR for a lead they hold            -> CFR `pending`, lead stays assigned to them
 *   2. admin approves  -> CFR `approved`; the lead's required date moves to the forward date and the employee's
 *      assignment row is DELETED (lead becomes unassigned)
 *      admin rejects   -> CFR `rejected`; lead and assignment untouched
 *   3. admin assigns the lead to someone else; the approved CFR stays in the list forever, so the lead keeps its
 *      "CFR" marker ("CFR Assigned").
 *
 * v1 attached the OLDEST pending/approved CFR to a lead (last write wins over a newest-first list). Fixed here: a
 * pending request always wins, otherwise the newest approved one.
 */
import type { CarryForwardRequest, Lead, LeadCarryForward } from '@/types/api/leads';

import type { CrmLead } from '../types';
import { matchesSubmittedDate } from './dates';

const createdKey = (r: CarryForwardRequest): string => r.createdAt ?? '';

/** Whether `candidate` should replace `current` as the request shown for a lead. */
function beats(candidate: CarryForwardRequest, current: CarryForwardRequest): boolean {
  const cp = candidate.status === 'pending';
  const kp = current.status === 'pending';
  if (cp !== kp) return cp;
  return createdKey(candidate) > createdKey(current);
}

/** One carry-forward marker per lead id (only pending / approved requests count). */
export function indexCarryForward(requests: readonly CarryForwardRequest[]): Map<string, LeadCarryForward> {
  const chosen = new Map<string, CarryForwardRequest>();
  for (const req of requests) {
    if (req.leadId === '' || (req.status !== 'pending' && req.status !== 'approved')) continue;
    const current = chosen.get(req.leadId);
    if (!current || beats(req, current)) chosen.set(req.leadId, req);
  }
  const out = new Map<string, LeadCarryForward>();
  for (const [leadId, req] of chosen) {
    out.set(leadId, {
      requestId: req.id,
      status: req.status as 'pending' | 'approved',
      previousStaffName: req.employeeName,
      previousStaffId: req.userId,
    });
  }
  return out;
}

export function attachCarryForwardLatest(leads: readonly Lead[], requests: readonly CarryForwardRequest[]): CrmLead[] {
  const index = indexCarryForward(requests);
  return leads.map((lead) => ({ ...lead, carryForward: index.get(lead.id) ?? null }));
}

export type CfrState = 'none' | 'pending' | 'approved' | 'assigned';

/** `assigned` = approved and given to someone else; `approved` = approved and waiting for a new assignee. */
export function cfrStateOf(lead: Pick<CrmLead, 'carryForward' | 'assignedUserId'>): CfrState {
  const cf = lead.carryForward;
  if (!cf) return 'none';
  if (cf.status === 'pending') return 'pending';
  return lead.assignedUserId ? 'assigned' : 'approved';
}

/** Second line of a hub lead row for carry-forward leads (`null` -> show the assignee instead). */
export function cfrRowLine(lead: Pick<CrmLead, 'carryForward' | 'assignedUserId'>): string | null {
  const cf = lead.carryForward;
  if (!cf || !cf.previousStaffName) return null;
  const state = cfrStateOf(lead);
  const label = state === 'assigned' ? 'CFR Assigned' : state === 'approved' ? 'CFR Approved' : 'CFR Pending';
  return `${label} • Prev: ${cf.previousStaffName}`;
}

/** Headline of the carry-forward banner on the assign list (`null` when the lead has no CFR). */
export function cfrBannerTitle(lead: Pick<CrmLead, 'carryForward' | 'assignedUserId'>): string | null {
  switch (cfrStateOf(lead)) {
    case 'assigned':
      return 'CFR Assigned';
    case 'approved':
      return 'CFR Approved — Assign New Staff';
    case 'pending':
      return 'Carry Forward Requested';
    default:
      return null;
  }
}

/** Headline inside the assign view (no `CFR Assigned` variant there). */
export function cfrAssignViewTitle(lead: Pick<CrmLead, 'carryForward'>): string | null {
  const cf = lead.carryForward;
  if (!cf) return null;
  return cf.status === 'approved' ? 'CFR Approved — Assign New Staff' : 'Carry Forward Requested';
}

/** Title suffix of the assign screen header. */
export function assignViewTitle(lead: Pick<CrmLead, 'carryForward' | 'assignedUserId'>): string {
  if (lead.carryForward) return 'Assign Lead (CFR)';
  return lead.assignedUserId ? 'Reassign Lead' : 'Assign Lead';
}

/**
 * CFR list ordering: pending first, then actioned; server order inside each group; de-duplicated by request id.
 * `submittedOn` filters by the submission day ('' = all).
 */
export function orderCfrRequests(requests: readonly CarryForwardRequest[], submittedOn = ''): CarryForwardRequest[] {
  const seen = new Set<string>();
  const unique: CarryForwardRequest[] = [];
  for (const r of requests) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (matchesSubmittedDate(r, submittedOn)) unique.push(r);
  }
  return [...unique.filter((r) => r.status === 'pending'), ...unique.filter((r) => r.status !== 'pending')];
}

export const pendingCfrCount = (requests: readonly CarryForwardRequest[]): number =>
  requests.filter((r) => r.status === 'pending').length;
