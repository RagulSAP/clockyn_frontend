'use strict';
/* Referral part of the operator mock (admin console, pages/referrals.html). In-memory, reset with the rest of the mock.
 * Follows the API contract of /gen-dashboard/referrals (C2C percent config) and /gen-dashboard/referrals/b2c (promoter codes, details, payouts).
 * Writes need role 1 (super operator), like the real routes (require_operator_super). */

const PLATFORMS = ['youtube', 'instagram', 'facebook', 'x', 'linkedin', 'whatsapp', 'telegram', 'blog', 'other'];
const r2 = (n) => Math.round(Number(n) * 100) / 100;

function seed() {
  return {
    percent: 10,
    cfgMeta: { updated_at: null, updated_by: null },
    nextId: 2,
    nextPayout: 1,
    partners: [{
      partner_id: 1, code: 'TECH55', platform: 'youtube', channel_name: 'Tech With Ravi', channel_url: 'https://youtube.com/@techwithravi',
      contact_name: 'Ravi Kumar', phone: '+91 98765 43210', email: 'ravi@example.com', address: '12 MG Road, Chennai', notes: 'Monthly review video',
      discount_percent: 15, reward_valid_days: 30, commission_type: 'percent', commission_value: 10, status: 'active',
      created_at: '2026-10-01T05:00:00Z', created_by: 'admin@clockyn.test',
      customers: [
        { referral_id: 11, org_id: 'o-1', org_name: 'Sharma Traders', signed_up_at: '2026-10-05T06:00:00Z', status: 'paid', qualified_at: '2026-10-08T06:00:00Z', plan_name: 'Prime', first_payment: 4900, discount_amount: 735, reward_status: 'used', reward_expires_at: '2026-11-04T06:00:00Z' },
        { referral_id: 12, org_id: 'o-2', org_name: 'Green Mart', signed_up_at: '2026-10-20T06:00:00Z', status: 'signed_up', qualified_at: null, plan_name: null, first_payment: null, discount_amount: null, reward_status: 'available', reward_expires_at: '2026-11-19T06:00:00Z' },
        { referral_id: 13, org_id: 'o-3', org_name: 'Blue Logistics', signed_up_at: '2026-09-02T06:00:00Z', status: 'signed_up', qualified_at: null, plan_name: null, first_payment: null, discount_amount: null, reward_status: 'expired', reward_expires_at: '2026-10-02T06:00:00Z' },
      ],
      payouts: [],
    }],
  };
}

