/** DTOs for plans and subscription (`src/api/plans.ts`). */
import type { DateString, RawRecord } from './common';

/** Plan status exactly as the server sends it (snake_case on purpose; defined next to the plan matrix). */
export type { OrgPlanStatus } from '@/config/plans';

/** Subscription state label. */
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'FREE_TRIAL' | 'INACTIVE' | string;

/** The organisation's subscription (or free-trial placeholder). */
export interface Subscription {
  planId: number | null;
  planName: string | null;
  planAmount: number | null;
  /** Plan duration in months. */
  planMonths: number | null;
  startDate: DateString | null;
  endDate: DateString | null;
  /** Maximum staff; defaults to 10 when the server has none. */
  staffLimit: number;
  status: SubscriptionStatus;
  isExpired: boolean;
  isFreeTrial: boolean;
  freeTrialEnd: DateString | null;
  billingDate: DateString | null;
  raw: RawRecord;
}

/** A purchasable plan. */
export interface Plan {
  id: number;
  name: string;
  /** Price per period in INR (before GST). */
  amount: number;
  months: number;
}
