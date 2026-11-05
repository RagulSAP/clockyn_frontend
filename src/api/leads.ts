/**
 * CRM leads API — `/api/leads/*`: create / update / delete / list / assign / reassign, categories,
 * carry-forward requests & approvals, employee leads, work-status updates.
 *
 * Decisions
 *  - Server plan-gating (`crm`) applies to create, assign, admin list and employee list (403 `detail`).
 *  - Fix (FIX_POLICY B6): the lead's "required date" is exposed as `requiredDate` in BOTH the DTO and the
 *    create/update inputs, so an edit round-trips it (v1 mixed `createdDate`/`requiredDate` and blanked it).
 *  - `POST /api/leads/{id}/request` (staff note on a lead) is not ported: the backend has no such route (dead).
 *  - Carry-forward lifecycle semantics (never persisted on the lead, approved CFRs stay forever) are DEFERRED
 *    and kept as in v1; `attachCarryForward` reproduces the v1 merge (pending/approved only, last row wins).
 */
import { api } from '@/lib/api/client';
import { toDateStr } from '@/lib/datetime';
import type {
  AssignLeadInput,
  CarryForwardInput,
  CarryForwardRequest,
  CarryForwardStatus,
  Lead,
  LeadCarryForward,
  LeadCategory,
  LeadInput,
  LeadPipelineStatus,
  LeadWithCarryForward,
  LeadWorkStatus,
  MyCarryForwardRequest,
  ReassignLeadInput,
  UpdateLeadInput,
} from '@/types/api/leads';
import { dateOnly, listOf, optStr, rec, str } from './mappers/common';
import { buildQuery, ensureSuccess, requireId, seg, successBody } from './sharedHelpers';

const WORK_STATUSES: readonly LeadWorkStatus[] = ['pending', 'working', 'completed', 'carry_forward'];
const CFR_STATUSES: readonly CarryForwardStatus[] = ['pending', 'approved', 'rejected'];

/** Normalises a wire work status (`"carry forward"`, `"Working"`, ...); `null` when empty / unknown. */
export function mapWorkStatus(v: unknown): LeadWorkStatus | null {
  const s = str(v).toLowerCase().replace(/[\s-]+/g, '_');
  return (WORK_STATUSES as readonly string[]).includes(s) ? (s as LeadWorkStatus) : null;
}

/** Normalises a wire carry-forward request status (unknown values count as `pending`). */
export function mapCarryForwardStatus(v: unknown): CarryForwardStatus {
  const s = str(v).toLowerCase();
  return (CFR_STATUSES as readonly string[]).includes(s) ? (s as CarryForwardStatus) : 'pending';
}

/** Maps one wire lead row (admin or employee list) to a `Lead`. */
export function mapLead(input: unknown): Lead {
  const r = rec(input);
  const requiredDate = dateOnly(r.created_date) ?? null;
  const createdAt = optStr(r.created_at) ?? null;
  const createdOn = createdAt ? toDateStr(createdAt) || null : null;
  return {
    id: str(r.leads_id),
    clientName: str(r.client_name),
    mobile: str(r.mobile_number),
    address: str(r.client_address),
    categoryName: str(r.category_name),
    remarks: str(r.remarks),
    requiredDate,
    createdOn,
    createdAt,
    effectiveDate: requiredDate ?? createdOn,
    assignedUserId: optStr(r.assigned_user_id) ?? null,
    assignedUserName: optStr(r.assigned_user_name) ?? null,
    workStatus: mapWorkStatus(r.work_status),
    assignedAt: optStr(r.assigned_at) ?? null,
    pipelineStatus: optStr(r.lead_status) ?? null,
    raw: r,
  };
}

/** Maps one wire category row to a `LeadCategory` (the id falls back to the name when the server omits it). */
export function mapLeadCategory(input: unknown): LeadCategory {
  const r = rec(input);
  const name = str(r.category_name);
  return { id: str(r.category_id ?? r.id, name), name };
}

/** Maps one admin carry-forward request row. */
export function mapCarryForwardRequest(input: unknown): CarryForwardRequest {
  const r = rec(input);
  return {
    id: str(r.request_id),
    leadId: str(r.leads_id),
    userId: str(r.user_id),
    employeeName: str(r.employee_name),
    description: str(r.description),
    requestDate: dateOnly(r.request_date ?? r.crf_request_date) ?? null,
    status: mapCarryForwardStatus(r.status),
    createdAt: optStr(r.created_at) ?? null,
    clientName: str(r.client_name),
    leadDate: dateOnly(r.lead_date) ?? null,
    raw: r,
  };
}

