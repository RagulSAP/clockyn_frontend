/**
 * Plans API: plan status (feature gating input), subscription details and the plan catalogue.
 * Orders, payments, coupons and invoices are in `billing.ts`.
 *
 * `getOrgPlanStatus` keeps the server's snake_case shape on purpose: `useOrgPlan` and the plan matrix in
 * `@/config/plans` consume exactly `{plan_id, is_free_trial, is_expired}`.
 */
import { api } from '@/lib/api/client';
import type { OrgPlanStatus, Plan, Subscription } from '@/types/api/plans';
import { bool, dateOnly, listOf, num, objectOf, optNum, optStr, rec, str } from './mappers/common';
import { ensureSuccess, requireId, seg } from './sharedHelpers';

export type { OrgPlanStatus } from '@/types/api/plans';

/** Normalises the bare `plan-status` object (`plan_id` may arrive as a number or numeric string). */
export function mapOrgPlanStatus(input: unknown): OrgPlanStatus {
  const r = rec(input);
  return {
    plan_id: optNum(r.plan_id) ?? null,
    is_free_trial: bool(r.is_free_trial),
    is_expired: bool(r.is_expired),
  };
}

/** Maps the subscription payload; `is_free_trial` / `free_trial_end` may sit at the top level or inside `data`. */
export function mapSubscription(input: unknown): Subscription {
  const root = rec(input);
  const d = objectOf(input);
  const pick = (key: string): unknown => d[key] ?? root[key];
  const status = str(pick('status'));
  return {
    planId: optNum(pick('plan_id')) ?? null,
    planName: optStr(pick('plan_name')) ?? null,
    planAmount: optNum(pick('plan_amount')) ?? null,
    planMonths: optNum(pick('plan_month')) ?? null,
    planFreeMonths: optNum(pick('plan_free_months')) ?? null,
    startDate: dateOnly(pick('start_date')) ?? null,
    endDate: dateOnly(pick('end_date')) ?? null,
    staffLimit: num(pick('staff_limit'), 10) || 10,
    status,
    isExpired: bool(pick('is_expired')),
    isFreeTrial: bool(pick('is_free_trial')),
    freeTrialEnd: dateOnly(pick('free_trial_end')) ?? null,
    billingDate: dateOnly(pick('billing_date')) ?? null,
    raw: d,
  };
}

/** Maps one plan of the catalogue. */
export function mapPlan(input: unknown): Plan {
  const r = rec(input);
  return {
    id: num(r.plan_id),
    name: str(r.plan_name),
    amount: num(r.plan_amount),
    months: num(r.plan_month),
    freeMonths: Math.max(0, Math.trunc(optNum(r.plan_free_months) ?? 0)),
    offerText: optStr(r.plan_offer_text)?.trim() || null,
  };
}

/**
 * `GET /plans/plan-status/{orgId}` — `{plan_id, is_free_trial, is_expired}` for the organisation.
 * Active free trial wins (`plan_id` null, not expired); no subscription and no trial means expired.
 */
export async function getOrgPlanStatus(orgId: string): Promise<{ plan_id: number | null; is_free_trial: boolean; is_expired: boolean }> {
  const body = await api.get<unknown>(`/plans/plan-status/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to fetch plan status');
  return mapOrgPlanStatus(body);
}

/** `GET /plans/subscription/{orgId}` — current subscription (or free-trial placeholder) with staff limit and dates. */
export async function getSubscription(orgId: string): Promise<Subscription> {
  const body = await api.get<unknown>(`/plans/subscription/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load subscription');
  return mapSubscription(body);
}

/** `GET /plans/subscription/{orgId}` — the organisation's staff limit (10 when none). */
export async function getStaffLimit(orgId: string): Promise<number> {
  return (await getSubscription(orgId)).staffLimit;
}

/** `GET /plans/get_plans` — the plan catalogue ordered by price. */
export async function listPlans(): Promise<Plan[]> {
  const body = await api.get<unknown>('/plans/get_plans');
  ensureSuccess(body, 'Failed to load plans');
  return listOf(body).map(mapPlan);
}
