'use strict';
/**
 * Refer & Earn (contract: referral_contract.md). `GET /referral/validate?code=` is public, `GET /referral/:org_id` is the org
 * admin's page, and `/auth/register` (routes/auth.js) calls `referralAtSignup` for the optional `referral_code`.
 *
 * Seed for the demo org `org-0001` (code K7M2QX): three referred organisations — one paid whose reward is USED (Prime, Rs 200 off),
 * one paid whose reward is AVAILABLE and one only signed up (reward PENDING). `ZED4PQ` belongs to the external "Zed Corp".
 * `CHANL5` is a B2C (promoter) code of the channel "Tech Talk Hindi": 15 % off, the reward is valid for 30 days after sign-up.
 * C2C_PERCENT is the ONE place the mock's customer-to-customer percent lives (billing.js imports it); B2C codes carry their own.
 * State is created lazily per tenant (`s.referral`) and dropped by `/__test/reset` like everything else.
 */
const { fail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const C2C_PERCENT = 10;
const PERCENT = C2C_PERCENT;
const INVALID = 'This referral code is not valid';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const EXTERNAL = { ZED4PQ: 'Zed Corp' };
const B2C = { CHANL5: { name: 'Tech Talk Hindi', percent: 15, validDays: 30 } };
const DEMO_CODE = 'K7M2QX';

const daysAgo = (n) => `${T.addDays(T.today(), -n)}T09:30:00+05:30`;

function seedReferral(s) {
  const home = s.orgs[0].org_id;
  return {
    codes: { [home]: DEMO_CODE },
    nextReferralId: 4,
    nextRewardId: 20,
    /** Referrals keyed by referrer org id. */
    rows: {
      [home]: [
        { referral_id: 1, org_name: 'Sunrise Traders', joined_at: daysAgo(34), status: 'paid', reward: { reward_id: 11, status: 'used', percent: PERCENT, used_at: daysAgo(12), plan_name: 'Prime', discount_amount: 200 } },
        { referral_id: 2, org_name: 'Blue Orchid Retail', joined_at: daysAgo(9), status: 'paid', reward: { reward_id: 12, status: 'available', percent: PERCENT, used_at: null, plan_name: null, discount_amount: null } },
        { referral_id: 3, org_name: 'Greenfield Logistics', joined_at: daysAgo(2), status: 'signed_up', reward: { reward_id: 13, status: 'pending', percent: PERCENT, used_at: null, plan_name: null, discount_amount: null } },
      ],
    },
    /** The reward an org received for signing up with a code, keyed by the referred org id. */
    mine: {},
  };
}

const state = (s) => (s.referral || (s.referral = seedReferral(s)));

function codeFor(s, orgId) {
  const r = state(s);
  if (!r.codes[orgId]) {
    const n = Object.keys(r.codes).length + 1;
    let body = '';
    for (let i = 0, x = n * 7919; i < 4; i += 1, x = Math.floor(x / CODE_ALPHABET.length)) body = CODE_ALPHABET[x % CODE_ALPHABET.length] + body;
    r.codes[orgId] = `M${n % 8 + 2}${body}`.slice(0, 6);
  }
  return r.codes[orgId];
}

/** Who owns `code`: `{ orgId, name, kind, percent }` for a real org of the tenant, an external referrer or a B2C channel, else null. */
function ownerOf(s, code) {
  const c = String(code || '').trim().toUpperCase();
  const r = state(s);
  for (const org of s.orgs) if (codeFor(s, org.org_id) === c) return { orgId: org.org_id, name: org.org_name, kind: 'c2c', percent: C2C_PERCENT };
  if (EXTERNAL[c]) return { orgId: null, name: EXTERNAL[c], kind: 'c2c', percent: C2C_PERCENT };
  if (B2C[c]) return { orgId: null, name: B2C[c].name, kind: 'b2c', percent: B2C[c].percent, validDays: B2C[c].validDays };
  return null;
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/** `/auth/register` calls this BEFORE creating anything: an unknown code answers 400 and nothing is registered. */
function assertReferralCode(s, referralCode) {
  if (!isBlank(referralCode) && !ownerOf(s, referralCode)) fail(400, INVALID);
}

/** Called by `/auth/register` for the new org: records both rewards (the code was checked by `assertReferralCode`). */
function referralAtSignup(s, referralCode, newOrg) {
  if (isBlank(referralCode)) return;
  const owner = ownerOf(s, referralCode);
  if (!owner) return;
  const r = state(s);
  r.mine[newOrg.org_id] = {
    reward_id: (r.nextRewardId += 1),
    status: 'available',
    percent: owner.percent,
    kind: owner.kind,
    expires_at: owner.validDays ? `${T.addDays(T.today(), owner.validDays)}T23:59:59+05:30` : null,
    referred_by_org_name: owner.name,
    used_at: null,
    plan_name: null,
    discount_amount: null,
  };
  if (owner.orgId) {
    (r.rows[owner.orgId] = r.rows[owner.orgId] || []).push({
      referral_id: (r.nextReferralId += 1),
      org_name: newOrg.org_name,
      joined_at: T.isoNow(),
      status: 'signed_up',
      reward: { reward_id: (r.nextRewardId += 1), status: 'pending', percent: PERCENT, used_at: null, plan_name: null, discount_amount: null },
    });
  }
}

/** A reward with a validity period whose end has passed can no longer be used (what the real server reports as `expired`). */
function expireDue(s) {
  const r = s.referral;
  if (!r) return;
  const now = T.now().getTime();   // the mock clock, so a shifted test clock expires rewards consistently
  for (const rw of Object.values(r.mine)) {
    if (rw.status === 'available' && rw.expires_at && Date.parse(rw.expires_at) < now) rw.status = 'expired';
  }
}

function page(s, orgId) {
  expireDue(s);
  const r = state(s);
  const code = codeFor(s, orgId);
  const rows = (r.rows[orgId] || []).slice().sort((a, b) => (a.joined_at < b.joined_at ? 1 : -1));
  const mine = r.mine[orgId] ? { kind: 'c2c', expires_at: null, ...r.mine[orgId] } : null;
  const rewards = rows.map((x) => x.reward).concat(mine ? [mine] : []);
  const count = (st) => rewards.filter((x) => x.status === st).length;
  return {
    code,
    percent: C2C_PERCENT,
    eligible_plans: ['Prime', 'Elite'],
    share_message: `Join me on Clockyn, the staff attendance and workforce app. Use my referral code ${code} when you create your account and we both get ${C2C_PERCENT}% off our plan.`,
    summary: { referred_count: rows.length, converted_count: rows.filter((x) => x.status === 'paid').length, rewards_available: count('available'), rewards_pending: count('pending'), rewards_used: count('used') },
    referrals: rows,
    my_reward: mine,
  };
}

function register(r) {
  // specific path first: `:org_id` would also match "validate"
  r.get('/referral/validate', (c) => {
    const code = String(c.q.code || '').trim().toUpperCase();
    const owner = /^[A-Z0-9]{6}$/.test(code) ? ownerOf(c.s, code) : null;
    return owner ? { valid: true, referrer_org_name: owner.name, kind: owner.kind, percent: owner.percent } : { valid: false, message: INVALID };
  });
  r.get('/referral/:org_id', (c) => page(c.s, D.resolveOrg(c.s, c.p.org_id)));
}

module.exports = { register, assertReferralCode, referralAtSignup, expireDue, C2C_PERCENT };
