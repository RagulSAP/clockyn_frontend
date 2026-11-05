'use strict';
/** Employee punch state, face recognition punching/enrolment, field-staff location and self-service profile. */
const { fail, bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');
const { LATE_GRACE_MIN } = require('../state');

const ok = (extra) => ({ success: true, ...extra });

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function sessionRow(c, sess, date) {
  return {
    punch_in: T.fmt12(sess.in) ? `${T.fmt12(sess.in).slice(0, 5)}:00 ${T.fmt12(sess.in).slice(6)}` : null,
    punch_out: sess.out ? `${T.fmt12(sess.out).slice(0, 5)}:00 ${T.fmt12(sess.out).slice(6)}` : null,
    punch_in_photo: D.abs(c.origin, sess.in_photo),
    punch_out_photo: D.abs(c.origin, sess.out_photo),
    work_hours: D.sessionHours(sess, date),
  };
}

function geofence(c, u, lat, lng) {
  const b = D.branch(c.s, u.branch_id);
  if (!b || lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  const dist = haversineM(lat, lng, Number(b.branch_latitude), Number(b.branch_longitude));
  const radius = Number(b.punch_radius) || 100;
  if (dist > radius) return `You are ${Math.round(dist)}m away from ${b.branch_name}. Please move within ${radius}m of the branch to punch.`;
  return null;
}

function punchNotify(c, u, type) {
  const admin = c.s.users.find((x) => x.org_id === u.org_id && x.role_id === 1);
  if (!admin) return;
  c.push(admin.user_id, { type: 'badge_update', notification: { id: `punch-${Date.now()}`, title: type === 'punch_in' ? 'Punched In' : 'Punched Out', body: `${u.name} ${type === 'punch_in' ? 'punched in' : 'punched out'} at ${T.fmt12(T.ist().hhmm)}`, type } });
}

function register(r) {
  r.get('/attendance/today/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'User not found');
    const date = T.today();
    const rec = D.dayRec(c.s, u.user_id, date);
    const sess = rec ? rec.sessions : [];
    const last = sess[sess.length - 1];
    return ok({
      punch_in: sess.length ? T.fmt12(sess[0].in) : null,
      punch_out: last && last.out ? T.fmt12(last.out) : null,
      is_punched_in: !!(last && !last.out),
      sessions: sess.map((x) => sessionRow(c, x, date)),
      punch_count: sess.length,
      total_work_hours: D.totalHours(rec, date),
    });
  });

  r.get('/attendance/sessions/:uid', (c) => {
    const date = c.q.date || T.today();
    const rec = D.dayRec(c.s, c.p.uid, date);
    return ok({ sessions: rec ? rec.sessions.map((x) => sessionRow(c, x, date)) : [] });
  });

  r.get('/face/check/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'User not found');
    return { registered: !!u.face_registered };
  });

  r.get('/face/warmup/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'User not found');
    return ok({ registered: !!u.face_registered, ms: 1 });
  });

  r.post('/face/check-location', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const msg = geofence(c, u, Number(c.b.latitude), Number(c.b.longitude));
    return msg ? bizFail(msg) : ok({ message: 'Location verified' });
  });

  r.post('/face/punch', (c) => {
    D.requireFeature(c.s, 'camera_punch');
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    if (!c.files.some((f) => f.field === 'face')) fail(422, 'face image is required');
    const action = c.b.action;
    if (action !== 'punch_in' && action !== 'punch_out') fail(400, "action must be 'punch_in' or 'punch_out'");
    const force = String(c.b.force_accept) === 'true';
    const date = T.today();
    const nowT = T.ist().hhmm;

    const holiday = c.s.holidays.find((h) => h.date === date && h.block_attendance !== false && (!h.branch_name || h.branch_name === (D.branch(c.s, u.branch_id) || {}).branch_name));
    if (holiday) return bizFail(`Today is a holiday (${holiday.name}). Attendance is not required.`, { is_holiday: true });
    if (!u.face_registered) return bizFail('Face not registered. Please register your face first.');
    if (!force) {
      const msg = geofence(c, u, Number(c.b.latitude), Number(c.b.longitude));
      if (msg) return bizFail(msg);
    }
    let mismatch = false;
    if (c.s.flags.faceMismatch) {
      if (!force) return bizFail('Face not recognized. Please try again.', { face_mismatch: true });
      mismatch = true;
    }

    c.s.att[u.user_id] = c.s.att[u.user_id] || {};
    const rec = c.s.att[u.user_id][date] || { sessions: [], status: 'present', late: false };
    const last = rec.sessions[rec.sessions.length - 1];
    const photo = `/files/punch/${u.user_id}-${rec.sessions.length + 1}-${action}.png`;
    const lat = Number(c.b.latitude);
    const lng = Number(c.b.longitude);

    if (action === 'punch_in') {
      if (last && !last.out) return bizFail('You are already punched in.');
      if (rec.sessions.length >= 2) return bizFail('Maximum 2 punch sessions per day reached.');
      rec.sessions.push({ in: nowT, out: null, in_photo: photo, out_photo: null });
      if (rec.sessions.length === 1) {
        const sh = D.shift(c.s, u.shift_id) || c.s.shifts[0];
        rec.late = T.toMinutes(nowT) > T.toMinutes(sh.start_time) + LATE_GRACE_MIN;
        rec.status = rec.late ? 'late' : 'present';
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) rec.in_loc = { lat, lng };
        else rec.in_loc = rec.in_loc || { lat: Number((D.branch(c.s, u.branch_id) || {}).branch_latitude) || 0, lng: Number((D.branch(c.s, u.branch_id) || {}).branch_longitude) || 0 };
      }
      c.s.att[u.user_id][date] = rec;
      punchNotify(c, u, 'punch_in');
      return { success: true, message: 'Punched in successfully', time: T.fmt12(nowT), attendance_id: `att-${u.user_id}-${date}`, face_mismatch: mismatch };
    }

    if (!last || last.out) return bizFail('You are not punched in.');
    last.out = nowT;
    last.out_photo = photo;
    c.s.att[u.user_id][date] = rec;
    punchNotify(c, u, 'punch_out');
    return { success: true, message: 'Punched out successfully', time: T.fmt12(nowT), attendance_id: `att-${u.user_id}-${date}`, work_hours: D.sessionHours(last, date), total_work_hours: D.totalHours(rec, date), face_mismatch: mismatch };
  });

  r.post('/face/register', (c) => {
    D.requireFeature(c.s, 'camera_punch');
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const faces = c.files.filter((f) => f.field === 'faces');
    if (faces.length < 4) return bizFail('At least 4 face photos are required.');
    u.face_registered = true;
    return ok({ message: 'Face registered successfully' });
  });

  // ── field-staff location ───────────────────────────────────────────────────────────────────────
  r.post('/staff-location/log', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    if (c.s.flags.locationLogStatus) fail(Number(c.s.flags.locationLogStatus), 'Location logging disabled (test flag)');
    if (!u.is_field_staff) fail(403, 'Location tracking is only available for field staff');
    const rec = D.dayRec(c.s, u.user_id, T.today());
    const last = rec && rec.sessions[rec.sessions.length - 1];
    if (!last) fail(403, 'You must punch in before location tracking can start');
    if (last.out) fail(403, 'You have punched out; location tracking has stopped');
    (c.s.locations[u.user_id] = c.s.locations[u.user_id] || []).push({ latitude: Number(c.b.latitude), longitude: Number(c.b.longitude), timestamp: c.b.timestamp || T.isoNow() });
    return ok({ message: 'Location logged' });
  });

  const locRows = (c) => {
    const orgId = D.resolveOrg(c.s, c.q.org_id);
    const date = c.q.target_date || T.today();
    return c.s.users
      .filter((u) => u.org_id === orgId && u.is_field_staff === 1 && u.status === 1)
      .map((u) => {
        const rec = D.dayRec(c.s, u.user_id, date);
        const pts = (c.s.locations[u.user_id] || []).filter(() => date === T.today());
        const lastPt = pts[pts.length - 1];
        const sess = rec ? rec.sessions : [];
        const lastSess = sess[sess.length - 1];
        return { u, pts, lastPt, row: { user_id: u.user_id, name: u.name, emp_id: u.emp_id, branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '', dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '', latitude: lastPt ? lastPt.latitude : null, longitude: lastPt ? lastPt.longitude : null, location_updated_at: lastPt ? lastPt.timestamp : null, punch_in: sess.length ? T.fmt12(sess[0].in) : null, punch_out: lastSess && lastSess.out ? T.fmt12(lastSess.out) : null } };
      });
  };

  r.get('/staff-location/locations', (c) => {
    D.requireFeature(c.s, 'staff_location');
    return locRows(c).map((x) => x.row);
  });

  r.get('/staff-location/stats', (c) => {
    D.requireFeature(c.s, 'staff_location');
    const rows = locRows(c);
    const age = (x) => (x.lastPt ? (T.now().getTime() - new Date(x.lastPt.timestamp).getTime()) / 60_000 : null);
    return ok({ date: c.q.target_date || T.today(), data: { recent: rows.filter((x) => age(x) !== null && age(x) <= 30).length, outdated: rows.filter((x) => age(x) !== null && age(x) > 30).length, no_location: rows.filter((x) => !x.lastPt).length, total: rows.length } });
  });

  r.get('/staff-location/history/:uid', (c) => {
    const pts = (c.s.locations[c.p.uid] || []).filter((p) => {
      const d = new Date(new Date(p.timestamp).getTime() + 330 * 60_000).toISOString().slice(0, 10); // IST calendar date of the ping
      return (!c.q.start_date || d >= c.q.start_date) && (!c.q.end_date || d <= c.q.end_date);
    });
    return ok({ data: pts });
  });

  // ── self-service profile ───────────────────────────────────────────────────────────────────────
  r.get('/employee/personal-details/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'User not found');
    return D.profileRow(c.s, u, c.origin);
  });

  r.put('/employee/personal-details/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'User not found');
    const b = c.b;
    if (b.mobile_number && c.s.users.some((x) => x !== u && x.mobile_number === String(b.mobile_number).trim() && x.status !== 2)) return bizFail('Mobile number already exists');
    for (const k of ['name', 'email', 'gender', 'blood_group', 'address', 'emergency_contact_no', 'acc_no', 'ifsc_code', 'bank_name', 'bank_branch', 'father_name', 'marital_status', 'aadhaar_no', 'pan_no', 'uan_no', 'pf_no', 'esi_no']) {
      if (b[k] !== undefined) u[k] = b[k];
    }
    if (b.mobile_number) u.mobile_number = String(b.mobile_number).trim();
    if (b.dob !== undefined) u.dob = b.dob;
    if (b.doj !== undefined) u.doj = b.doj;
    return ok({ message: 'Personal details updated successfully' });
  });

  r.get('/employee/today-birthdays/:org', (c) => {
    // Opt-in (a birthday modal would cover every staff screen): POST /__test/state { birthdays: ['stf-0003'] }
    const ids = c.s.flags.birthdays || [];
    const names = D.activeStaff(c.s, D.resolveOrg(c.s, c.p.org))
      .filter((u) => u.user_id !== c.q.exclude_user_id && ids.includes(u.user_id))
      .map((u) => u.name);
    return { birthdays: names };
  });
}

module.exports = { register, haversineM };
