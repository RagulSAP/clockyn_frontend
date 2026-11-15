import { formatINR } from '@/lib/format';
import { formatDate } from '@/lib/datetime';
import type { Tone } from '@/components/ui';
import type { ReferralReward, ReferralRewardStatus, ReferralStatus } from '@/types/api/referral';

export interface Chip {
  label: string;
  tone: Tone;
}

/** Did the referred organisation only sign up, or has it paid for its first plan? */
export function signupChip(status: ReferralStatus): Chip {
  return status === 'paid' ? { label: 'Paid', tone: 'success' } : { label: 'Signed up', tone: 'info' };
}

const REWARD_CHIPS: Record<ReferralRewardStatus, Chip> = {
  pending: { label: 'Pending', tone: 'warning' },
  available: { label: 'Available', tone: 'success' },
  used: { label: 'Used', tone: 'neutral' },
  void: { label: 'Void', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};

export const rewardChip = (status: ReferralRewardStatus): Chip => REWARD_CHIPS[status];

/** One line under the reward chip of a referred organisation. */
export function rewardCaption(reward: ReferralReward): string {
  switch (reward.status) {
    case 'pending':
      return 'Unlocks when they pay';
    case 'available':
      return `${percentOff(reward.percent)} your next Prime or Elite plan`;
    case 'used': {
      const off = reward.discountAmount !== null && reward.discountAmount > 0 ? `${formatINR(reward.discountAmount)} off` : reward.percent > 0 ? `${reward.percent}% off` : 'Discount applied';
      const plan = reward.planName ? `${reward.planName} - ` : '';
      return `${plan}${off}${reward.usedAt ? ` on ${formatDate(reward.usedAt)}` : ''}`;
    }
    case 'expired':
      return reward.expiresAt ? `Expired on ${formatDate(reward.expiresAt)}` : 'This reward has expired';
    default:
      return 'This reward is no longer valid';
  }
}

/** "12% off", or "A discount on" while the server did not send a percent (so no number is ever invented). */
export function percentOff(percent: number): string {
  return percent > 0 ? `${percent}% off` : 'A discount on';
}

/** "Valid until 14 Dec 2026" for a reward that can still be used and has an end date, else `null`. */
export function rewardValidity(reward: Pick<ReferralReward, 'status' | 'expiresAt'>): string | null {
  return reward.status === 'available' && reward.expiresAt ? `Valid until ${formatDate(reward.expiresAt)}` : null;
}

/** Sentence for the reward this organisation received for signing up with a code. */
export function myRewardTitle(orgName: string, percent: number): string {
  const from = `Referral reward from ${orgName || 'your referrer'}`;
  return percent > 0 ? `${from}: ${percent}% off your first plan` : `${from}: a discount on your first plan`;
}

/** Where the user redeems a reward (the checkout itself lives in billing). */
export function redeemHint(canBuy: boolean): string {
  return canBuy
    ? 'Open Your plan & validity > Renew or choose a plan and tap Apply next to the coupon box.'
    : 'Plans can be bought on Android or the web. Open Your plan & validity there and tap Apply next to the coupon box.';
}

export function howItWorks(percent: number): readonly { title: string; body: string }[] {
  const off = percent > 0 ? `${percent}% off` : 'a discount';
  const reward = percent > 0 ? `${percent}% reward` : 'reward';
  return [
    { title: 'Share your code', body: 'Send your code to another business owner.' },
    { title: 'They sign up', body: `They enter your code when creating their account and get ${off} right away.` },
    { title: 'You both save', body: `When they pay for their first plan, your ${reward} unlocks too.` },
  ];
}
