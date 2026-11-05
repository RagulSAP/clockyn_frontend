'use strict';
/** Read/derive helpers over the state (no HTTP). Route modules compose these. */
const T = require('./lib/time');
const { fail, wrapped403 } = require('./lib/http');
const { PLAN_CATALOGUE } = require('./state');

const FEATURES = ['chat', 'salary_structure', 'camera_punch', 'staff_location', 'crm'];
const BLOCKED_BY_PLAN = { 1: ['staff_location', 'crm'], 2: ['crm'], 3: [] };

const user = (s, id) => s.users.find((u) => u.user_id === id);
const org = (s, id) => s.orgs.find((o) => o.org_id === id);
const branch = (s, id) => s.branches.find((b) => String(b.branch_id) === String(id));
const dept = (s, id) => s.departments.find((d) => String(d.dept_id) === String(id));
const shift = (s, id) => s.shifts.find((x) => String(x.shift_id) === String(id));

/** Org id for an org id, a user id (staff/manager/admin) or — leniently — anything else (the primary org). */
function resolveOrg(s, id) {
  if (id && org(s, id)) return id;
  const u = id ? user(s, id) : null;
  if (u) return u.org_id;
  return s.orgs[0].org_id;
}

const roleName = (u) => (u.role_id === 1 ? 'Admin' : u.role_id === 2 ? 'Manager' : 'Employee');

// ── plan ─────────────────────────────────────────────────────────────────────────────────────────

/** `{plan_id,is_free_trial,is_expired,status,...}` for the current mock plan flag. */
function planStatus(s) {
  const today = T.today();
  const flag = s.flags.plan;
  const sub = s.subscription;
  switch (flag) {
    case 'trial':
      return { plan_id: null, is_free_trial: true, is_expired: false, status: 'FREE_TRIAL', free_trial_end: T.addDays(today, 14), end_date: T.addDays(today, 14) };
    case 'expired':
      return { plan_id: sub.plan_id, is_free_trial: false, is_expired: true, status: 'ACTIVE', free_trial_end: null, end_date: T.addDays(today, -3) };
    case 'none':
      return { plan_id: null, is_free_trial: false, is_expired: true, status: 'INACTIVE', free_trial_end: T.addDays(today, -20), end_date: T.addDays(today, -20) };
    case 'core':
      return { plan_id: 1, is_free_trial: false, is_expired: false, status: 'ACTIVE', free_trial_end: null, end_date: sub.end_date };
    case 'prime':
      return { plan_id: 2, is_free_trial: false, is_expired: false, status: 'ACTIVE', free_trial_end: null, end_date: sub.end_date };
    default:
      return { plan_id: sub.plan_id || 3, is_free_trial: false, is_expired: false, status: 'ACTIVE', free_trial_end: null, end_date: sub.end_date };
  }
}

function featureBlocked(s, feature) {
  const p = planStatus(s);
  if (p.is_free_trial) return false;
  if (p.is_expired) return true;
  if (p.plan_id === null) return true;
  return (BLOCKED_BY_PLAN[p.plan_id] || []).includes(feature);
}

const PLAN_MESSAGE = 'Your plan has expired. Please renew your plan to continue using this feature.';

/** Server-side gate: HTTP 403 `{detail}` (or the wrapped HTTP 500 used by the chat list endpoints). */
function requireFeature(s, feature, opts = {}) {
  if (!featureBlocked(s, feature)) return;
  if (opts.wrap) wrapped403(PLAN_MESSAGE);
  fail(403, PLAN_MESSAGE);
}

/** Plan catalogue of the tenant: `flags.catalogue` (set through `/__test/state`) overrides the default tiers. */
const catalogue = (s) => (Array.isArray(s.flags.catalogue) && s.flags.catalogue.length ? s.flags.catalogue : PLAN_CATALOGUE);

function subscriptionData(s) {
  const p = planStatus(s);
  const plan = catalogue(s).find((x) => x.plan_id === p.plan_id);
  return {
    plan_id: p.plan_id,
    // The real backend names the placeholder of an active trial "Free Trial" (no paid row).
    plan_name: plan ? plan.plan_name : p.is_free_trial ? 'Free Trial' : null,
    plan_amount: plan ? plan.plan_amount : null,
    plan_month: plan ? plan.plan_month : null,
    // No paid row (trial / none): the real backend has no start or billing date, only the (old or current) trial end.
    start_date: p.plan_id === null ? null : s.subscription.start_date,
    end_date: p.end_date,
    staff_limit: s.subscription.staff_limit,
    status: p.status,
    is_expired: p.is_expired,
    is_free_trial: p.is_free_trial,
    free_trial_end: p.free_trial_end,
    billing_date: p.plan_id === null ? null : p.end_date,
  };
}

// ── manager scope ────────────────────────────────────────────────────────────────────────────────

/** If `id` is a manager's user id, a predicate restricting users to the manager's branches/departments. */
function scopeFilter(s, id) {
  const m = id ? user(s, id) : null;
  if (!m || m.role_id !== 2 || !m.assignments.length) return () => true;
  return (u) => m.assignments.some((a) => String(a.branch_id) === String(u.branch_id) && (!a.dept_id || a.dept_id === u.dept_id));
}

