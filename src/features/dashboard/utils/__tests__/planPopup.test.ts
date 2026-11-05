import type { Subscription } from '@/types/api/plans';

import {
  decidePlanPopup,
  planPopupContent,
  planPopupShownKey,
  renewParams,
  shouldShowPlanPopup,
} from '../planPopup';

const today = '2026-10-18';

describe('decidePlanPopup', () => {
  it('trial ending within 7 days (incl. today and day 7)', () => {
    expect(decidePlanPopup({ isFreeTrial: true, freeTrialEnd: '2026-10-18', today })).toEqual({ type: 'trial_expiring', endDate: '2026-10-18' });
    expect(decidePlanPopup({ isFreeTrial: true, freeTrialEnd: '2026-10-25', today })?.type).toBe('trial_expiring');
  });
  it('trial ending later than 7 days shows nothing', () => {
    expect(decidePlanPopup({ isFreeTrial: true, freeTrialEnd: '2026-10-26', today })).toBeNull();
  });
  it('an expired trial shows nothing and does not fall through to the paid-plan rule', () => {
    expect(decidePlanPopup({ isFreeTrial: true, freeTrialEnd: '2026-10-10', subscriptionEnd: '2026-10-10', today })).toBeNull();
  });
  it('a trial without an end date uses the subscription end date', () => {
    expect(decidePlanPopup({ isFreeTrial: true, freeTrialEnd: null, subscriptionEnd: '2026-10-20', today })?.type).toBe('plan_expiring');
  });
  it('paid plan: expiring within 7 days, expired after the end date, nothing otherwise', () => {
    expect(decidePlanPopup({ isFreeTrial: false, subscriptionEnd: '2026-10-22', today })).toEqual({ type: 'plan_expiring', endDate: '2026-10-22' });
    expect(decidePlanPopup({ isFreeTrial: false, subscriptionEnd: '2026-10-17', today })).toEqual({ type: 'plan_expired', endDate: '2026-10-17' });
    expect(decidePlanPopup({ isFreeTrial: false, subscriptionEnd: '2026-12-01', today })).toBeNull();
    expect(decidePlanPopup({ isFreeTrial: false, today })).toBeNull();
  });
  it('the plan is valid through its end date (not expired on the end day)', () => {
    expect(decidePlanPopup({ isFreeTrial: false, subscriptionEnd: today, today })?.type).toBe('plan_expiring');
  });
});

describe('shouldShowPlanPopup', () => {
  const decision = { type: 'plan_expiring', endDate: '2026-10-22' } as const;
  it('shows on android and web the first time', () => {
    expect(shouldShowPlanPopup({ platform: 'android', decision, alreadyShownToday: false })).toBe(true);
    expect(shouldShowPlanPopup({ platform: 'web', decision, alreadyShownToday: false })).toBe(true);
  });
  it('never on iOS', () => {
    expect(shouldShowPlanPopup({ platform: 'ios', decision, alreadyShownToday: false })).toBe(false);
  });
  it('only once per day', () => {
    expect(shouldShowPlanPopup({ platform: 'android', decision, alreadyShownToday: true })).toBe(false);
  });
  it('not without a decision', () => {
    expect(shouldShowPlanPopup({ platform: 'android', decision: null, alreadyShownToday: false })).toBe(false);
  });
});

describe('planPopupShownKey', () => {
  it('is scoped by day AND organisation', () => {
    const a = planPopupShownKey('org-1', '2026-10-18');
    expect(a).toContain('2026-10-18');
    expect(a).toContain('org-1');
    expect(a).not.toBe(planPopupShownKey('org-2', '2026-10-18'));
    expect(a).not.toBe(planPopupShownKey('org-1', '2026-10-19'));
    expect(a.startsWith('@clockyn/')).toBe(true);
  });
});

describe('planPopupContent (v1 copy)', () => {
  it('trial', () => {
    expect(planPopupContent('trial_expiring', '2026-10-25')).toMatchObject({
      title: 'Free Trial Ending Soon',
      message: 'Your free trial ends on 25 Oct 2026. Upgrade now to keep access to all features.',
      primaryLabel: 'Upgrade Plan',
      dismissible: true,
    });
  });
  it('expiring', () => {
    expect(planPopupContent('plan_expiring', '2026-10-22')).toMatchObject({
      title: 'Plan Expiring Soon',
      message: 'Your plan expires on 22 Oct 2026. Renew now to avoid interruption.',
      primaryLabel: 'Renew Plan',
      dismissible: true,
    });
  });
  it('expired cannot be dismissed', () => {
    expect(planPopupContent('plan_expired', '2026-10-10')).toMatchObject({
      title: 'Plan Expired',
      message: 'Your plan expired on 10 Oct 2026. Please renew to continue using all features.',
      primaryLabel: 'Renew Plan',
      dismissible: false,
      tone: 'danger',
    });
  });
});

describe('renewal params', () => {
  const sub = (over: Partial<Subscription> = {}): Subscription => ({
    planId: 2,
    planName: 'Prime',
    planAmount: 4999,
    planMonths: 12,
    startDate: '2025-10-25',
    endDate: '2026-10-25',
    staffLimit: 25,
    status: 'ACTIVE',
    isExpired: false,
    isFreeTrial: false,
    freeTrialEnd: null,
    billingDate: null,
    raw: {},
    ...over,
  });

  it('renews through the billing upgrade screen in renew mode (it derives the rest from its cache)', () => {
    expect(renewParams(sub())).toEqual({ mode: 'renew' });
    expect(renewParams(sub({ endDate: '2026-09-01' }))).toEqual({ mode: 'renew' });
  });
  it('has nothing to renew without a plan', () => {
    expect(renewParams(sub({ planId: null }))).toBeNull();
    expect(renewParams(null)).toBeNull();
  });
});