/** Maps one "my carry-forward request" row (employee). */
export function mapMyCarryForwardRequest(input: unknown): MyCarryForwardRequest {
  const r = rec(input);
  return {
    id: str(r.request_id),
    leadId: str(r.leads_id),
    description: str(r.description),
    requestDate: dateOnly(r.request_date) ?? null,
    status: mapCarryForwardStatus(r.status),
    actionedAt: optStr(r.actioned_at) ?? null,
    clientName: str(r.client_name),
    forwardedDate: dateOnly(r.forwarded_date) ?? null,
    mobile: str(r.mobile_number),
    address: str(r.client_address),
    categoryName: str(r.category_name),
    workStatus: mapWorkStatus(r.work_status),
    raw: r,
  };
}

/**
 * Index of carry-forward info per lead id, as v1 built it: only `pending` / `approved` requests count and a
 * later row in the list overwrites an earlier one (the server lists newest first, so the OLDEST request wins).
 */
export function indexCarryForwardByLead(requests: readonly CarryForwardRequest[]): Map<string, LeadCarryForward> {
  const map = new Map<string, LeadCarryForward>();
  for (const req of requests) {
    if (req.leadId === '' || (req.status !== 'pending' && req.status !== 'approved')) continue;
    map.set(req.leadId, {
      requestId: req.id,
      status: req.status,
      previousStaffName: req.employeeName,
      previousStaffId: req.userId,
    });
  }
  return map;
}

/** Attaches the (pending / approved) carry-forward request to each lead (`null` when there is none). */
export function attachCarryForward(leads: readonly Lead[], requests: readonly CarryForwardRequest[]): LeadWithCarryForward[] {
  const index = indexCarryForwardByLead(requests);
  return leads.map((lead) => ({ ...lead, carryForward: index.get(lead.id) ?? null }));
}

/** Form defaults for editing an existing lead (keeps the required date). */
export function leadToInput(lead: Lead, orgId: string): UpdateLeadInput {
  return {
    orgId,
    name: lead.clientName,
    mobile: lead.mobile,
    address: lead.address,
    category: lead.categoryName || 'General',
    remarks: lead.remarks,
    requiredDate: lead.requiredDate,
  };
}

/** Builds the JSON body shared by lead create and update. */
export function buildLeadBody(input: LeadInput): Record<string, unknown> {
  return {
    org_id: input.orgId,
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    address: input.address.trim(),
    category: input.category.trim() || 'General',
    remarks: input.remarks ?? '',
    required_date: input.requiredDate ? input.requiredDate : null,
  };
}

