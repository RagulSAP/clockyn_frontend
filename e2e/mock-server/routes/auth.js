'use strict';
/** Authentication, identity, photos and logos (`/auth/*`, `/profile-photo/*`, `/attribution/*`). */
const crypto = require('node:crypto');
const { fail, bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');
const authz = require('../lib/authz');
const referral = require('./referral');

const PURPOSES = ['registration', 'login', 'delete_account', 'update_email'];
const ok = (extra) => ({ success: true, ...extra });
const normMobile = (v) => String(v || '').replace(/\D/g, '').slice(-10);

function findByContact(s, contact) {
  const c = String(contact || '').trim();
  if (c.includes('@')) return s.users.find((u) => String(u.email).toLowerCase() === c.toLowerCase() && u.status !== 2);
  return s.users.find((u) => u.mobile_number === normMobile(c) && u.status !== 2);
}

const normContact = (v) => {
  const c = String(v || '').trim();
  return c.includes('@') ? c.toLowerCase() : c;
};

/** Any status; by e-mail (case-insensitive) when the id holds '@', else by mobile number. */
function rawFind(s, id, roleId) {
  const c = String(id || '').trim();
  const byEmail = c.includes('@');
  return s.users.find((u) => (byEmail ? String(u.email).toLowerCase() === c.toLowerCase() : u.mobile_number === normMobile(c)) && (!roleId || u.role_id === roleId));
}

/** USER_AUTH=email: only e-mail addresses are accepted by the OTP routes (the real backend answers 400). */
function emailOnly(s, contact) {
  if (s.flags.userAuth === 'email' && !String(contact).includes('@')) fail(400, 'Sign-in uses your email address. Enter your email address instead of a mobile number.');
}

function loginBody(s, u, portal) {
  const o = D.org(s, u.org_id) || s.orgs[0];
  const base = { success: true, message: 'Login successful!', user_id: u.user_id, email: u.email, org_name: o.org_name, org_id: o.org_id, current_org_id: o.org_id, role_id: u.role_id, org_logo: o.logo_url };
  if (portal === 'admin') {
    const p = D.planStatus(s);
    return { ...base, plan_id: p.plan_id, is_free_trial: p.is_free_trial, free_trial_end: p.free_trial_end, redirect: 'home' };
  }
  const body = { ...base, redirect: 'emp_home' };
  if (u.role_id === 2) body.manager_permissions = Object.entries(u.manager_permissions || {}).filter(([, v]) => v).map(([k]) => k);
  return body;
}

function register(r) {
  r.get('/auth/config', (c) => ok({ user_auth: c.s.flags.userAuth === 'email' ? 'email' : 'otp' }));

  r.post('/auth/login', (c) => {
    if (!String(c.b.login_id || '').trim()) fail(400, 'Mobile number is required');
    const u = rawFind(c.s, c.b.login_id);
    if (!u) fail(401, 'User not found. Please register first.');
    if (u.status === 2) fail(403, 'Your account has been deleted. Please contact support.');
    if (u.status === 0) fail(403, 'Your account is inactive. Please contact your admin.');
    if (u.role_id !== 1) fail(403, 'This is an employee account. Please use employee login portal.');
    return loginBody(c.s, u, 'admin');
  });

  r.post('/auth/employee-login', (c) => {
    if (!String(c.b.login_id || '').trim()) fail(400, 'Mobile number is required');
    const u = rawFind(c.s, c.b.login_id);
    if (!u) fail(401, 'Employee not found or not authorized');
    if (u.status === 2) fail(403, 'Your account has been deleted. Please contact your admin.');
    if (u.status === 0) fail(403, 'Your account is inactive. Please contact your admin.');
    if (u.role_id === 1) fail(403, 'This is an admin account. Please use admin login portal.');
    return loginBody(c.s, u, 'staff');
  });

  r.post('/auth/generate-otp', (c) => {
    const contact = normContact(c.b.contact);
    const purpose = String(c.b.purpose || '').trim().toLowerCase();
    if (!contact || !purpose) fail(400, 'Contact and purpose are required');
    if (!PURPOSES.includes(purpose)) fail(400, "Purpose must be 'registration', 'login', 'delete_account', or 'update_email'");
    emailOnly(c.s, contact);
    const st = c.s.otp[contact];
    if (st && st.attempts >= 5) fail(429, 'Too many incorrect OTP attempts. Please wait for the current OTP to expire before requesting a new one.');
    const roleId = Number(c.b.role_id);
    const u = findByContact(c.s, contact);
    if (purpose === 'login') {
      if ((roleId === 2 || roleId === 3) && !u) fail(404, contact.includes('@') ? 'There is no user with this email address' : 'There is no user with this phone number');
      if (u && u.status === 0) fail(403, 'Your account is inactive. Please contact your admin.');
      if (u && roleId === 1 && u.role_id !== 1) fail(403, 'This is an employee account. Please use employee login portal.');
      if (u && (roleId === 2 || roleId === 3) && u.role_id === 1) fail(403, 'This is an admin account. Please use admin login portal.');
    }
    if (purpose === 'registration' && u) fail(400, contact.includes('@') ? 'Email already registered' : 'Mobile number already registered');
    c.s.otp[contact] = { attempts: 0 };
    return ok({ message: `${purpose[0].toUpperCase()}${purpose.slice(1)} ${contact.includes('@') ? 'email' : 'mobile'} OTP sent successfully!` });
  });

  r.post('/auth/validate-otp', (c) => {
    const contact = normContact(c.b.contact);
    const code = String(c.b.otp_code || '').trim();
    const purpose = String(c.b.purpose || '').trim().toLowerCase();
    if (!contact || !code || !purpose) fail(400, 'Contact, OTP code, and purpose are required');
    if (!/^\d{6}$/.test(code)) fail(400, 'Invalid OTP format');
    emailOnly(c.s, contact);
    const st = (c.s.otp[contact] = c.s.otp[contact] || { attempts: 0 });
    if (st.attempts >= 5) fail(429, 'Too many incorrect OTP attempts. Please request a new OTP.');
    if (code !== c.s.flags.otp) {
      st.attempts += 1;
      fail(400, `Invalid or expired ${purpose} ${contact.includes('@') ? 'email' : 'mobile'} OTP`);
    }
    delete c.s.otp[contact];
    const u = findByContact(c.s, contact);
    const deviceToken = c.b.device_token || crypto.randomUUID();
    if (u && purpose === 'login') {
      u.device_token = deviceToken;
      u.device_expires = T.addDays(T.today(), 90);
      if (c.b.push_token) u.push_token = c.b.push_token;
    }
    return ok({ message: 'OTP validated successfully!', device_token: deviceToken, user_exists: !!u, role_id: u ? u.role_id : null, ...(u ? authz.issueToken(c.s, u.user_id) : {}) });
  });

  r.post('/auth/verify-device-token', (c) => {
    const contact = String(c.b.contact || '').trim();
    const token = String(c.b.device_token || '');
    if (!contact || !token) fail(400, 'Contact and device token are required');
    const roleId = c.b.role_id ? Number(c.b.role_id) : null;
    const u = rawFind(c.s, contact, roleId);
    if (!u) return { success: false, message: 'Device not recognized', skip_otp: false, device_mismatch: false };
    if (u.status === 2) return { success: false, message: 'Your account has been deleted. Please contact support.', skip_otp: false, deleted: true };
    if (u.status === 0) return { success: false, message: 'Your account is inactive. Please contact your admin.', skip_otp: false, inactive: true };
    if (!u.device_token) {
      return { success: false, message: 'Your device change request was approved. Please log in again with OTP on your new device.', skip_otp: false, device_change_approved: true, user_id: u.user_id, org_id: u.org_id };
    }
    if (u.device_token !== token) {
      const pending = c.s.requests.some((q) => q.request_type === 'device_change' && q.user_id === u.user_id && q.status === 'pending');
      if (!pending) {
        c.s.seq.req += 1;
        c.s.requests.push({
          request_id: `req-${c.s.seq.req}`, request_type: 'device_change', user_id: u.user_id, org_id: u.org_id, staff_name: u.name, emp_id: u.emp_id, reason: 'Logged in from a new device',
          status: 'pending', dates: [], date_statuses: {}, created_at: T.isoNow(), action_by: null, action_by_name: null, action_at: null,
        });
      }
      return { success: false, message: 'This account is already logged in on another device. Please log in again with OTP to take over the session.', skip_otp: false, device_mismatch: true, user_id: u.user_id, org_id: u.org_id };
    }
    if (u.device_expires && u.device_expires < T.today()) {
      return { success: false, message: 'Your session has expired. Please log in again with OTP.', skip_otp: false, session_expired: true, user_id: u.user_id, org_id: u.org_id };
    }
    if (c.b.push_token) u.push_token = c.b.push_token;
    return { ...loginBody(c.s, u, u.role_id === 1 ? 'admin' : 'staff'), message: 'Device verified successfully!', skip_otp: true, ...authz.issueToken(c.s, u.user_id) };
  });

  r.post('/auth/register', (c) => {
    const b = c.b;
    for (const f of ['name', 'mobile_number', 'email', 'org_name']) if (!String(b[f] || '').trim()) fail(422, `${f} is required`);
    if (c.s.users.some((u) => u.mobile_number === normMobile(b.mobile_number))) fail(400, 'Mobile number already registered');
    if (c.s.users.some((u) => String(u.email).toLowerCase() === String(b.email).toLowerCase())) fail(400, 'Email already registered');
    referral.assertReferralCode(c.s, b.referral_code);
    const seq = (c.s.seq.org += 1);
    const orgId = `org-${String(seq).padStart(4, '0')}`;
    const userId = `adm-${String(seq).padStart(4, '0')}`;
    c.s.orgs.push({ org_id: orgId, org_name: b.org_name, org_address: b.org_address || '', org_gst: b.org_gst || b.gst_number || '', gst_number: b.gst_number || '', parent_id: userId, state: b.state || null, district: b.district || null, pincode: b.pincode || null, mobile_number: normMobile(b.mobile_number), email: b.email, pan_number: b.pan_number || null, company_website: b.company_website || null, cin_number: b.cin_number || null, tan_number: b.tan_number || null, msme_number: b.msme_number || null, business_category: b.business_category || null, logo_url: null, created_at: T.isoNow() });
    c.s.users.push({ user_id: userId, org_id: orgId, name: b.name, emp_id: b.emp_id || 'A1000', mobile_number: normMobile(b.mobile_number), email: b.email, role_id: 1, status: 1, is_field_staff: 0, device_token: b.device_token || null, manager_permissions: null, assignments: [], branch_id: null, dept_id: null, shift_id: 0 });
    for (const name of Array.isArray(b.branches) ? b.branches : []) {
      c.s.seq.branch += 1;
      c.s.branches.push({ branch_id: String(c.s.seq.branch), branch_name: typeof name === 'string' ? name : name.branch_name || name.name, branch_address: '', org_id: orgId, branch_latitude: 12.9716, branch_longitude: 77.5946, punch_radius: 100 });
    }
    for (const name of Array.isArray(b.departments) ? b.departments : []) {
      c.s.seq.dept += 1;
      c.s.departments.push({ dept_id: `dept-${c.s.seq.dept}`, dept_name: typeof name === 'string' ? name : name.dept_name || name.name, org_id: orgId });
    }
    c.s.registered.push({ user_id: userId, org_id: orgId });
    referral.referralAtSignup(c.s, b.referral_code, { org_id: orgId, org_name: b.org_name });
    return ok({ message: 'Registration successful!', user_id: userId, org_id: orgId, org_name: b.org_name, role_id: 1, org_logo: null, ...authz.issueToken(c.s, userId) });
  });

  // Ends the server-side session: revokes the presented token (when it is one we issued). Always 200 (never fails the sign-out).
  r.post('/auth/logout', (c) => {
    const token = authz.bearerOf(c.req);
    if (token && c.s.tokens[token]) c.s.tokens[token].revoked = true;
    return ok({ message: 'Logged out' });
  });

  r.get('/auth/check-mobile/:mobile', (c) => ({ exists: c.s.users.some((u) => u.mobile_number === normMobile(c.p.mobile)) }));
  r.get('/auth/check-email/:email', (c) => ({ exists: c.s.users.some((u) => String(u.email).toLowerCase() === c.p.email.toLowerCase()) }));

  r.post('/auth/update-push-token', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    u.push_token = c.b.push_token;
    return ok({ message: 'Push token updated' });
  });

  r.get('/auth/user-mobile/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) return bizFail('User not found');
    return ok({ mobile_number: u.mobile_number });
  });

  // The backend repo does not route this one; the app treats the 404 as "no token".
  r.get('/auth/push-token/:uid', () => fail(404, 'Not Found'));

  r.get('/auth/org-logo/:org', (c) => {
    const o = D.org(c.s, c.p.org);
    return ok({ logo_url: o && o.logo_url ? D.abs(c.origin, o.logo_url) : null });
  });

  r.post('/auth/upload-org-logo/:org', (c) => {
    const o = D.org(c.s, c.p.org);
    if (!o) fail(404, 'Organisation not found');
    if (!c.files.some((f) => f.field === 'logo')) fail(422, 'logo file is required');
    o.logo_url = `/files/logo/${o.org_id}.png`;
    return ok({ message: 'Logo uploaded successfully', logo_url: D.abs(c.origin, o.logo_url) });
  });

  const photoUpload = (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'User not found');
    if (!c.files.some((f) => f.field === 'photo')) fail(422, 'photo file is required');
    u.photo_url = `/files/profile/${u.user_id}.png`;
    return ok({ message: 'Photo uploaded successfully', photo_url: D.abs(c.origin, u.photo_url) });
  };
  r.post('/auth/upload-employee-profile/:uid', photoUpload);
  r.post('/profile-photo/:uid', photoUpload);

  const photoGet = (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u || !u.photo_url) return bizFail('No photo');
    return ok({ photo_url: D.abs(c.origin, u.photo_url) });
  };
  r.get('/auth/employee-profile/:uid', photoGet);
  r.get('/profile-photo/:uid', photoGet);

  r.post('/attribution/meta', (c) => ok({ message: 'Recorded', user_id: c.b.user_id }));
}

module.exports = { register };
