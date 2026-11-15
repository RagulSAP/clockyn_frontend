/** Refer & Earn: the org's code, share message, reward summary and the organisations it referred. */

/** `expired`: a reward with a validity period (a B2C partner code) whose period has passed; it can no longer be used. */
export type ReferralRewardStatus = 'pending' | 'available' | 'used' | 'void' | 'expired';
/** `c2c`: another organisation's code; `b2c`: a code of a promoter / channel (its own percent and validity). */
export type ReferralKind = 'c2c' | 'b2c';
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
  /** ISO instant after which the reward can no longer be used (`null` = it does not expire). */
  expiresAt: string | null;
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
  /** The referring organisation, or the channel name for a B2C code. */
  referredByOrgName: string;
  kind: ReferralKind;
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
  /** The CURRENT C2C percent from the server (0 = the server did not say). */
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
  /** Name of the referring organisation, or the channel name of a B2C code (valid codes). */
  referrerOrgName: string;
  kind: ReferralKind;
  /** Percent the code gives (`null` when an older server does not say). */
  percent: number | null;
  /** Server message (invalid codes). */
  message: string;
}
