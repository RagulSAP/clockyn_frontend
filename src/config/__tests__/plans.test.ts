import {
  PLAN_BLOCKED_FEATURES,
  PLAN_FEATURES,
  PLAN_IDS,
  PLAN_NAMES,
  PLAN_PANEL_MESSAGES,
  isFeatureBlocked,
  isPlanFeatureBlocked,
  minimumPlanFor,
  planBlockMessage,
  planBlockMessageFor,
  planName,
  type OrgPlanStatus,
  type PlanFeature,
} from '../plans';

const status = (plan_id: number | null, is_free_trial = false, is_expired = false): OrgPlanStatus => ({
  plan_id,
  is_free_trial,
  is_expired,
});

describe('plan ids and names', () => {
  it('maps ids to names', () => {
    expect(PLAN_IDS).toEqual({ core: 1, prime: 2, elite: 3 });
    expect(PLAN_NAMES).toEqual({ 1: 'Core', 2: 'Prime', 3: 'Elite' });
    expect(planName(2)).toBe('Prime');
    expect(planName(9)).toBe('');
    expect(planName(null)).toBe('');
  });
});

describe('isFeatureBlocked matrix', () => {
  const blocked = (s: OrgPlanStatus): PlanFeature[] => PLAN_FEATURES.filter((f) => isFeatureBlocked(s, f));

  it('free trial allows everything (even when flagged expired / without plan)', () => {
    expect(blocked(status(null, true))).toEqual([]);
    expect(blocked(status(1, true))).toEqual([]);
    expect(blocked(status(null, true, true))).toEqual([]);
  });
  it('expired (not trial) blocks all five features', () => {
    expect(blocked(status(3, false, true))).toEqual([...PLAN_FEATURES]);
    expect(blocked(status(1, false, true))).toEqual([...PLAN_FEATURES]);
  });
  it('no plan blocks all five features', () => {
    expect(blocked(status(null))).toEqual([...PLAN_FEATURES]);
  });
  it('Core blocks staff_location and crm only', () => {
    expect(blocked(status(1))).toEqual(['staff_location', 'crm']);
  });
  it('Prime blocks crm only', () => {
    expect(blocked(status(2))).toEqual(['crm']);
  });
  it('Elite blocks nothing', () => {
    expect(blocked(status(3))).toEqual([]);
  });
  it('unknown plan id is not blocked', () => {
    expect(blocked(status(4))).toEqual([]);
  });
  it('chat, salary_structure and camera_punch never block on an active paid plan', () => {
    for (const row of Object.values(PLAN_BLOCKED_FEATURES)) {
      expect(row).not.toContain('chat');
      expect(row).not.toContain('salary_structure');
      expect(row).not.toContain('camera_punch');
    }
  });
  it('fails open when status is unknown', () => {
    expect(isFeatureBlocked(null, 'crm')).toBe(false);
    expect(isFeatureBlocked(undefined, 'crm')).toBe(false);
  });
  it('primitive variant agrees', () => {
    expect(isPlanFeatureBlocked(1, false, false, 'crm')).toBe(true);
    expect(isPlanFeatureBlocked(undefined, false, false, 'chat')).toBe(true);
  });
});

describe('planBlockMessage', () => {
  it('is empty for free trial', () => {
    expect(planBlockMessage(null, true, true)).toBe('');
  });
  it('uses the verbatim v1 texts for admins', () => {
    const ended = 'Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.';
    expect(planBlockMessage(null, false, false)).toBe(ended);
    expect(planBlockMessage(2, false, true)).toBe(ended);
    expect(planBlockMessage(1, false, false)).toBe('This feature is available only in the Prime plan. Please upgrade your plan to access it.');
    expect(planBlockMessage(2, false, false)).toBe('This feature is available only in the Elite plan. Please upgrade your plan to access it.');
    expect(planBlockMessage(3, false, false)).toBe('Please upgrade your plan to access this feature.');
  });
  it('tells staff to contact their admin', () => {
    expect(planBlockMessage(null, false, true, 'staff')).toBe(PLAN_PANEL_MESSAGES.staff);
    expect(planBlockMessage(1, false, false, 'staff')).toMatch(/contact your admin/);
    expect(planBlockMessage(1, true, false, 'staff')).toBe('');
  });
  it('panel messages', () => {
    expect(PLAN_PANEL_MESSAGES.admin).toBe('Your plan has expired. Please renew your plan to continue using this feature.');
    expect(PLAN_PANEL_MESSAGES.staff).toBe('Your plan has expired. Please contact your admin.');
  });
  it('status variant', () => {
    expect(planBlockMessageFor(status(1))).toMatch(/Prime/);
    expect(planBlockMessageFor(null)).toBe('');
  });
  it('contains no legacy product names', () => {
    const all = [PLAN_PANEL_MESSAGES.admin, PLAN_PANEL_MESSAGES.staff, planBlockMessage(null, false, false), planBlockMessage(1, false, false)].join(' ');
    expect(all.toLowerCase()).not.toContain('punch');
  });
});

describe('minimumPlanFor', () => {
  it('finds the cheapest unlocking plan', () => {
    expect(minimumPlanFor('crm')).toBe(3);
    expect(minimumPlanFor('staff_location')).toBe(2);
    expect(minimumPlanFor('chat')).toBeNull();
  });
});
