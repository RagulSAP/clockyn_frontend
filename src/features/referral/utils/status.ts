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
};

export const rewardChip = (status: ReferralRewardStatus): Chip => REWARD_CHIPS[status];

/** One line under the reward chip of a referred organisation. */
export function rewardCaption(reward: ReferralReward): string {
  switch (reward.status) {
    case 'pending':
      return 'Unlocks when they pay';
    case 'available':
      return `${reward.percent}% off your next Prime or Elite plan`;
    case 'used': {
      const off = reward.discountAmount !== null && reward.discountAmount > 0 ? `${formatINR(reward.discountAmount)} off` : `${reward.percent}% off`;
      const plan = reward.planName ? `${reward.planName} - ` : '';
      return `${plan}${off}${reward.usedAt ? ` on ${formatDate(reward.usedAt)}` : ''}`;
    }
    default:
      return 'This reward is no longer valid';
  }
}

/** Sentence for the reward this organisation received for signing up with a code. */
export function myRewardTitle(orgName: string, percent: number): string {
  return `Referral reward from ${orgName || 'your referrer'}: ${percent}% off your first plan`;
}

/** Where the user redeems a reward (the checkout itself lives in billing). */
export function redeemHint(canBuy: boolean): string {
  return canBuy
    ? 'Open Your plan & validity > Renew or choose a plan and tap Apply next to the coupon box.'
    : 'Plans can be bought on Android or the web. Open Your plan & validity there and tap Apply next to the coupon box.';
}

export function howItWorks(percent: number): readonly { title: string; body: string }[] {
  return [
    { title: 'Share your code', body: 'Send your code to another business owner.' },
    { title: 'They sign up', body: `They enter your code when creating their account and get ${percent}% off right away.` },
    { title: 'You both save', body: `When they pay for their first plan, your ${percent}% reward unlocks too.` },
  ];
}
