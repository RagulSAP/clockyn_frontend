'use strict';
/** Admin dashboard, staff lists by live status, staff detail/profile, daily & monthly attendance (`/home/*`). */
const { fail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');
const { LATE_GRACE_MIN } = require('../state');

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function branchRow(b) {
  return { branch_id: b.branch_id, branch_name: b.branch_name, branch_address: b.branch_address, org_id: b.org_id, branch_latitude: b.branch_latitude, branch_longitude: b.branch_longitude, punch_radius: b.punch_radius };
}

function dateParam(c) {
  return c.q.target_date || T.today();
}

function scopedUsers(c, idParam) {
  const id = c.q[idParam];
  const orgId = D.resolveOrg(c.s, id);
  const scope = D.scopeFilter(c.s, id);
  return { orgId, users: D.activeStaff(c.s, orgId, { branchId: c.q.branch_id, deptId: c.q.dept_id, scope }), scope };
}

function register(r) {
  r.get('/home/dashboard-status', (c) => D.dashboardCounts(c.s, scopedUsers(c, 'user_id').users, dateParam(c)));

  r.get('/home/department-stats', (c) => {
    const { orgId, users } = scopedUsers(c, 'user_id');
    const date = dateParam(c);
    return c.s.departments
      .filter((d) => d.org_id === orgId)
      .map((d) => ({ dept_id: d.dept_id, dept_name: d.dept_name, ...D.dashboardCounts(c.s, users.filter((u) => u.dept_id === d.dept_id), date) }));
  });

  r.get('/home/current-date', () => {
    const p = T.ist();
    return { current_date: p.date, formatted_date: `${p.day} ${MONTHS_SHORT[p.month - 1]} ${p.year}`, day_name: DAYS[p.weekday] };
  });

  const listBy = (pred) => (c) => {
    const { users } = scopedUsers(c, 'user_id');
    const date = dateParam(c);
    return users.filter((u) => pred(c.s, u, date)).map((u) => D.staffRow(c.s, u, date, c.origin));
  };
  const isWorking = (s, u, d) => ['Working', 'Late Punched-In'].includes(D.liveLabel(s, u, d));
  r.get('/home/absent-staff', listBy((s, u, d) => D.liveLabel(s, u, d) === 'Absent'));
  r.get('/home/late-punched-in-staff', listBy((s, u, d) => { const rec = D.dayRec(s, u.user_id, d); return !!(rec && rec.sessions.length && rec.late); }));
  r.get('/home/punched-in-staff', listBy(isWorking));
  r.get('/home/working-staff', listBy(isWorking));
  r.get('/home/punched-out-staff', listBy((s, u, d) => D.liveLabel(s, u, d) === 'Punched Out'));

  r.get('/home/all-staff', (c) => {
    const orgId = D.resolveOrg(c.s, c.q.user_id);
    const scope = D.scopeFilter(c.s, c.q.user_id);
    const date = T.today();
    return c.s.users.filter((u) => u.org_id === orgId && u.role_id !== 1 && u.status !== 2 && scope(u)).map((u) => D.staffRow(c.s, u, date, c.origin));
  });

  r.get('/home/branches', (c) => {
    const id = c.q.org_id || c.q.user_id;
    const orgId = D.resolveOrg(c.s, id);
    const mgr = D.user(c.s, id);
    let rows = c.s.branches.filter((b) => b.org_id === orgId);
    if (mgr && mgr.role_id === 2 && mgr.assignments.length) rows = rows.filter((b) => mgr.assignments.some((a) => String(a.branch_id) === String(b.branch_id)));
    return rows.map(branchRow);
  });

  r.get('/home/departments', (c) => {
    const orgId = D.resolveOrg(c.s, c.q.org_id || c.q.user_id);
    return c.s.departments.filter((d) => d.org_id === orgId);
  });

  r.get('/home/org-admin/:org', (c) => {
    const orgId = D.resolveOrg(c.s, c.p.org);
    const admin = c.s.users.find((u) => u.org_id === orgId && u.role_id === 1);
    if (!admin) fail(404, 'Admin not found');
    return D.staffRow(c.s, admin, T.today(), c.origin);
  });

  r.get('/home/staff-detail', (c) => {
    const u = D.user(c.s, c.q.staff_id);
    if (!u || u.status !== 1 || u.org_id !== D.resolveOrg(c.s, c.q.org_id)) fail(404, 'Staff not found');
    const b = D.branch(c.s, u.branch_id) || {};
    return { ...D.staffRow(c.s, u, T.today(), c.origin), branch_address: b.branch_address || '', org_id: u.org_id };
  });

  r.get('/home/staff-profile', (c) => {
    const u = D.user(c.s, c.q.staff_id);
    if (!u || u.status === 2) fail(404, 'Staff not found');
    return D.profileRow(c.s, u, c.origin);
  });

  r.get('/home/daily-attendance', (c) => {
    const { users } = scopedUsers(c, 'org_id');
    const date = dateParam(c);
    return users.map((u) => {
      const rec = D.dayRec(c.s, u.user_id, date);
      const sess = rec ? rec.sessions : [];
      const last = sess[sess.length - 1];
      return {
        ...D.staffRow(c.s, u, date, c.origin),
        punch_in: sess.length ? T.fmt12(sess[0].in) : null,
        punch_out: last && last.out ? T.fmt12(last.out) : null,
        total_hours: sess.length ? D.totalHours(rec, date) : null,
        location: rec && rec.in_loc ? D.locStr(rec.in_loc) : null,
      };
    });
  });

  r.get('/home/monthly-attendance', (c) => {
    const u = D.user(c.s, c.q.staff_id);
    if (!u) fail(404, 'Staff not found');
    const month = Number(c.q.month);
    const year = Number(c.q.year);
    const prefix = T.monthPrefix(year, month);
    const days = Object.entries(c.s.att[u.user_id] || {})
      .filter(([d]) => d.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));
    const rows = days.map(([date, rec]) => {
      const sess = rec.sessions;
      const last = sess[sess.length - 1];
      return {
        date,
        status: rec.status,
        punch_in: sess.length ? T.fmt12(sess[0].in) : null,
        punch_out: last && last.out ? T.fmt12(last.out) : null,
        total_hours: sess.length ? D.totalHours(rec, date) : null,
        location: rec.in_loc ? D.locStr(rec.in_loc) : null,
        punch_in_photo: sess.length ? D.abs(c.origin, sess[0].in_photo) : null,
        punch_out_photo: last && last.out ? D.abs(c.origin, last.out_photo) : null,
      };
    });
    return {
      success: true,
      month,
      year,
      total_days: T.daysInMonth(year, month),
      present_days: rows.filter((x) => x.status === 'present' || x.status === 'late' || x.status === 'half_day').length,
      absent_days: rows.filter((x) => x.status === 'absent').length,
      late_days: rows.filter((x) => x.status === 'late').length,
      attendance_data: rows,
    };
  });

  r.put('/home/update-attendance-punch', (c) => {
    const { staff_id: staffId, date } = c.b;
    const u = D.user(c.s, staffId);
    if (!u) fail(404, 'Staff not found');
    if (!date) fail(422, 'date is required');
    const pin = T.toHHmm(c.b.punch_in);
    const pout = T.toHHmm(c.b.punch_out);
    if (!pin && !pout) fail(400, 'Provide punch_in or punch_out');
    c.s.att[staffId] = c.s.att[staffId] || {};
    const rec = c.s.att[staffId][date] || { sessions: [], status: 'present', late: false };
    if (!rec.sessions.length) rec.sessions.push({ in: pin || '09:00', out: null });
    if (pin) rec.sessions[0].in = pin;
    if (pout) rec.sessions[0].out = pout;
    const sh = D.shift(c.s, u.shift_id) || c.s.shifts[0];
    rec.late = T.toMinutes(rec.sessions[0].in) > T.toMinutes(sh.start_time) + LATE_GRACE_MIN;
    rec.status = rec.late ? 'late' : 'present';
    c.s.att[staffId][date] = rec;
    const first = rec.sessions[0];
    return { success: true, message: 'Attendance updated successfully', work_hours: first.out ? T.hoursBetween(first.in, first.out) : 0, punch_in: T.fmt12(first.in), punch_out: first.out ? T.fmt12(first.out) : null };
  });

  r.get('/home/staff-punch-locations', (c) => {
    const orgId = D.resolveOrg(c.s, c.q.org_id);
    const date = dateParam(c);
    return D.activeStaff(c.s, orgId)
      .filter((u) => { const rec = D.dayRec(c.s, u.user_id, date); return rec && rec.sessions.length; })
      .map((u) => {
        const rec = D.dayRec(c.s, u.user_id, date);
        const last = rec.sessions[rec.sessions.length - 1];
        const loc = rec.in_loc || { lat: 0, lng: 0 };
        return {
          user_id: u.user_id, name: u.name, emp_id: u.emp_id, branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '', dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '',
          punch_in: T.fmt12(rec.sessions[0].in), punch_out: last.out ? T.fmt12(last.out) : null,
          punch_in_lat: loc.lat, punch_in_lng: loc.lng, punch_out_lat: last.out ? loc.lat : null, punch_out_lng: last.out ? loc.lng : null,
        };
      });
  });
}

module.exports = { register, branchRow };