function createReferralMock() {
  let s = seed();

  function commissionFor(p, c) {
    if (c.status !== 'paid') return null;
    if (p.commission_type === 'percent') return r2(Number(c.first_payment || 0) * p.commission_value / 100);
    if (p.commission_type === 'fixed') return r2(p.commission_value);
    return 0;
  }
  function view(p) {
    const paidCustomers = p.customers.filter((c) => c.status === 'paid');
    const earned = r2(paidCustomers.reduce((a, c) => a + commissionFor(p, c), 0));
    const paid = r2(p.payouts.filter((x) => x.status !== 'voided').reduce((a, x) => a + x.amount, 0));      // voided payouts do not count
    const { customers, payouts, ...rest } = p;
    return Object.assign({}, rest, {
      signups: customers.length, converted: paidCustomers.length, revenue: r2(paidCustomers.reduce((a, c) => a + Number(c.first_payment || 0), 0)),
      commission_earned: earned, commission_paid: paid, commission_due: r2(earned - paid),
    });
  }
  function validate(b, creating) {
    const bad = (m) => [400, { detail: m }];
    if (creating && !/^[A-Z0-9]{6}$/.test(String(b.code || ''))) return bad('Code must be exactly 6 letters or digits');
    if (PLATFORMS.indexOf(b.platform) < 0) return bad('Choose a platform');
    if (!String(b.channel_name || '').trim()) return bad('Enter the channel name');
    const pct = Number(b.discount_percent);
    if (!Number.isInteger(pct) || pct < 1 || pct > 50) return bad('Discount must be a whole number from 1 to 50');
    if (b.reward_valid_days != null && (!Number.isInteger(Number(b.reward_valid_days)) || Number(b.reward_valid_days) < 1)) return bad('reward_valid_days must be 1 or more');
    if (['none', 'percent', 'fixed'].indexOf(b.commission_type) < 0) return bad('commission_type must be none, percent or fixed');
    if (b.commission_type !== 'none' && !(Number(b.commission_value) > 0)) return bad('Commission value must be above 0');
    return null;
  }
  const fields = (b) => ({
    platform: b.platform, channel_name: String(b.channel_name).trim(), channel_url: b.channel_url || null, contact_name: b.contact_name || null,
    phone: b.phone || null, email: b.email || null, address: b.address || null, notes: b.notes || null, discount_percent: Number(b.discount_percent),
    reward_valid_days: b.reward_valid_days == null ? null : Number(b.reward_valid_days), commission_type: b.commission_type,
    commission_value: b.commission_type === 'none' ? 0 : Number(b.commission_value),
  });

  /* returns [status, body] or null when the path is not a referral route */
  function handle(method, path, q, b, role, who) {
    if (path.indexOf('/gen-dashboard/referrals') !== 0) return null;
    const rest = path.slice('/gen-dashboard/referrals'.length);
    const write = method !== 'GET';
    if (write && rest.indexOf('/rewards/') !== 0 && role !== 1) return [403, { detail: 'Super admin only' }];

    if (rest === '' && method === 'GET') {
      return [200, { summary: { total_referrals: 0, converted: 0, rewards_issued: 0, rewards_available: 0, rewards_pending: 0, rewards_used: 0, discount_given: 0 },
        top_referrers: [], referrals: [], percent: s.percent }];
    }
    if (rest === '/config') {
      if (method === 'PUT') {
        const n = Number(b.c2c_percent);
        if (!Number.isInteger(n) || n < 1 || n > 50) return [400, { detail: 'c2c_percent must be a whole number from 1 to 50' }];
        s.percent = n; s.cfgMeta = { updated_at: new Date().toISOString(), updated_by: who };
      }
      return [200, Object.assign({ c2c_percent: s.percent, min_percent: 1, max_percent: 50 }, s.cfgMeta)];
    }
    if (rest === '/b2c' && method === 'GET') {
      const text = String(q.get('q') || '').toLowerCase(), st = q.get('status') || 'all';
      const list = s.partners.map(view).filter((p) => (st === 'all' || p.status === st)
        && (!text || [p.code, p.channel_name, p.contact_name, p.phone, p.email].some((x) => String(x || '').toLowerCase().indexOf(text) >= 0)));
      const sum = (k) => r2(list.reduce((a, p) => a + p[k], 0));
      return [200, { summary: { partners: list.length, active: list.filter((p) => p.status === 'active').length, signups: sum('signups'), converted: sum('converted'),
        revenue: sum('revenue'), discount_given: 735, commission_earned: sum('commission_earned'), commission_paid: sum('commission_paid'), commission_due: sum('commission_due') }, partners: list }];
    }
    if (rest === '/b2c' && method === 'POST') {
      const err = validate(b, true);
      if (err) return err;
      if (s.partners.some((p) => p.code === b.code)) return [409, { detail: 'This code is already in use' }];
      const p = Object.assign({ partner_id: s.nextId++, code: b.code, status: 'active', created_at: new Date().toISOString(), created_by: who, customers: [], payouts: [] }, fields(b));
      s.partners.push(p);
      return [200, { partner: view(p) }];
    }
    let m = /^\/b2c\/(\d+)$/.exec(rest);
    if (m) {
      const p = s.partners.find((x) => x.partner_id === Number(m[1]));
      if (!p) return [404, { detail: 'Promoter not found' }];
      if (method === 'PUT') {
        const err = validate(b, false);
        if (err) return err;
        Object.assign(p, fields(b), { status: b.status === 'inactive' ? 'inactive' : 'active' });
        return [200, { partner: view(p) }];
      }
      const v = view(p), paidN = v.converted;
      return [200, { partner: v,
        insights: { signups: v.signups, converted: paidN, conversion_rate: v.signups ? r2(100 * paidN / v.signups) : 0, revenue: v.revenue, discount_given: 735,
          commission_earned: v.commission_earned, commission_paid: v.commission_paid, commission_due: v.commission_due,
          rewards_used: p.customers.filter((c) => c.reward_status === 'used').length, rewards_expired: p.customers.filter((c) => c.reward_status === 'expired').length,
          last_signup_at: p.customers.length ? p.customers[0].signed_up_at : null,
          monthly: [{ month: '2026-09', signups: 1, converted: 0, revenue: 0 }, { month: '2026-10', signups: 2, converted: 1, revenue: 4900 }],
          plans: paidN ? [{ plan_name: 'Prime', customers: paidN }] : [] },
        customers: p.customers.map((c) => Object.assign({ commission_amount: commissionFor(p, c) }, c)),
        payouts: p.payouts.slice().reverse() }];
    }
    m = /^\/b2c\/(\d+)\/payouts$/.exec(rest);
    if (m && method === 'POST') {
      const p = s.partners.find((x) => x.partner_id === Number(m[1]));
      if (!p) return [404, { detail: 'Promoter not found' }];
      const due = view(p).commission_due, amount = Number(b.amount);
      if (!(amount > 0)) return [400, { detail: 'Amount must be above 0' }];
      if (amount > due + 0.005) return [400, { detail: 'Amount is more than the commission due' }];
      const payout = { payout_id: s.nextPayout++, amount: r2(amount), paid_on: b.paid_on, reference: b.reference || null, note: b.note || null, created_by: who, created_at: new Date().toISOString(),
        status: 'paid', voided_at: null, voided_by: null, void_reason: null };
      p.payouts.push(payout);
      return [200, { payout, partner: view(p) }];
    }
    m = /^\/b2c\/(\d+)\/payouts\/(\d+)\/void$/.exec(rest);
    if (m && method === 'POST') {
      const p = s.partners.find((x) => x.partner_id === Number(m[1]));
      if (!p) return [404, { detail: 'Partner code not found' }];
      const payout = p.payouts.find((x) => x.payout_id === Number(m[2]));
      if (!payout) return [404, { detail: 'Payout not found' }];
      if (payout.status === 'voided') return [409, { detail: 'This payout is already voided' }];
      if (b.reason != null && String(b.reason).length > 300) return [400, { detail: 'Reason can be at most 300 characters' }];
      Object.assign(payout, { status: 'voided', voided_at: new Date().toISOString(), voided_by: who, void_reason: String(b.reason || '').trim() || null });
      return [200, { payout, partner: view(p) }];
    }
    return null;
  }

  return { handle, reset: () => { s = seed(); } };
}

module.exports = { createReferralMock };
