/**
 * Refer & Earn API: the org's referral page (`GET /referral/{org_id}`, org admin) and the public code check used on the
 * sign-up screen (`GET /referral/validate?code=`).
 *
 * Parsing is defensive: unknown statuses degrade to the safest reading, a missing summary is derived from the rows and a
 * missing share message is rebuilt from the code, so a slightly different server never blanks the screen.
 */
import { api } from '@/lib/api/client';
import type {
  MyReferralReward,
  ReferralCodeCheck,
  ReferralInfo,
  ReferralReward,
  ReferralRewardStatus,
  ReferralStatus,
  ReferralSummary,
  ReferredOrg,
} from '@/types/api/referral';
import { arr, isRecord, optNum, optStr, pick, rec, str } from './mappers/common';
import { ensureSuccess, requireId, seg } from './sharedHelpers';

export const REFERRAL_PERCENT = 10;
export const DEFAULT_ELIGIBLE_PLANS = ['Prime', 'Elite'];
export const INVALID_CODE_MESSAGE = 'This referral code is not valid';

const REWARD_STATUSES: readonly ReferralRewardStatus[] = ['pending', 'available', 'used', 'void'];

/** Unknown / missing reward status reads as `pending` (never shows a reward as spendable by mistake). */
function rewardStatus(v: unknown): ReferralRewardStatus {
  const s = str(v).toLowerCase();
  return (REWARD_STATUSES as readonly string[]).includes(s) ? (s as ReferralRewardStatus) : 'pending';
}

function referralStatus(v: unknown): ReferralStatus {
  const s = str(v).toLowerCase().replace(/[\s-]+/g, '_');
  return s === 'paid' || s === 'converted' ? 'paid' : 'signed_up';
}

export function mapReward(input: unknown): ReferralReward | null {
  if (!isRecord(input)) return null;
  return {
    id: optNum(input.reward_id) ?? null,
    status: rewardStatus(input.status),
    percent: optNum(input.percent) ?? REFERRAL_PERCENT,
    usedAt: optStr(input.used_at) ?? null,
    planName: optStr(input.plan_name) ?? null,
    discountAmount: optNum(input.discount_amount) ?? null,
  };
}

export function mapMyReward(input: unknown): MyReferralReward | null {
  const reward = mapReward(input);
  if (!reward) return null;
  return { ...reward, referredByOrgName: str(rec(input).referred_by_org_name) };
}

export function mapReferredOrg(input: unknown): ReferredOrg {
  const r = rec(input);
  return {
    id: optNum(r.referral_id) ?? null,
    orgName: str(r.org_name, 'Organisation'),
    joinedAt: optStr(pick(r, 'joined_at', 'created_at')) ?? null,
    status: referralStatus(r.status),
    reward: mapReward(r.reward),
  };
}

/** Counts derived from the rows, used when the server sends no (or a partial) summary. */
function deriveSummary(rows: ReferredOrg[], myReward: MyReferralReward | null): ReferralSummary {
  const rewards = rows.map((r) => r.reward).filter((r): r is ReferralReward => r !== null);
  const all = myReward ? [...rewards, myReward] : rewards;
  const count = (s: ReferralRewardStatus) => all.filter((r) => r.status === s).length;
  return {
    referredCount: rows.length,
    convertedCount: rows.filter((r) => r.status === 'paid').length,
    rewardsAvailable: count('available'),
    rewardsPending: count('pending'),
    rewardsUsed: count('used'),
  };
}

export function defaultShareMessage(code: string, percent = REFERRAL_PERCENT): string {
  return `Join me on Clockyn, the staff attendance and workforce app. Use my referral code ${code} when you create your account and we both get ${percent}% off our plan.`;
}

export function mapReferralInfo(body: unknown): ReferralInfo {
  const r = rec(body);
  const code = str(r.code).toUpperCase();
  const percent = optNum(r.percent) ?? REFERRAL_PERCENT;
  const referrals = arr(r.referrals).map(mapReferredOrg);
  const myReward = mapMyReward(r.my_reward);
  const derived = deriveSummary(referrals, myReward);
  const s = rec(r.summary);
  const eligible = arr(r.eligible_plans)
    .map((p) => str(p))
    .filter((p) => p !== '');
  return {
    code,
    percent,
    eligiblePlans: eligible.length > 0 ? eligible : DEFAULT_ELIGIBLE_PLANS,
    shareMessage: str(r.share_message) || defaultShareMessage(code, percent),
    summary: {
      referredCount: optNum(s.referred_count) ?? derived.referredCount,
      convertedCount: optNum(s.converted_count) ?? derived.convertedCount,
      rewardsAvailable: optNum(s.rewards_available) ?? derived.rewardsAvailable,
      rewardsPending: optNum(s.rewards_pending) ?? derived.rewardsPending,
      rewardsUsed: optNum(s.rewards_used) ?? derived.rewardsUsed,
    },
    referrals,
    myReward,
  };
}

/** `GET /referral/{org_id}` — this org's code, share text, reward counts, referred organisations and own reward. */
export async function getMyReferral(orgId: string): Promise<ReferralInfo> {
  const body = await api.get<unknown>(`/referral/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load your referral details');
  const info = mapReferralInfo(body);
  if (info.code === '') throw new Error('Your referral code is not available yet. Please try again.');
  return info;
}

export function mapCodeCheck(body: unknown): ReferralCodeCheck {
  const r = rec(body);
  const valid = r.valid === true || r.valid === 'true' || r.valid === 1;
  return {
    valid,
    referrerOrgName: str(pick(r, 'referrer_org_name', 'org_name')),
    message: valid ? '' : str(pick(r, 'message', 'detail')) || INVALID_CODE_MESSAGE,
  };
}

/** `GET /referral/validate?code=ABC123` — public (no login). A malformed code is answered locally without a request. */
export async function validateCode(code: string): Promise<ReferralCodeCheck> {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(clean)) return { valid: false, referrerOrgName: '', message: INVALID_CODE_MESSAGE };
  const body = await api.get<unknown>('/referral/validate', { code: clean });
  return mapCodeCheck(body);
}
