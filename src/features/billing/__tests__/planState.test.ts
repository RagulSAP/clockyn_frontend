import type { Plan, Subscription } from '@/types/api/plans';

import { canPurchase, showWebPortalLink } from '../utils/platformPolicy';
import {
  billingSentence,
  deriveBillingState,
  groupPlans,
  isActiveTier,
  isTierDisabled,
  planFeatureIds,
  planFeatureList,
  planRank,
  remainingStaff,
} from '../utils/planState';

const TODAY = '2026-10-18';

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  planId: 1,
  planName: 'Core',
  planAmount: 25,
  planMonths: 6,
  startDate: '2026-08-01',
  endDate: '2027-02-10',
  staffLimit: 12,
  status: 'ACTIVE',
  isExpired: false,
  isFreeTrial: false,
  freeTrialEnd: null,
  billingDate: null,
  raw: {},
  ...over,
});

describe('deriveBillingState (backend returns a placeholder object for no-plan orgs)', () => {
  it('paid-active while the end date is today or later', () => {
    expect(deriveBillingState(sub(), TODAY)).toBe('paid-active');
    expect(deriveBillingState(sub({ endDate: TODAY }), TODAY)).toBe('paid-active');
  });

  it('paid-expired after the end date', () => {
    expect(deriveBillingState(sub({ endDate: '2026-10-17', isExpired: true }), TODAY)).toBe('paid-expired');
  });

  it('trial-active for the placeholder with an active trial (no plan id)', () => {
    const trial = sub({ planId: null, planName: 'Free Trial', endDate: '2026-10-25', isFreeTrial: true, freeTrialEnd: '2026-10-25', staffLimit: 10 });
    expect(deriveBillingState(trial, TODAY)).toBe('trial-active');
  });

  it('a paid active plan overrides a stale trial flag', () => {
    expect(deriveBillingState(sub({ isFreeTrial: true, freeTrialEnd: '2026-10-25' }), TODAY)).toBe('paid-active');
  });

  it('none for a lapsed trial / no plan, and for a missing subscription', () => {
    expect(deriveBillingState(sub({ planId: null, planName: null, endDate: '2026-09-01', isFreeTrial: false }), TODAY)).toBe('none');
    expect(deriveBillingState(sub({ planId: null, planName: null, isFreeTrial: true, freeTrialEnd: '2026-10-01' }), TODAY)).toBe('none');
    expect(deriveBillingState(null, TODAY)).toBe('none');
    expect(deriveBillingState(undefined, TODAY)).toBe('none');
  });

  it('sentences', () => {
    expect(billingSentence('trial-active', '25 Oct 2026')).toBe('Free trial ends on 25 Oct 2026');
    expect(billingSentence('paid-active', '')).toBe('Your subscription is active and running');
    expect(billingSentence('paid-expired', '')).toBe('Your plan has expired. Please renew.');
    expect(billingSentence('none', '')).toBe('Subscribe to unlock all features');
  });

  it('remaining staff never goes below 0', () => {
    expect(remainingStaff(12, 5)).toBe(7);
    expect(remainingStaff(10, 14)).toBe(0);
    expect(remainingStaff(null, 3)).toBe(0);
  });
});

describe('plan catalogue', () => {
  const plans: Plan[] = [
    { id: 1, name: 'Core', amount: 25, months: 12 },
    { id: 2, name: 'Core', amount: 30, months: 1 },
    { id: 3, name: 'Prime', amount: 40, months: 6 },
    { id: 4, name: 'prime', amount: 35, months: 12 },
    { id: 5, name: 'Elite', amount: 60, months: 1 },
  ];

  it('groups by lower-cased name in order of first appearance, tiers ascending by duration', () => {
    const g = groupPlans(plans);
    expect(g.map((x) => x.key)).toEqual(['core', 'prime', 'elite']);
    expect(g[0].tiers.map((t) => t.months)).toEqual([1, 12]);
    expect(g[1].tiers.map((t) => t.id)).toEqual([3, 4]);
  });

  it('plan ranks', () => {
    expect(planRank('Core')).toBe(0);
    expect(planRank(' PRIME ')).toBe(1);
    expect(planRank('Elite')).toBe(2);
    expect(planRank('Gold')).toBe(-1);
    expect(planRank(null)).toBe(-1);
  });
});

describe('downgrade matrix (subscription §14: active Prime 6 months)', () => {
  const active = { isActive: true, planName: 'Prime', planMonths: 6 };
  const disabled = (name: string, months: number) => isTierDisabled(active, { name, months });

  it('Core: every duration disabled', () => {
    expect([1, 6, 12].map((m) => disabled('Core', m))).toEqual([true, true, true]);
  });
  it('Prime: 1 and 6 months disabled, 12 months enabled', () => {
    expect([1, 6, 12].map((m) => disabled('Prime', m))).toEqual([true, true, false]);
  });
  it('Elite: 1 month disabled, 6 and 12 months enabled', () => {
    expect([1, 6, 12].map((m) => disabled('Elite', m))).toEqual([true, false, false]);
  });
  it('nothing is disabled when no paid plan is active', () => {
    expect(isTierDisabled({ isActive: false, planName: 'Prime', planMonths: 6 }, { name: 'Core', months: 1 })).toBe(false);
  });

  it('the active tier is the running plan id while active', () => {
    const s = sub({ planId: 3 });
    expect(isActiveTier(s, 'paid-active', { id: 3, name: 'Prime', amount: 40, months: 6 })).toBe(true);
    expect(isActiveTier(s, 'paid-active', { id: 4, name: 'Prime', amount: 35, months: 12 })).toBe(false);
    expect(isActiveTier(s, 'paid-expired', { id: 3, name: 'Prime', amount: 40, months: 6 })).toBe(false);
  });
});

describe('features per plan', () => {
  it('core 3, prime 4, elite 5 feature chips; unknown plans get the Core set', () => {
    expect(planFeatureIds('Core')).toEqual(['chat', 'payslips', 'geofencing']);
    expect(planFeatureIds('Prime')).toHaveLength(4);
    expect(planFeatureIds('Elite')).toHaveLength(5);
    expect(planFeatureIds('Mystery')).toEqual(['chat', 'payslips', 'geofencing']);
    expect(planFeatureList('Elite')).toContain('CRM');
    expect(planFeatureList('Core')).not.toContain('CRM');
    expect(planFeatureList('Mystery')).toEqual([]);
  });
});

describe('platform policy', () => {
  it('iOS is view-only; Android and web can purchase', () => {
    expect(canPurchase('ios')).toBe(false);
    expect(canPurchase('android')).toBe(true);
    expect(canPurchase('web')).toBe(true);
  });

  it('the web portal link is Android-only and hidden when no URL is configured', () => {
    expect(showWebPortalLink('android', 'https://example.com')).toBe(true);
    expect(showWebPortalLink('android', '')).toBe(false);
    expect(showWebPortalLink('android', '   ')).toBe(false);
    expect(showWebPortalLink('ios', 'https://example.com')).toBe(false);
    expect(showWebPortalLink('web', 'https://example.com')).toBe(false);
  });
});
