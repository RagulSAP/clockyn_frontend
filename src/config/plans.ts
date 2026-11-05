/**
 * Plan (subscription) gating — the INTENDED matrix from the v1 spec (shared/systems/plan_gating.md §2).
 * The matrix is a product rule and is deliberately unchanged (see docs/FIX_POLICY.md §C).
 *
 * Evaluation order for `isFeatureBlocked`:
 *   1. free trial        -> never blocked
 *   2. expired           -> blocked
 *   3. no plan (null)    -> blocked
 *   4. otherwise         -> blocked iff the plan's matrix row contains the feature (unknown plan id -> allowed)
 */
export const PLAN_IDS = { core: 1, prime: 2, elite: 3 } as const;
export type PlanId = (typeof PLAN_IDS)[keyof typeof PLAN_IDS];

export const PLAN_NAMES: Record<PlanId, string> = { 1: 'Core', 2: 'Prime', 3: 'Elite' };

export const PLAN_FEATURES = ['chat', 'salary_structure', 'camera_punch', 'staff_location', 'crm'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/** Features blocked on an ACTIVE paid plan. (Chat, salary structure and camera punch never block on an active paid plan.) */
export const PLAN_BLOCKED_FEATURES: Record<PlanId, readonly PlanFeature[]> = {
  1: ['staff_location', 'crm'],
  2: ['crm'],
  3: [],
};

/** Shape returned by `GET /plans/plan-status/{org}`. */
export interface OrgPlanStatus {
  plan_id: number | null;
  is_free_trial: boolean;
  is_expired: boolean;
}

export type PlanAudience = 'admin' | 'staff';

export function planName(planId: number | null | undefined): string {
  if (planId === null || planId === undefined) return '';
  return PLAN_NAMES[planId as PlanId] ?? '';
}

/** Core evaluation on primitive inputs. */
export function isPlanFeatureBlocked(
  planId: number | null | undefined,
  isFreeTrial: boolean,
  isExpired: boolean,
  feature: PlanFeature,
): boolean {
  if (isFreeTrial) return false;
  if (isExpired) return true;
  if (planId === null || planId === undefined) return true;
  const row = PLAN_BLOCKED_FEATURES[planId as PlanId];
  return row ? row.includes(feature) : false;
}

/** `status` is the plan-status payload; `null`/`undefined` (unknown / failed to load) fails OPEN, as in v1. */
export function isFeatureBlocked(status: OrgPlanStatus | null | undefined, feature: PlanFeature): boolean {
  if (!status) return false;
  return isPlanFeatureBlocked(status.plan_id, status.is_free_trial, status.is_expired, feature);
}

const MSG_TRIAL_ENDED = 'Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.';
const MSG_PRIME_ONLY = 'This feature is available only in the Prime plan. Please upgrade your plan to access it.';
const MSG_ELITE_ONLY = 'This feature is available only in the Elite plan. Please upgrade your plan to access it.';
const MSG_GENERIC = 'Please upgrade your plan to access this feature.';

/** Texts shown inside blocked-feature panels (page level). */
export const PLAN_PANEL_MESSAGES: Record<PlanAudience, string> = {
  admin: 'Your plan has expired. Please renew your plan to continue using this feature.',
  staff: 'Your plan has expired. Please contact your admin.',
};

const MSG_STAFF_TIER = "This feature isn't available on your organisation's current plan. Please contact your admin.";

/**
 * Message for a blocked feature (toasts / inline notices). Texts are verbatim from the spec for admins.
 * For `audience: 'staff'` users cannot purchase, so they are told to contact their admin instead.
 * Returns '' for free trial.
 */
export function planBlockMessage(
  planId: number | null | undefined,
  isFreeTrial: boolean,
  isExpired: boolean,
  audience: PlanAudience = 'admin',
): string {
  if (isFreeTrial) return '';
  if (audience === 'staff') {
    return isExpired || planId === null || planId === undefined ? PLAN_PANEL_MESSAGES.staff : MSG_STAFF_TIER;
  }
  if (isExpired || planId === null || planId === undefined) return MSG_TRIAL_ENDED;
  if (planId === PLAN_IDS.core) return MSG_PRIME_ONLY;
  if (planId === PLAN_IDS.prime) return MSG_ELITE_ONLY;
  return MSG_GENERIC;
}

/** Message for a status payload (convenience over `planBlockMessage`). */
export function planBlockMessageFor(status: OrgPlanStatus | null | undefined, audience: PlanAudience = 'admin'): string {
  if (!status) return '';
  return planBlockMessage(status.plan_id, status.is_free_trial, status.is_expired, audience);
}

/** Cheapest plan above Core that unlocks a feature (for upgrade hints). `null` when Core already includes it. */
export function minimumPlanFor(feature: PlanFeature): PlanId | null {
  const order: PlanId[] = [1, 2, 3];
  const found = order.find((id) => !PLAN_BLOCKED_FEATURES[id].includes(feature));
  return found === 1 ? null : (found ?? null);
}
