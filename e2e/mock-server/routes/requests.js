'use strict';
/** Leave / permission / shift-change / device-change requests, approvals, calendar and the single-device session check. */
const { fail, bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const ok = (extra) => ({ success: true, ...extra });

function newRequest(c, type, u, extra) {
  c.s.seq.req += 1;
  const row = {
    request_id: `req-${c.s.seq.req}`, request_type: type, user_id: u.user_id, org_id: u.org_id, staff_name: u.name, emp_id: u.emp_id, reason: '', status: 'pending',
    dates: [], date_statuses: {}, created_at: T.isoNow(), action_by: null, action_by_name: null, action_at: null, profile_photo: u.photo_url ? D.abs(c.origin, u.photo_url) : null, ...extra,
  };
  c.s.requests.push(row);
  const admin = c.s.users.find((x) => x.org_id === u.org_id && x.role_id === 1);
  if (admin) c.push(admin.user_id, { type: 'request_submitted', data: { request_id: row.request_id, request_type: type } });
  return row;
}

const pendingDates = (dates) => Object.fromEntries(dates.map((d) => [d, { status: 'pending', action_by: null, action_at: null }]));

function aggregate(req) {
  const vals = Object.values(req.date_statuses);
  if (!vals.length) return req.status;
  if (vals.some((v) => v.status === 'pending')) return 'pending';
  if (vals.some((v) => v.status === 'approved')) return 'approved';
  return 'rejected';
}

const shiftTiming = (s, id) => {
  const x = D.shift(s, id);
  return x ? `${T.fmtCompact12(x.start_time)} - ${T.fmtCompact12(x.end_time)}` : null;
};

function wire(c, req, { withDates }) {
  const { date_statuses: ds, ...rest } = req;
  const actor = req.action_by ? D.user(c.s, req.action_by) : null;
  const row = { ...rest, action_by_name: actor ? actor.name : req.action_by_name };
  if (withDates) row.date_statuses = ds;
  return row;
}

function register(r) {
  r.post('/requests/leave/submit', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const dates = Array.isArray(c.b.leave_dates) ? c.b.leave_dates : [];
    if (!dates.length) fail(400, 'Select at least one leave date');
    if (!String(c.b.reason || '').trim()) fail(400, 'Reason is required');
    const clash = c.s.requests.find((q) => q.user_id === u.user_id && q.request_type === 'leave' && Object.entries(q.date_statuses).some(([d, v]) => dates.includes(d) && v.status !== 'rejected'));
    if (clash) return bizFail('A leave request already exists for one of the selected dates');
    const row = newRequest(c, 'leave', u, { dates: [...dates].sort(), date_statuses: pendingDates(dates), reason: c.b.reason });
    return ok({ message: 'Leave request submitted successfully', request_id: row.request_id });
  });

  r.post('/requests/permission/submit', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const st = T.toHHmm(c.b.start_time);
    const en = T.toHHmm(c.b.end_time);
    if (!c.b.permission_date || !st || !en) fail(400, 'permission_date, start_time and end_time are required');
    if (T.toMinutes(en) <= T.toMinutes(st)) return bizFail('End time must be after start time');
    const row = newRequest(c, 'permission', u, { dates: [c.b.permission_date], date_statuses: pendingDates([c.b.permission_date]), permission_date: c.b.permission_date, permission_start_time: st, permission_end_time: en, reason: c.b.reason || '' });
    return ok({ message: 'Permission request submitted successfully', request_id: row.request_id });
  });

  r.post('/requests/shift-change/submit', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const requested = Number(c.b.requested_shift_id);
    if (!D.shift(c.s, requested)) fail(400, 'Requested shift not found');
    if (requested === Number(u.shift_id)) return bizFail('You are already on this shift');
    const row = newRequest(c, 'shift_change', u, {
      dates: [c.b.shift_change_date], shift_change_date: c.b.shift_change_date, requested_shift_id: requested, current_shift_id: u.shift_id,
      requested_shift_timing: shiftTiming(c.s, requested), current_shift_timing: shiftTiming(c.s, u.shift_id), reason: c.b.reason || '',
    });
    return ok({ message: 'Shift change request submitted successfully', request_id: row.request_id });
  });

  r.post('/requests/device-change/submit', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const pending = c.s.requests.find((q) => q.request_type === 'device_change' && q.user_id === u.user_id && q.status === 'pending');
    if (pending) return ok({ message: 'A device change request is already pending', request_id: pending.request_id });
    const row = newRequest(c, 'device_change', u, { reason: c.b.reason || '' });
    return ok({ message: 'Device change request submitted successfully', request_id: row.request_id });
  });

  r.get('/requests/employee/:uid/:org', (c) =>
    ok({ data: c.s.requests.filter((q) => q.user_id === c.p.uid).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((q) => wire(c, q, { withDates: false })) }),
  );

  r.get('/requests/admin/:org', (c) => {
    const orgId = D.resolveOrg(c.s, c.p.org);
    let rows = c.s.requests.filter((q) => q.org_id === orgId);
    if (c.q.status) rows = rows.filter((q) => q.request_type !== 'leave' && q.status === c.q.status);
    return ok({ data: rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((q) => wire(c, q, { withDates: true })) });
  });

  r.post('/requests/update-status', (c) => {
    const { request_id: id, status, action_by: actionBy, leave_date: leaveDate } = c.b;
    if (!['approved', 'rejected', 'pending'].includes(status)) fail(400, 'Invalid status');
    const q = c.s.requests.find((x) => x.request_id === id);
    if (!q) return bizFail('Request not found');
    const stamp = { action_by: actionBy || null, action_at: T.isoNow() };
    if (leaveDate) {
      if (!q.date_statuses[leaveDate]) return bizFail('Date not part of this request');
      q.date_statuses[leaveDate] = { status, ...stamp };
      q.status = aggregate(q);
    } else {
      for (const d of Object.keys(q.date_statuses)) q.date_statuses[d] = { status, ...stamp };
      q.status = status;
    }
    q.action_by = actionBy || null;
    q.action_at = stamp.action_at;
    if (q.request_type === 'device_change' && status === 'approved') {
      const u = D.user(c.s, q.user_id);
      if (u) u.device_token = null; // forces an OTP login on the new device
    }
    c.push(q.user_id, { type: 'request_update', data: { request_id: q.request_id, status } });
    return ok({ message: `Request ${status} successfully` });
  });

  r.get('/requests/calendar/:uid/:org', (c) => {
    const { start_date: from, end_date: to } = c.q;
    const rows = [];
    for (const q of c.s.requests.filter((x) => x.user_id === c.p.uid && (x.request_type === 'leave' || x.request_type === 'permission'))) {
      for (const [date, v] of Object.entries(q.date_statuses)) {
        if ((!from || date >= from) && (!to || date <= to)) rows.push({ date, status: v.status, type: q.request_type });
      }
    }
    return ok({ data: rows });
  });

  r.get('/requests/check-session/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) return { valid: false, force_logout: true, reason: 'user_not_found' };
    if (c.s.flags.forceLogout.includes(u.user_id)) return { valid: false, force_logout: true, reason: 'forced_by_test' };
    if (u.status !== 1) return { valid: false, force_logout: true, reason: 'inactive' };
    if (u.role_id !== 1 && u.device_token !== c.q.device_token) return { valid: false, force_logout: true, reason: 'device_changed' };
    return { valid: true, force_logout: false };
  });
}

module.exports = { register };