/** `GET /api/leads/{orgId}` — every lead of the organisation with its current assignment (plan-gated `crm`). */
export async function listLeads(orgId: string): Promise<Lead[]> {
  const body = await api.get<unknown>(`/api/leads/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load leads');
  return listOf(body).map(mapLead);
}

/** `GET /api/leads/employee/{orgId}/{userId}` — leads assigned to the employee (dated today or undated; plan-gated `crm`). */
export async function listEmployeeLeads(orgId: string, userId: string): Promise<Lead[]> {
  const body = await api.get<unknown>(`/api/leads/employee/${seg(requireId(orgId, 'orgId'))}/${seg(requireId(userId, 'userId'))}`);
  ensureSuccess(body, 'Failed to load leads');
  return listOf(body).map(mapLead);
}

/** `POST /api/leads/create` — creates an (unassigned) lead; returns the new lead id. */
export async function createLead(input: LeadInput): Promise<{ id: string }> {
  const body = await api.post<unknown>('/api/leads/create', buildLeadBody(input));
  const r = successBody(body, 'Failed to save lead');
  return { id: str(r.leads_id) };
}

/** `PUT /api/leads/{leadId}` — updates a lead; `requiredDate` must be passed (use `lead.requiredDate`). */
export async function updateLead(leadId: string, input: UpdateLeadInput): Promise<void> {
  const body = await api.put<unknown>(`/api/leads/${seg(requireId(leadId, 'leadId'))}`, buildLeadBody(input));
  ensureSuccess(body, 'Failed to save lead');
}

/** `DELETE /api/leads/{leadId}` — deletes a lead. */
export async function deleteLead(leadId: string): Promise<void> {
  const body = await api.delete<unknown>(`/api/leads/${seg(requireId(leadId, 'leadId'))}`);
  ensureSuccess(body, 'Failed to delete lead');
}

/** `POST /api/leads/assign?leads_id&org_id&user_id&branch_id&dept_id` — assigns an unassigned lead (query params only). */
export async function assignLead(input: AssignLeadInput): Promise<void> {
  const query = buildQuery({
    leads_id: input.leadId,
    org_id: input.orgId,
    user_id: input.userId,
    branch_id: input.branchId ?? undefined,
    dept_id: input.deptId ?? undefined,
    remarks: input.remarks,
    request_date: input.requestDate ?? undefined,
  });
  const body = await api.post<unknown>(`/api/leads/assign${query}`);
  ensureSuccess(body, 'Failed to assign lead');
}

/** `PUT /api/leads/assignment/{leadId}?user_id&branch_id&dept_id` — moves an assigned lead to another employee. */
export async function reassignLead(input: ReassignLeadInput): Promise<void> {
  const query = buildQuery({ user_id: input.userId, branch_id: input.branchId ?? undefined, dept_id: input.deptId ?? undefined });
  const body = await api.put<unknown>(`/api/leads/assignment/${seg(requireId(input.leadId, 'leadId'))}${query}`);
  ensureSuccess(body, 'Failed to reassign lead');
}

/** `PUT /api/leads/{leadId}/work-status?work_status&user_id` — employee updates their work status on a lead. */
export async function updateLeadWorkStatus(leadId: string, status: LeadWorkStatus, userId: string): Promise<void> {
  const query = buildQuery({ work_status: status, user_id: userId });
  const body = await api.put<unknown>(`/api/leads/${seg(requireId(leadId, 'leadId'))}/work-status${query}`);
  ensureSuccess(body, 'Failed to update status');
}

/** `PUT /api/leads/{leadId}/status?status` — sets the pipeline status (new/contacted/interested/converted/not_interested). */
export async function updateLeadPipelineStatus(leadId: string, status: LeadPipelineStatus): Promise<void> {
  const body = await api.put<unknown>(`/api/leads/${seg(requireId(leadId, 'leadId'))}/status${buildQuery({ status })}`);
  ensureSuccess(body, 'Failed to update lead status');
}

/** `GET /api/leads/categories/{orgId}` — lead categories of the organisation. */
export async function listLeadCategories(orgId: string): Promise<LeadCategory[]> {
  const body = await api.get<unknown>(`/api/leads/categories/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load categories');
  return listOf(body).map(mapLeadCategory);
}

/** `POST /api/leads/categories?org_id&category_name` — adds a category; returns its id. */
export async function createLeadCategory(orgId: string, name: string): Promise<{ id: string }> {
  const query = buildQuery({ org_id: orgId, category_name: name.trim() });
  const r = successBody(await api.post<unknown>(`/api/leads/categories${query}`), 'Failed to add category');
  return { id: str(r.category_id) };
}

/** `DELETE /api/leads/categories/{categoryId}` — removes a category. */
export async function deleteLeadCategory(categoryId: string): Promise<void> {
  const body = await api.delete<unknown>(`/api/leads/categories/${seg(requireId(categoryId, 'categoryId'))}`);
  ensureSuccess(body, 'Failed to delete category');
}

/** `GET /api/leads/carry-forward/requests/{orgId}` — all carry-forward requests of the organisation (admin). */
export async function listCarryForwardRequests(orgId: string): Promise<CarryForwardRequest[]> {
  const body = await api.get<unknown>(`/api/leads/carry-forward/requests/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load carry-forward requests');
  return listOf(body).map(mapCarryForwardRequest);
}

/** `GET /api/leads/carry-forward/my/{orgId}/{userId}` — the employee's own carry-forward requests. */
export async function listMyCarryForwardRequests(orgId: string, userId: string): Promise<MyCarryForwardRequest[]> {
  const body = await api.get<unknown>(`/api/leads/carry-forward/my/${seg(requireId(orgId, 'orgId'))}/${seg(requireId(userId, 'userId'))}`);
  ensureSuccess(body, 'Failed to load carry-forward requests');
  return listOf(body).map(mapMyCarryForwardRequest);
}

/** `POST /api/leads/carry-forward/request?leads_id&org_id&user_id&description&forward_date` — employee asks to carry a lead forward. */
export async function requestCarryForward(input: CarryForwardInput): Promise<{ requestId: string }> {
  const query = buildQuery({
    leads_id: input.leadId,
    org_id: input.orgId,
    user_id: input.userId,
    description: input.description.trim(),
    forward_date: input.forwardDate ?? undefined,
  });
  const r = successBody(await api.post<unknown>(`/api/leads/carry-forward/request${query}`), 'Failed to submit request');
  return { requestId: str(r.request_id) };
}

/** `PUT /api/leads/carry-forward/{requestId}/action?action&admin_id` — admin approves or rejects a carry-forward request. */
export async function actOnCarryForward(requestId: string, action: 'approved' | 'rejected', adminId: string): Promise<void> {
  const query = buildQuery({ action, admin_id: adminId });
  const body = await api.put<unknown>(`/api/leads/carry-forward/${seg(requireId(requestId, 'requestId'))}/action${query}`);
  ensureSuccess(body, 'Failed to update request');
}
