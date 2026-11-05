/** Employee ("My Leads") list logic. */
import type { Lead, LeadWorkStatus, MyCarryForwardRequest } from '@/types/api/leads';

import type { EmployeeStatusFilter } from '../types';
import { normaliseWorkStatus } from './workStatus';

export interface EmployeeLead extends Lead {
  /** The employee's own PENDING carry-forward request for this lead (drives the violet "Carry Forward Requested" card). */
  pendingCfr: MyCarryForwardRequest | null;
  /** Status to show: `carry_forward` while a request is pending, else the assignment status (unknown -> pending). */
  displayStatus: LeadWorkStatus;
}

/**
 * Joins the employee's leads with their own pending carry-forward requests.
 * v1 only showed the pending-request card when the server returned `work_status = carry_forward`, which the backend
 * never persists - so after a refresh the request was invisible. Here the card is driven by the request itself.
 */
export function buildEmployeeLeads(leads: readonly Lead[], myRequests: readonly MyCarryForwardRequest[]): EmployeeLead[] {
  const pending = new Map<string, MyCarryForwardRequest>();
  for (const r of myRequests) {
    if (r.status === 'pending' && r.leadId !== '' && !pending.has(r.leadId)) pending.set(r.leadId, r);
  }
  const seen = new Set<string>();
  const out: EmployeeLead[] = [];
  for (const lead of leads) {
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    const pendingCfr = pending.get(lead.id) ?? null;
    out.push({ ...lead, pendingCfr, displayStatus: pendingCfr ? 'carry_forward' : normaliseWorkStatus(lead.workStatus) });
  }
  return out;
}

/**
 * Status chips. There is intentionally no carry-forward chip (v1). The "assigned today" client filter of v1 is NOT
 * applied: it hid leads assigned on an earlier day even when they were due today; the server already returns only
 * leads dated today or undated.
 */
export function filterEmployeeLeads(leads: readonly EmployeeLead[], filter: EmployeeStatusFilter): EmployeeLead[] {
  return filter === 'all' ? [...leads] : leads.filter((l) => l.displayStatus === filter);
}
