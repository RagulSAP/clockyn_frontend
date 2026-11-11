'use strict';
/**
 * Refer & Earn (contract: referral_contract.md). `GET /referral/validate?code=` is public, `GET /referral/:org_id` is the org
 * admin's page, and `/auth/register` (routes/auth.js) calls `referralAtSignup` for the optional `referral_code`.
 *
 * Seed for the demo org `org-0001` (code K7M2QX): three referred organisations — one paid whose reward is USED (Prime, Rs 200 off),
 * one paid whose reward is AVAILABLE and one only signed up (reward PENDING). `ZED4PQ` belongs to the external "Zed Corp".
 * State is created lazily per tenant (`s.referral`) and dropped by `/__test/reset` like everything else.
 */
const { fail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const PERCENT = 10;
const INVALID = 'This referral code is not valid';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const EXTERNAL = { ZED4PQ: 'Zed Corp' };
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

/** Who owns `code`: `{ orgId, name }` for a real org of the tenant or an external referrer, else null. */
function ownerOf(s, code) {
  const c = String(code || '').trim().toUpperCase();
  const r = state(s);
  for (const org of s.orgs) if (codeFor(s, org.org_id) === c) return { orgId: org.org_id, name: org.org_name };
  if (EXTERNAL[c]) return { orgId: null, name: EXTERNAL[c] };
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
  r.mine[newOrg.org_id] = { reward_id: (r.nextRewardId += 1), status: 'available', percent: PERCENT, referred_by_org_name: owner.name, used_at: null, plan_name: null, discount_amount: null };
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

function page(s, orgId) {
  const r = state(s);
  const code = codeFor(s, orgId);
  const rows = (r.rows[orgId] || []).slice().sort((a, b) => (a.joined_at < b.joined_at ? 1 : -1));
  const mine = r.mine[orgId] || null;
  const rewards = rows.map((x) => x.reward).concat(mine ? [mine] : []);
  const count = (st) => rewards.filter((x) => x.status === st).length;
  return {
    code,
    percent: PERCENT,
    eligible_plans: ['Prime', 'Elite'],
    share_message: `Join me on Clockyn, the staff attendance and workforce app. Use my referral code ${code} when you create your account and we both get ${PERCENT}% off our plan.`,
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
    return owner ? { valid: true, referrer_org_name: owner.name } : { valid: false, message: INVALID };
  });
  r.get('/referral/:org_id', (c) => page(c.s, D.resolveOrg(c.s, c.p.org_id)));
}

module.exports = { register, assertReferralCode, referralAtSignup };