// ── attendance ───────────────────────────────────────────────────────────────────────────────────

const dayRec = (s, uid, date) => (s.att[uid] && s.att[uid][date]) || null;

function sessionHours(sess, date) {
  const end = sess.out || (date === T.today() ? T.ist().hhmm : sess.in);
  return T.hoursBetween(sess.in, end);
}

function totalHours(rec, date) {
  if (!rec) return 0;
  return Math.round(rec.sessions.reduce((a, x) => a + sessionHours(x, date), 0) * 100) / 100;
}

/** 'Working' | 'Late Punched-In' | 'Punched Out' | 'Absent' | 'Inactive' (wire labels of the live status). */
function liveLabel(s, u, date) {
  if (u.status !== 1) return 'Inactive';
  const rec = dayRec(s, u.user_id, date);
  if (!rec || !rec.sessions.length) return 'Absent';
  const last = rec.sessions[rec.sessions.length - 1];
  if (!last.out) return rec.late ? 'Late Punched-In' : 'Working';
  return 'Punched Out';
}

/** Active role 2/3 users of an org (optionally branch filtered and manager scoped). */
function activeStaff(s, orgId, { branchId, deptId, scope } = {}) {
  const filter = scope || (() => true);
  return s.users.filter((u) => u.org_id === orgId && u.role_id !== 1 && u.status === 1 && filter(u) && (!branchId || String(branchId) === '0' || String(u.branch_id) === String(branchId)) && (!deptId || String(deptId) === '0' || String(deptId).toUpperCase() === 'ALL' || u.dept_id === deptId));
}

function dashboardCounts(s, users, date) {
  const labels = users.map((u) => liveLabel(s, u, date));
  const working = labels.filter((l) => l === 'Working' || l === 'Late Punched-In').length;
  return {
    total_staff: users.length,
    punched_in: working,
    working,
    punched_out: labels.filter((l) => l === 'Punched Out').length,
    absent: labels.filter((l) => l === 'Absent').length,
    late_punched_in: users.filter((u) => { const r = dayRec(s, u.user_id, date); return r && r.sessions.length && r.late; }).length,
  };
}

const abs = (origin, p) => (!p ? null : /^https?:/i.test(p) ? p : `${origin}${p}`);

/** A row of every staff list (`/home/*-staff`, `/home/all-staff`). */
function staffRow(s, u, date, origin) {
  return {
    user_id: u.user_id,
    name: u.name,
    emp_id: u.emp_id,
    mobile_number: u.mobile_number,
    email: u.email,
    dept_name: (dept(s, u.dept_id) || {}).dept_name || '',
    branch_name: (branch(s, u.branch_id) || {}).branch_name || '',
    status: liveLabel(s, u, date),
    is_active: u.status === 1,
    role_id: u.role_id,
    role_name: roleName(u),
    profile_photo_url: abs(origin, u.photo_url),
  };
}

/** Full personal record (staff-profile, addstaff/{id}, employee/personal-details). */
function profileRow(s, u, origin) {
  return {
    user_id: u.user_id,
    name: u.name,
    emp_id: u.emp_id,
    mobile_number: u.mobile_number,
    email: u.email,
    dept_name: (dept(s, u.dept_id) || {}).dept_name || '',
    branch_name: (branch(s, u.branch_id) || {}).branch_name || '',
    role_name: roleName(u),
    dob: u.dob,
    doj: u.doj,
    gender: u.gender,
    blood_group: u.blood_group,
    address: u.address,
    emergency_contact_no: u.emergency_contact_no,
    father_name: u.father_name,
    marital_status: u.marital_status,
    acc_no: u.acc_no,
    ifsc_code: u.ifsc_code,
    bank_name: u.bank_name,
    bank_branch: u.bank_branch,
    aadhaar_no: u.aadhaar_no,
    pan_no: u.pan_no,
    uan_no: u.uan_no,
    pf_no: u.pf_no,
    esi_no: u.esi_no,
    shift_id: u.shift_id,
    profile_photo_url: abs(origin, u.photo_url),
  };
}

const locStr = (loc) => (loc ? `${Number(loc.lat).toFixed(6)},${Number(loc.lng).toFixed(6)}` : null);

// ── announcements ────────────────────────────────────────────────────────────────────────────────

function recipientsOf(s, a) {
  const staff = activeStaff(s, a.org_id);
  switch (a.target) {
    case 'selected':
      return staff.filter((u) => (a.selected_user_ids || []).includes(u.user_id)).map((u) => u.user_id);
    case 'branch':
      return staff.filter((u) => String(u.branch_id) === String(a.branch_id)).map((u) => u.user_id);
    case 'dept':
      return staff.filter((u) => u.dept_id === a.dept_id).map((u) => u.user_id);
    default:
      return staff.map((u) => u.user_id);
  }
}

const uniq = (arr) => [...new Set(arr)];

module.exports = {
  FEATURES, user, org, branch, dept, shift, resolveOrg, roleName, planStatus, featureBlocked, requireFeature, subscriptionData, catalogue, scopeFilter, dayRec, sessionHours, totalHours,
  liveLabel, activeStaff, dashboardCounts, abs, staffRow, profileRow, locStr, recipientsOf, uniq, PLAN_MESSAGE,
};
