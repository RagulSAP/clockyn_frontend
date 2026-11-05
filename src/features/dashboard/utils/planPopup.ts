/**
 * Plan-expiry popup rules of the admin home (spec home §7.1 / F5 / F17, plan_gating G11). Pure logic.
 *
 *  - trial_expiring: free trial whose end date is today .. 7 days ahead
 *  - plan_expiring : paid plan ending within 7 days
 *  - plan_expired  : paid plan whose end date has passed (cannot be dismissed)
 *  - shown at most once per day PER ORGANISATION, never on iOS (store policy: no purchase paths)
 *
 * End dates are calendar dates (`YYYY-MM-DD`, IST) and valid THROUGH that day.
 */
import { daysBetween, formatDate } from '@/lib/datetime';
import { STORAGE_KEYS, storageKeyFor } from '@/lib/storage';
import type { RouteParams } from '@/lib/navigation';
import type { Subscription } from '@/types/api/plans';

export type PlanPopupType = 'trial_expiring' | 'plan_expiring' | 'plan_expired';

/** Popup window: the last 7 days before the end date. */
export const PLAN_POPUP_WINDOW_DAYS = 7;

export type PlanPopupInput = {
  isFreeTrial: boolean;
  freeTrialEnd?: string | null;
  /** End date of the paid subscription. */
  subscriptionEnd?: string | null;
  /** Today (IST) `YYYY-MM-DD`. */
  today: string;
};

export type PlanPopupDecision = { type: PlanPopupType; endDate: string };

function daysLeft(today: string, end: string): number {
  return daysBetween(today, end);
}

/**
 * Which popup (if any) applies. An expired trial shows nothing and does not fall through to the paid-plan rule
 * (v1); a trial without an end date uses the subscription end date.
 */
export function decidePlanPopup(input: PlanPopupInput): PlanPopupDecision | null {
  const { isFreeTrial, freeTrialEnd, subscriptionEnd, today } = input;
  if (isFreeTrial && freeTrialEnd) {
    const left = daysLeft(today, freeTrialEnd);
    return left >= 0 && left <= PLAN_POPUP_WINDOW_DAYS ? { type: 'trial_expiring', endDate: freeTrialEnd } : null;
  }
  if (subscriptionEnd) {
    const left = daysLeft(today, subscriptionEnd);
    if (left < 0) return { type: 'plan_expired', endDate: subscriptionEnd };
    if (left <= PLAN_POPUP_WINDOW_DAYS) return { type: 'plan_expiring', endDate: subscriptionEnd };
  }
  return null;
}

/** Purchase paths are not allowed on iOS, so the popup is never shown there. */
export function isPlanPopupPlatform(platform: string): boolean {
  return platform !== 'ios';
}

/** Final decision: a popup type applies, the platform allows it and it was not shown today for this org. */
export function shouldShowPlanPopup(args: {
  platform: string;
  decision: PlanPopupDecision | null;
  alreadyShownToday: boolean;
}): boolean {
  return args.decision !== null && isPlanPopupPlatform(args.platform) && !args.alreadyShownToday;
}

/** Storage key of the once-per-day-per-org flag (`<base>:<YYYY-MM-DD>:<orgId>`). */
export function planPopupShownKey(orgId: string, today: string): string {
  return storageKeyFor(storageKeyFor(STORAGE_KEYS.planPopupShown, today), orgId);
}

export type PlanPopupContent = {
  title: string;
  message: string;
  primaryLabel: string;
  /** Expired plans cannot be skipped / dismissed. */
  dismissible: boolean;
  tone: 'warning' | 'danger';
};

/** Verbatim v1 copy; `{date}` is `dd MMM yyyy`. */
export function planPopupContent(type: PlanPopupType, endDate: string): PlanPopupContent {
  const date = formatDate(endDate);
  switch (type) {
    case 'trial_expiring':
      return {
        title: 'Free Trial Ending Soon',
        message: `Your free trial ends on ${date}. Upgrade now to keep access to all features.`,
        primaryLabel: 'Upgrade Plan',
        dismissible: true,
        tone: 'warning',
      };
    case 'plan_expiring':
      return {
        title: 'Plan Expiring Soon',
        message: `Your plan expires on ${date}. Renew now to avoid interruption.`,
        primaryLabel: 'Renew Plan',
        dismissible: true,
        tone: 'warning',
      };
    case 'plan_expired':
      return {
        title: 'Plan Expired',
        message: `Your plan expired on ${date}. Please renew to continue using all features.`,
        primaryLabel: 'Renew Plan',
        dismissible: false,
        tone: 'danger',
      };
  }
}

/**
 * Params of the billing upgrade screen for a renewal. The billing feature derives plan, staff limit and the
 * renewal start (end date while still in the future, otherwise today) from its cached subscription, so only the
 * mode is passed (v1 handed over ~10 stringified values). `null` when there is no plan to renew (the caller then
 * opens the billing overview instead).
 */
export function renewParams(sub: Subscription | null | undefined): RouteParams | null {
  if (!sub || sub.planId === null) return null;
  return { mode: 'renew' };
}
