/**
 * Builds the purchase "quote" (what is charged, credit, validity, limits) from the selected mode, the target plan tier,
 * the current subscription and the staff stepper value. Used by BOTH the configurator and the payment summary so the
 * two screens always agree (v1 handed ~10 stringified numbers between them through route params).
 */
import type { Plan, Subscription } from '@/types/api/plans';

import {
  RENEW_MONTHS,
  calcExtraStaff,
  calcMinStaff,
  calcPlanCredit,
  calcRemainingMonths,
  calcValidTill,
  freeMonthsForTerm,
  liveStaffLimit,
  paidMonths,
  type PurchaseMode,
} from './pricing';
import { deriveBillingState, type BillingState } from './planState';

/** The plan tier the purchase is for. Renewals and capacity upgrades use the CURRENT tier. */
export interface TargetPlan {
  id: number;
  name: string;
  /** INR per staff per month. */
  amount: number;
  /** Validity of the purchase in months (renewals: 12). */
  months: number;
  /** Months of the plan's own duration that are free (0 / absent = no offer). */
  freeMonths?: number;
}

export interface CurrentPlanInfo {
  /** `null`/empty for organisations without any plan or trial. */
  planName: string | null;
  amount: number;
  months: number;
  /** Free months inside `months` (0 / absent = none). */
  freeMonths?: number;
  validTill: string | null;
  endDate: string | null;
}

export interface QuoteInput {
  mode: PurchaseMode;
  target: TargetPlan;
  current: CurrentPlanInfo | null;
  /** Live staff limit (>= 10). */
  currentStaff: number;
  /** Stepper value. */
  staffLimit: number;
  /** `YYYY-MM-DD` IST. */
  today: string;
  /** Renewal start (current end date when still active, else today). Only used for `renew`. */
  renewStart?: string | null;
}

export interface Quote {
  mode: PurchaseMode;
  plan: TargetPlan;
  hasCurrentPlan: boolean;
  isPlanExpired: boolean;
  currentStaff: number;
  minStaff: number;
  staffLimit: number;
  extraStaff: number;
  /** Staff charged (extra staff for a capacity upgrade). */
  chargedStaff: number;
  /** Months PAID for (the term minus the free months; whole calendar months left for a capacity upgrade). */
  chargedMonths: number;
  /** Months of the term that are free in this purchase (always 0 for a capacity upgrade). */
  freeMonths: number;
  credit: number;
  validTill: string;
  isStaffUpgrade: boolean;
  /** Capacity upgrades never get a coupon. */
  noCoupon: boolean;
  /** Capacity upgrade with nothing to add cannot continue. */
  canContinue: boolean;
}

export function buildQuote(input: QuoteInput): Quote {
  const { mode, target, current, currentStaff, staffLimit, today } = input;
  const hasCurrentPlan = !!current && !!current.planName && current.planName.trim() !== '' && current.planName !== 'undefined';
  const isPlanExpired = !!current?.validTill && current.validTill < today;
  const existingEndDate = mode === 'renew' ? (input.renewStart ?? today) : mode === 'upgrade' ? (current?.endDate ?? null) : null;

  // `months` is the validity of the purchase; the free months are part of it but not charged (capacity upgrades never have any).
  const months = mode === 'renew' ? RENEW_MONTHS : target.months;
  const freeMonths =
    mode === 'upgrade'
      ? 0
      : mode === 'renew'
        ? current
          ? freeMonthsForTerm(current.months, current.freeMonths ?? 0, RENEW_MONTHS)
          : 0
        : months - paidMonths(months, target.freeMonths ?? 0);
  const chargedMonths = calcRemainingMonths({ mode, planMonths: months - freeMonths, existingEndDate, today });
  const extraStaff = calcExtraStaff({ mode, staffLimit, currentStaff });
  const credit = calcPlanCredit({
    hasCurrentPlan,
    mode,
    isPlanExpired,
    currentPlanAmount: current?.amount ?? 0,
    currentPlanMonths: current?.months ?? 1,
    currentPlanFreeMonths: current?.freeMonths ?? 0,
  });

  return {
    mode,
    plan: target,
    hasCurrentPlan,
    isPlanExpired,
    currentStaff,
    // v1 only applied the live limit as the floor when buying a new plan over an existing one.
    minStaff: calcMinStaff({ mode, hasCurrentPlan, currentStaff }),
    staffLimit,
    extraStaff,
    chargedStaff: mode === 'upgrade' ? extraStaff : staffLimit,
    chargedMonths,
    freeMonths,
    credit,
    validTill: calcValidTill({ mode, months, existingEndDate, today }),
    isStaffUpgrade: mode === 'upgrade',
    noCoupon: mode === 'upgrade',
    canContinue: mode !== 'upgrade' || extraStaff > 0,
  };
}

export type QuoteSource =
  | { ok: true; mode: PurchaseMode; target: TargetPlan; current: CurrentPlanInfo | null; currentStaff: number; renewStart: string | null; state: BillingState }
  | { ok: false; reason: 'plan-not-found' | 'no-plan' };

/** Current-plan facts from the subscription payload (trial placeholders count as a zero-priced current plan, as in v1). */
export function currentPlanFrom(sub: Subscription | null | undefined): CurrentPlanInfo | null {
  if (!sub) return null;
  return {
    planName: sub.planName,
    amount: sub.planAmount ?? 0,
    months: sub.planMonths ?? 1,
    freeMonths: sub.planFreeMonths ?? 0,
    validTill: sub.endDate,
    endDate: sub.endDate,
  };
}

/**
 * Resolves the target tier and current-plan facts for a mode.
 *  - `new`: the tier with `planId` from the catalogue (current plan = whatever the subscription says).
 *  - `upgrade` / `renew`: the CURRENT paid tier (renewals priced for 12 months, per-staff price of the current tier).
 */
export function resolveQuoteSource(args: {
  mode: PurchaseMode;
  planId: number | null;
  subscription: Subscription | null | undefined;
  catalogue: readonly Plan[];
  today: string;
}): QuoteSource {
  const { mode, planId, subscription, catalogue, today } = args;
  const state = deriveBillingState(subscription, today);
  const current = currentPlanFrom(subscription);
  const currentStaff = liveStaffLimit(subscription?.staffLimit);

  if (mode === 'new') {
    const tier = catalogue.find((p) => p.id === planId);
    if (!tier) return { ok: false, reason: 'plan-not-found' };
    return {
      ok: true,
      mode,
      target: { id: tier.id, name: tier.name, amount: tier.amount, months: tier.months, freeMonths: tier.freeMonths },
      current,
      currentStaff,
      renewStart: null,
      state,
    };
  }

  if (!subscription || subscription.planId === null) return { ok: false, reason: 'no-plan' };
  const target: TargetPlan = {
    id: subscription.planId,
    name: subscription.planName ?? 'Selected Plan',
    amount: subscription.planAmount ?? 0,
    months: mode === 'renew' ? RENEW_MONTHS : (subscription.planMonths ?? 1),
    freeMonths: subscription.planFreeMonths ?? 0,
  };
  const renewStart = state === 'paid-active' && subscription.endDate ? subscription.endDate : today;
  return { ok: true, mode, target, current, currentStaff, renewStart, state };
}

/** Initial stepper value: renewals start at the minimum (10), everything else at the live limit. */
export function initialStaffLimit(mode: PurchaseMode, currentStaff: number): number {
  return mode === 'renew' ? 10 : currentStaff;
}
