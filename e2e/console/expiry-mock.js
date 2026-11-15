'use strict';
/* Expiry part of the operator mock, for e2e/console/dashboard-expiry.spec.js (hooked into operator-mock.js with ONE line).
 *
 * It only answers while it is switched on, so every other console spec keeps getting the generic mock answers.
 *   POST /gen-dashboard/__expiry/state   { reset: true }                      switch off and forget everything
 *                                        { on: true, today: 'YYYY-MM-DD', expiring: true|false, hideToday: true|false }
 *     hideToday removes the organisations that end today (to get a zero in the "Today" row)
 *     today     the date in India that the spec computed (the mock has no clock of its own, so it can never go stale)
 *     expiring  false = answer like the OLD backend: /gen-dashboard/stats has no `expiring` block
 *   GET  /gen-dashboard/__expiry/expected  -> {today, within_7_days, within_30_days, ids: {today:[{name,end}], '7d':[...], '30d':[...]}}  (what the rule says)
 * While on it serves:
 *   GET /gen-dashboard/stats          dashboard tiles + the `expiring` block
 *   GET /gen-dashboard/organizations  the organisations list (same rows, same fields as the real route)
 *   GET /gen-dashboard/monthly-revenue, /recent-orgs, /active-orgs    so the dashboard renders completely
 * (/gen-dashboard/plan-breakdown comes from plans-mock.js: several durations of the same plan.)
 *
 * The rule, written here independently of the pages and of the backend: a row counts when its sub_status is ACTIVE, the organisation
 * is not deleted (org_status 2) and end_date is in the window counted from India's today, today included:
 *   today = end_date equals today;  7d = today .. today+7;  30d = today .. today+30. */

const st = { on: false, today: '', expiring: true, hideToday: false };

function addDays(ymd, n) {
  const p = ymd.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
}

/* [name, sub_status, org_status, end offset in days from today (null = no end date)] */
const SEED = [
  ['Today Traders',       'ACTIVE',     1, 0],     // today, 7d, 30d
  ['Second Today',        'ACTIVE',     1, 0],     // today, 7d, 30d
  ['Tomorrow Foods',      'ACTIVE',     1, 1],     // 7d, 30d
  ['Inactive Five',       'ACTIVE',     0, 5],     // 7d, 30d (a deactivated organisation is still a customer)
  ['Week Mart',           'ACTIVE',     1, 7],     // 7d, 30d (last day of the week window)
  ['Eight Day Stores',    'ACTIVE',     1, 8],     // 30d only
  ['Month Works',         'ACTIVE',     1, 30],    // 30d (last day of the month window)
  ['Past Month Ltd',      'ACTIVE',     1, 31],    // none
  ['Yesterday Co',        'EXPIRED',    1, -1],    // none: already expired
  ['Deleted Today Inc',   'ACTIVE',     2, 0],     // none: deleted organisation
  ['Trial Org',           'FREE_TRIAL', 1, null],  // none: a free trial is not a paid plan
  ['No Date Org',         'INACTIVE',   1, null],  // none: no plan end date
];

function rows() {
  return SEED.filter((r) => !(st.hideToday && r[3] === 0)).map((r, i) => {
    const end = r[3] === null ? '—' : addDays(st.today, r[3]);
    return {
      org_id: 'org-' + (i + 1), org_name: r[0], org_address: '1 Road', gst_number: '', state: 'Tamil Nadu', district: 'Chennai', pincode: '600001',
      email: 'owner' + (i + 1) + '@example.com', mobile: '90000000' + String(10 + i), emp_count: 10 + i, attendance_activity_count: 0,
      sub_status: r[1], plan_name: r[1] === 'FREE_TRIAL' ? 'Free Trial' : 'Prime', joined: '01 Oct 2026', start_date: r[3] === null ? '—' : addDays(st.today, r[3] - 30),
      end_date: end, free_trial_end_date: r[1] === 'FREE_TRIAL' ? st.today : null, free_trial_end: r[1] === 'FREE_TRIAL' ? st.today : null,
      payment_status: r[1] === 'ACTIVE' ? 'paid' : 'unpaid', org_status: r[2],
    };
  });
}

function inWindow(r, key) {
  if (r.sub_status !== 'ACTIVE' || r.org_status === 2 || r.end_date === '—') return false;
  const last = key === 'today' ? st.today : addDays(st.today, key === '7d' ? 7 : 30);
  return r.end_date >= st.today && r.end_date <= last;
}

function expected() {
  const all = rows();
  const ids = { today: [], '7d': [], '30d': [] };
  Object.keys(ids).forEach((k) => { ids[k] = all.filter((r) => inWindow(r, k)).map((r) => ({ name: r.org_name, end: r.end_date })); });
  return { today: ids.today.length, within_7_days: ids['7d'].length, within_30_days: ids['30d'].length, ids };
}

/* returns [status, body] or null when the mock is off / the path is not one of its own */
function handle(method, path, searchParams, body) {
  if (path === '/gen-dashboard/__expiry/state' && method === 'POST') {
    if (body && body.reset) { st.on = false; st.today = ''; st.expiring = true; st.hideToday = false; return [200, { ok: true }]; }
    if (body && body.on) { st.on = true; st.today = String(body.today || ''); st.expiring = body.expiring !== false; st.hideToday = body.hideToday === true; }
    return [200, { ok: true }];
  }
  if (path === '/gen-dashboard/__expiry/expected' && method === 'GET') return st.on ? [200, expected()] : [404, { detail: 'not on' }];
  if (!st.on || method !== 'GET') return null;
  if (path === '/gen-dashboard/stats') {
    const e = expected();
    const all = rows();
    const out = { total_orgs: all.length, total_users: 140, active_subscriptions: all.filter((r) => r.sub_status === 'ACTIVE').length, free_trial_orgs: 1,
      revenue_this_month: 45000, pending_payments: 1, failed_payments: 0, today_attendance: 12, open_requests: 3 };
    if (st.expiring) out.expiring = { today: e.today, within_7_days: e.within_7_days, within_30_days: e.within_30_days, as_of: st.today };
    return [200, out];
  }
  if (path === '/gen-dashboard/organizations') return [200, rows()];
  if (path === '/gen-dashboard/monthly-revenue') {
    return [200, ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m, i) => ({ month: m, revenue: 20000 + i * 5000 }))];
  }
  if (path === '/gen-dashboard/recent-orgs') {
    return [200, rows().slice(0, 6).map((r) => ({ org_id: r.org_id, org_name: r.org_name, user_count: r.emp_count, sub_status: r.sub_status, plan_name: r.plan_name, end_date: r.end_date }))];
  }
  if (path === '/gen-dashboard/active-orgs') return [200, { data: [] }];
  return null;
}

module.exports = { handle, addDays };
