'use strict';
/* Plans part of the operator mock (admin console, pages/subscriptions.html). In-memory.
 * Mirrors the backend:
 *   GET    /gen-dashboard/plan-breakdown   [{plan_id, plan_name, plan_amount, plan_month, active_count}]   (NO free months / offer text, like the real route today)
 *   GET    /plans/all                      {success, data: [{plan_id, plan_name, plan_amount, plan_month, plan_free_months, plan_offer_text}]}
 *   POST   /plans/                         {plan_name, plan_amount, plan_month, free_months, offer_text}
 *   PUT    /plans/{id}                     same; free_months / offer_text are KEPT when omitted (null), offer_text "" clears
 *   DELETE /plans/{id}
 * Rules (400 {detail}): plan_month >= 1, free_months 0..plan_month-1, offer_text <= 80; one plan per (name, duration): 409.
 * Test controls: POST /plans/__reset, GET /plans/__log (the bodies the page sent). The routes are reached through ONE line in operator-mock.js. */

function seed() {
  return {
    nextId: 20,
    log: [],
    plans: [
      { plan_id: 1, plan_name: 'Core', plan_amount: 49, plan_month: 1, plan_free_months: 0, plan_offer_text: null, active_count: 5 },
      { plan_id: 4, plan_name: 'Core', plan_amount: 49, plan_month: 6, plan_free_months: 1, plan_offer_text: 'Pay 5 months, get 1 free', active_count: 3 },
      { plan_id: 7, plan_name: 'Core', plan_amount: 49, plan_month: 12, plan_free_months: 2, plan_offer_text: null, active_count: 2 },
      { plan_id: 2, plan_name: 'Prime', plan_amount: 99, plan_month: 1, plan_free_months: 0, plan_offer_text: null, active_count: 4 },
      { plan_id: 3, plan_name: 'Elite', plan_amount: 149, plan_month: 1, plan_free_months: 0, plan_offer_text: null, active_count: 1 },
      { plan_id: 9, plan_name: 'Starter', plan_amount: 29, plan_month: 3, plan_free_months: 0, plan_offer_text: null, active_count: 0 },
    ],
  };
}

let s = seed();

function terms(month, free, text) {
  if (!Number.isInteger(month) || month < 1) return [400, { detail: 'plan_month must be at least 1' }];
  if (!Number.isInteger(free) || free < 0 || free >= month) return [400, { detail: 'free_months must be from 0 to one less than plan_month' }];
  if (String(text || '').length > 80) return [400, { detail: 'offer_text can be at most 80 characters' }];
  return null;
}
const dup = (name, month, exceptId) => s.plans.some((p) => p.plan_name.toLowerCase() === String(name).toLowerCase() && p.plan_month === month && p.plan_id !== exceptId);
const dupMsg = (name, month) => [409, { detail: 'A ' + name + ' plan for ' + month + ' month(s) already exists. Edit that one instead.' }];
const pub = (p) => ({ plan_id: p.plan_id, plan_name: p.plan_name, plan_amount: p.plan_amount, plan_month: p.plan_month, plan_free_months: p.plan_free_months, plan_offer_text: p.plan_offer_text });

/* returns [status, body] or null when the path is not a plans route */
function handle(method, path, body) {
  const b = body || {};
  if (path === '/plans/__reset' && method === 'POST') { s = seed(); return [200, { ok: true }]; }
  if (path === '/plans/__log') return [200, s.log];
  if (path === '/gen-dashboard/plan-breakdown' && method === 'GET') {
    return [200, s.plans.slice().sort((a, c) => a.plan_amount - c.plan_amount)
      .map((p) => ({ plan_id: p.plan_id, plan_name: p.plan_name, plan_amount: p.plan_amount, plan_month: p.plan_month, active_count: p.active_count }))];
  }
  if (path === '/plans/all' && method === 'GET') {
    return [200, { success: true, data: s.plans.slice().sort((a, c) => a.plan_amount - c.plan_amount || a.plan_month - c.plan_month).map(pub) }];
  }
  if (path === '/plans/' && method === 'POST') {
    s.log.push({ method, path, body: b });
    const name = String(b.plan_name || '').trim();
    if (!name) return [400, { detail: 'plan_name is required' }];
    const month = Number(b.plan_month), free = b.free_months == null ? 0 : Number(b.free_months);
    const bad = terms(month, free, b.offer_text);
    if (bad) return bad;
    if (dup(name, month, -1)) return dupMsg(name, month);
    const p = { plan_id: s.nextId++, plan_name: name, plan_amount: Number(b.plan_amount), plan_month: month, plan_free_months: free,
      plan_offer_text: String(b.offer_text || '').trim() || null, active_count: 0 };
    s.plans.push(p);
    return [200, { success: true, data: pub(p) }];
  }
  const m = /^\/plans\/(\d+)$/.exec(path);
  if (m) {
    const p = s.plans.find((x) => x.plan_id === Number(m[1]));
    if (method === 'DELETE') {
      if (!p) return [404, { detail: 'Plan not found' }];
      s.plans = s.plans.filter((x) => x !== p);
      return [200, { success: true }];
    }
    if (method === 'PUT') {
      s.log.push({ method, path, body: b });
      if (!p) return [404, { detail: 'Plan not found' }];
      const month = Number(b.plan_month);
      const free = b.free_months == null ? p.plan_free_months : Number(b.free_months);
      const bad = terms(month, free, b.offer_text);
      if (bad) return bad;
      const name = String(b.plan_name || '').trim();
      if (dup(name, month, p.plan_id)) return dupMsg(name, month);
      Object.assign(p, { plan_name: name, plan_amount: Number(b.plan_amount), plan_month: month, plan_free_months: free });
      if (b.offer_text != null) p.plan_offer_text = String(b.offer_text).trim() || null;      // "" clears, null / omitted keeps
      return [200, { success: true, data: pub(p) }];
    }
  }
  return null;
}

module.exports = { handle };
