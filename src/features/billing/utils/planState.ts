/**
 * Subscription state, plan catalogue grouping and the upgrade/downgrade rules.
 *
 * The backend returns a placeholder subscription for organisations without a paid plan (no `planId`), so the state
 * is modelled explicitly (paid-active / paid-expired / trial-active / none) instead of relying on a null object.
 */
import type { Tone } from '@/components/ui';
import type { Plan, Subscription } from '@/types/api/plans';

export type BillingState = 'paid-active' | 'paid-expired' | 'trial-active' | 'none';

/** Evaluates the state at `today` (`YYYY-MM-DD`, IST). A paid plan is active through its end date. */
export function deriveBillingState(sub: Subscription | null | undefined, today: string): BillingState {
  if (!sub) return 'none';
  const hasPaidRow = sub.planId !== null;
  const paidActive = hasPaidRow && (sub.endDate ? sub.endDate >= today : !sub.isExpired);
  if (paidActive) return 'paid-active';
  const trialActive = sub.isFreeTrial && (sub.freeTrialEnd ? sub.freeTrialEnd >= today : true);
  if (trialActive) return 'trial-active';
  return hasPaidRow ? 'paid-expired' : 'none';
}

export const BILLING_BADGE: Record<BillingState, string> = {
  'trial-active': 'FREE TRIAL',
  'paid-active': 'ACTIVE',
  'paid-expired': 'EXPIRED',
  none: 'NO PLAN',
};

export const BILLING_PILL: Record<BillingState, string> = {
  'trial-active': 'Free Trial',
  'paid-active': 'Active',
  'paid-expired': 'Expired',
  none: 'No Plan',
};

export const BILLING_TONE: Record<BillingState, Tone> = {
  'trial-active': 'warning',
  'paid-active': 'success',
  'paid-expired': 'danger',
  none: 'neutral',
};

/** Sentence under the plan name; `trialEndLabel` is the formatted trial end date. */
export function billingSentence(state: BillingState, trialEndLabel: string): string {
  switch (state) {
    case 'trial-active':
      return `Free trial ends on ${trialEndLabel}`;
    case 'paid-active':
      return 'Your subscription is active and running';
    case 'paid-expired':
      return 'Your plan has expired. Please renew.';
    default:
      return 'Subscribe to unlock all features';
  }
}

/** Free staff slots: `max(0, limit − used)`. */
export function remainingStaff(staffLimit: number | null | undefined, used: number): number {
  return Math.max(0, (staffLimit ?? 0) - used);
}

// ── plan catalogue ─────────────────────────────────────────────────────────────────────────────

export const PLAN_RANK: Record<string, number> = { core: 0, prime: 1, elite: 2 };

export function planRank(name: string | null | undefined): number {
  const rank = PLAN_RANK[(name ?? '').trim().toLowerCase()];
  return rank === undefined ? -1 : rank;
}

export interface PlanGroup {
  key: string;
  name: string;
  /** Duration tiers ascending by months. */
  tiers: Plan[];
}

/** Groups the catalogue by lower-cased plan name (order of first appearance); tiers sorted by duration. */
export function groupPlans(plans: readonly Plan[]): PlanGroup[] {
  const groups: PlanGroup[] = [];
  for (const plan of plans) {
    const key = plan.name.trim().toLowerCase();
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, name: plan.name, tiers: [] };
      groups.push(group);
    }
    group.tiers.push(plan);
  }
  for (const g of groups) g.tiers = [...g.tiers].sort((a, b) => a.months - b.months);
  return groups;
}

export interface ActivePlanRef {
  isActive: boolean;
  planName: string | null;
  planMonths: number | null;
}

/**
 * Downgrade matrix (only while a paid plan is active): a tier is disabled when it belongs to a lower plan, or to the
 * same plan with a duration that is not longer, or to a higher plan with a shorter duration.
 */
export function isTierDisabled(active: ActivePlanRef, tier: { name: string; months: number }): boolean {
  if (!active.isActive) return false;
  const activeRank = planRank(active.planName);
  const tierRank = planRank(tier.name);
  const activeMonths = active.planMonths ?? 0;
  if (tierRank < activeRank) return true;
  if (tierRank === activeRank) return tier.months <= activeMonths;
  return tier.months < activeMonths;
}

/** The tier that is the currently running plan (grey "Active" tier). */
export function isActiveTier(sub: Subscription | null | undefined, state: BillingState, tier: Plan): boolean {
  return state === 'paid-active' && sub?.planId !== null && sub?.planId === tier.id;
}

// ── features per plan ──────────────────────────────────────────────────────────────────────────

export type FeatureId = 'chat' | 'payslips' | 'geofencing' | 'gps' | 'crm';

export const FEATURE_LABELS: Record<FeatureId, string> = {
  chat: 'Chat',
  payslips: 'Payslips',
  geofencing: 'Geo Fencing Attendance',
  gps: 'GPS Live Location',
  crm: 'CRM',
};

const CORE_FEATURES: FeatureId[] = ['chat', 'payslips', 'geofencing'];

/** Default features of a plan (unknown plan names get the Core set). */
export function planFeatureIds(planName: string | null | undefined): FeatureId[] {
  switch ((planName ?? '').trim().toLowerCase()) {
    case 'prime':
      return [...CORE_FEATURES, 'gps'];
    case 'elite':
      return [...CORE_FEATURES, 'gps', 'crm'];
    default:
      return [...CORE_FEATURES];
  }
}

/** Longer feature descriptions shown on the plan cards in the plan picker. */
export function planFeatureList(planName: string | null | undefined): string[] {
  switch ((planName ?? '').trim().toLowerCase()) {
    case 'core':
      return ['Chat', 'Payslips', 'Geo Fencing Attendance'];
    case 'prime':
      return ['Chat', 'Payslips', 'Geo Fencing Attendance', 'GPS Live Location for Field Operations', 'Location History'];
    case 'elite':
      return ['Chat', 'Payslips', 'Geo Fencing Attendance', 'GPS Live Location for Field Operations', 'Location History', 'CRM'];
    default:
      return [];
  }
}

/** Accent tone of a plan. Monochrome on purpose: colour is reserved for meaning, a plan tier is not a status. */
export function planTone(_planName: string | null | undefined): Tone {
  return 'primary';
}

export function capitalize(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
