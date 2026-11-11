import { api } from '@/lib/api/client';

import { toRegisterBody } from '../mappers/auth';

import { getMyReferral, mapCodeCheck, mapReferralInfo, validateCode } from '../referral';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get', jest.Mock>;

const FULL = {
  code: 'k7m2qx',
  percent: 10,
  eligible_plans: ['Prime', 'Elite'],
  share_message: 'Join me ... use my referral code K7M2QX ...',
  summary: { referred_count: 2, converted_count: 1, rewards_available: 1, rewards_pending: 1, rewards_used: 0 },
  referrals: [
    { referral_id: 5, org_name: 'Acme Traders', joined_at: '2026-11-11T09:30:00Z', status: 'paid', reward: { reward_id: 12, status: 'available', percent: 10, used_at: null, plan_name: null, discount_amount: null } },
    {
      referral_id: 6,
      org_name: 'Beta Co',
      joined_at: '2026-11-12T09:30:00Z',
      status: 'signed_up',
      reward: { reward_id: 13, status: 'used', percent: 10, used_at: '2026-11-13T10:00:00Z', plan_name: 'Prime', discount_amount: '200.00' },
    },
  ],
  my_reward: { reward_id: 9, status: 'available', percent: 10, referred_by_org_name: 'Zed Corp', used_at: null, plan_name: null, discount_amount: null },
};

beforeEach(() => mocked.get.mockReset());

describe('mapReferralInfo', () => {
  it('maps the contract payload', () => {
    const info = mapReferralInfo(FULL);
    expect(info).toMatchObject({
      code: 'K7M2QX',
      percent: 10,
      eligiblePlans: ['Prime', 'Elite'],
      shareMessage: 'Join me ... use my referral code K7M2QX ...',
      summary: { referredCount: 2, convertedCount: 1, rewardsAvailable: 1, rewardsPending: 1, rewardsUsed: 0 },
      myReward: { id: 9, status: 'available', referredByOrgName: 'Zed Corp' },
    });
    expect(info.referrals[0]).toMatchObject({ id: 5, orgName: 'Acme Traders', status: 'paid', joinedAt: '2026-11-11T09:30:00Z', reward: { id: 12, status: 'available' } });
    expect(info.referrals[1].reward).toMatchObject({ status: 'used', planName: 'Prime', discountAmount: 200, usedAt: '2026-11-13T10:00:00Z' });
  });

  it('reads a missing my_reward as null and a null reward as no reward', () => {
    const info = mapReferralInfo({ ...FULL, my_reward: null, referrals: [{ referral_id: 1, org_name: 'X', status: 'signed_up', reward: null }] });
    expect(info.myReward).toBeNull();
    expect(info.referrals[0].reward).toBeNull();
    expect(info.referrals[0].joinedAt).toBeNull();
  });

  it('is defensive: unknown statuses, missing summary, plans, message and junk rows', () => {
    const info = mapReferralInfo({
      code: 'abc234',
      referrals: [{ org_name: 'A', status: 'weird', reward: { status: 'surprise' } }, 'junk', null, { org_name: 'B', status: 'paid', reward: { status: 'AVAILABLE' } }],
      my_reward: { status: 'used', referred_by_org_name: 'Z' },
    });
    expect(info.referrals.map((r) => [r.orgName, r.status, r.reward?.status])).toEqual([
      ['A', 'signed_up', 'pending'], // unknown reward status never reads as spendable
      ['Organisation', 'signed_up', undefined],
      ['Organisation', 'signed_up', undefined],
      ['B', 'paid', 'available'],
    ]);
    expect(info.eligiblePlans).toEqual(['Prime', 'Elite']);
    expect(info.percent).toBe(10);
    expect(info.shareMessage).toContain('ABC234');
    expect(info.summary).toEqual({ referredCount: 4, convertedCount: 1, rewardsAvailable: 1, rewardsPending: 1, rewardsUsed: 1 });
  });

  it('survives a non-object body', () => {
    expect(mapReferralInfo(null).referrals).toEqual([]);
    expect(mapReferralInfo('oops').code).toBe('');
  });
});

describe('getMyReferral', () => {
  it('GETs /referral/{org_id} (encoded)', async () => {
    mocked.get.mockResolvedValue(FULL);
    const info = await getMyReferral('org 1');
    expect(mocked.get).toHaveBeenCalledWith('/referral/org%201');
    expect(info.code).toBe('K7M2QX');
  });

  it('throws the server message when the body reports a failure and when no code came back', async () => {
    mocked.get.mockResolvedValueOnce({ success: false, message: 'Admins only' });
    await expect(getMyReferral('o1')).rejects.toThrow('Admins only');
    mocked.get.mockResolvedValueOnce({ referrals: [] });
    await expect(getMyReferral('o1')).rejects.toThrow(/not available yet/);
  });

  it('rejects a blank org id before any request', async () => {
    await expect(getMyReferral('')).rejects.toThrow();
    expect(mocked.get).not.toHaveBeenCalled();
  });
});

describe('validateCode', () => {
  it('sends the upper-cased code as a query value and maps a valid answer', async () => {
    mocked.get.mockResolvedValue({ valid: true, referrer_org_name: 'Zed Corp' });
    await expect(validateCode(' k7m2qx ')).resolves.toEqual({ valid: true, referrerOrgName: 'Zed Corp', message: '' });
    expect(mocked.get).toHaveBeenCalledWith('/referral/validate', { code: 'K7M2QX' });
  });

  it('maps an invalid answer to the server message (or the default)', async () => {
    mocked.get.mockResolvedValueOnce({ valid: false, message: 'Code expired' });
    await expect(validateCode('ABC234')).resolves.toMatchObject({ valid: false, message: 'Code expired' });
    mocked.get.mockResolvedValueOnce({ valid: false });
    await expect(validateCode('ABC234')).resolves.toMatchObject({ valid: false, message: 'This referral code is not valid' });
  });

  it('answers a malformed code locally without a request', async () => {
    await expect(validateCode('AB1')).resolves.toMatchObject({ valid: false });
    expect(mocked.get).not.toHaveBeenCalled();
  });

  it('mapCodeCheck never reads a non-true flag as valid', () => {
    expect(mapCodeCheck({ valid: 'false', referrer_org_name: 'X' }).valid).toBe(false);
    expect(mapCodeCheck(undefined).valid).toBe(false);
  });
});

describe('register request', () => {
  const base = { name: 'A', empId: '', mobile: '9876543210', email: 'a@b.co', orgName: 'A', orgAddress: 'x', gst: '', departments: ['General'], branches: ['HQ'] };

  it('carries referral_code only when a code was entered', () => {
    expect(toRegisterBody({ ...base, referralCode: 'K7M2QX' })).toMatchObject({ referral_code: 'K7M2QX' });
    expect('referral_code' in toRegisterBody(base)).toBe(false);
    expect('referral_code' in toRegisterBody({ ...base, referralCode: '' })).toBe(false);
  });
});
