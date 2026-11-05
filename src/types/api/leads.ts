/** DTOs for CRM leads (`src/api/leads.ts`). */
import type { DateString, RawRecord } from './common';

/** Work status an employee sets on an assigned lead. */
export type LeadWorkStatus = 'pending' | 'working' | 'completed' | 'carry_forward';

/** Pipeline status (`PUT /api/leads/{id}/status`); not used by the v1 screens but exposed by the backend. */
export type LeadPipelineStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'not_interested';

/** Status of a carry-forward request. */
export type CarryForwardStatus = 'pending' | 'approved' | 'rejected';

/** A lead (admin list or employee list). */
export interface Lead {
  /** `leads_id`. */
  id: string;
  clientName: string;
  mobile: string;
  address: string;
  categoryName: string;
  remarks: string;
  /**
   * The "required date" the lead is meant to be worked on (wire `created_date`); `null` when not set.
   * Pass it back unchanged as `requiredDate` when editing, otherwise the server blanks it.
   */
  requiredDate: DateString | null;
  /** IST calendar date the lead record was created (from `created_at`). */
  createdOn: DateString | null;
  /** ISO timestamp the lead record was created. */
  createdAt: string | null;
  /** Date the lead is shown under in date filters: the required date, else the creation date. */
  effectiveDate: DateString | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  /** Work status of the current assignment; `null` while unassigned. */
  workStatus: LeadWorkStatus | null;
  /** ISO timestamp of the last assignment change. */
  assignedAt: string | null;
  /** Pipeline status (employee list only). */
  pipelineStatus: string | null;
  raw: RawRecord;
}

/** Create / update input. `requiredDate` is optional but must be passed through on edit. */
export interface LeadInput {
  orgId: string;
  name: string;
  mobile: string;
  address: string;
  category: string;
  remarks?: string;
  requiredDate?: DateString | null;
}

/** A lead category. */
export interface LeadCategory {
  id: string;
  name: string;
}

/** A carry-forward request as seen by the admin. */
export interface CarryForwardRequest {
  id: string;
  leadId: string;
  userId: string;
  employeeName: string;
  description: string;
  /** Date the employee wants the lead forwarded to. */
  requestDate: DateString | null;
  status: CarryForwardStatus;
  createdAt: string | null;
  clientName: string;
  leadDate: DateString | null;
  raw: RawRecord;
}

/** A carry-forward request raised by the signed-in employee. */
export interface MyCarryForwardRequest {
  id: string;
  leadId: string;
  description: string;
  requestDate: DateString | null;
  status: CarryForwardStatus;
  actionedAt: string | null;
  clientName: string;
  forwardedDate: DateString | null;
  mobile: string;
  address: string;
  categoryName: string;
  workStatus: LeadWorkStatus | null;
  raw: RawRecord;
}

/** Input of `assignLead`. */
export interface AssignLeadInput {
  leadId: string;
  orgId: string;
  userId: string;
  branchId?: number | string | null;
  deptId?: string | null;
  remarks?: string;
  requestDate?: DateString | null;
}

/** Input of `reassignLead`. */
export interface ReassignLeadInput {
  leadId: string;
  userId: string;
  branchId?: number | string | null;
  deptId?: string | null;
}

/** Input of `requestCarryForward`. */
export interface CarryForwardInput {
  leadId: string;
  orgId: string;
  userId: string;
  description: string;
  forwardDate?: DateString | null;
}

/** Carry-forward info attached to a lead by `attachCarryForward`. */
export interface LeadCarryForward {
  requestId: string;
  status: 'pending' | 'approved';
  /** Name of the employee who asked to carry the lead forward. */
  previousStaffName: string;
  previousStaffId: string;
}

/** A lead with its (pending/approved) carry-forward request, if any. */
export type LeadWithCarryForward = Lead & { carryForward: LeadCarryForward | null };

/** Update input: `requiredDate` must be passed explicitly (use `lead.requiredDate`) or the server blanks it. */
export type UpdateLeadInput = Omit<LeadInput, 'requiredDate'> & { requiredDate: DateString | null };
