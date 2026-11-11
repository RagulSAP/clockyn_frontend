/** Refer & Earn: the org's code, share message, reward summary and the organisations it referred. */

export type ReferralRewardStatus = 'pending' | 'available' | 'used' | 'void';
export type ReferralStatus = 'signed_up' | 'paid';

/** A reward (the referrer's reward on a referral row, or this org's own `myReward`). */
export interface ReferralReward {
  id: number | null;
  status: ReferralRewardStatus;
  percent: number;
  /** ISO instant the reward was used (only when `status` is `used`). */
  usedAt: string | null;
  planName: string | null;
  /** Rupees taken off by this reward (only when used). */
  discountAmount: number | null;
}

/** One organisation this org referred. */
export interface ReferredOrg {
  id: number | null;
  orgName: string;
  /** ISO instant the organisation signed up. */
  joinedAt: string | null;
  status: ReferralStatus;
  /** The REFERRER's (this org's) reward for that referral. */
  reward: ReferralReward | null;
}

/** The reward this org received for having been referred. */
export interface MyReferralReward extends ReferralReward {
  referredByOrgName: string;
}

export interface ReferralSummary {
  referredCount: number;
  convertedCount: number;
  rewardsAvailable: number;
  rewardsPending: number;
  rewardsUsed: number;
}

export interface ReferralInfo {
  code: string;
  percent: number;
  eligiblePlans: string[];
  shareMessage: string;
  summary: ReferralSummary;
  referrals: ReferredOrg[];
  /** `null` when this org was not referred. */
  myReward: MyReferralReward | null;
}

/** Result of `GET /referral/validate` (public, used on the sign-up screen). */
export interface ReferralCodeCheck {
  valid: boolean;
  /** Name of the referring organisation (valid codes). */
  referrerOrgName: string;
  /** Server message (invalid codes). */
  message: string;
}
