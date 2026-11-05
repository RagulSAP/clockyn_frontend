'use strict';
/** Staff CRUD and the staff-form option lists (`/addstaff/*`). */
const { fail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const ok = (extra) => ({ success: true, ...extra });
const mobile10 = (v) => String(v || '').replace(/\D/g, '').slice(-10);

function resolveByName(list, nameKey, idKey, name, orgId) {
  if (!name) return null;
  const row = list.find((x) => x.org_id === orgId && String(x[nameKey]).toLowerCase() === String(name).trim().toLowerCase());
  return row ? row[idKey] : undefined; // undefined = not found
}

function applyFields(c, u, b, orgId) {
  const direct = ['name', 'email', 'gender', 'dob', 'address', 'emergency_contact_no', 'blood_group', 'bank_name', 'bank_branch', 'acc_no', 'ifsc_code', 'father_name', 'marital_status', 'aadhaar_no', 'pan_no', 'uan_no', 'pf_no', 'esi_no', 'doj'];
  for (const k of direct) if (b[k] !== undefined && b[k] !== null && b[k] !== '') u[k] = typeof b[k] === 'string' ? b[k].trim() : b[k];
  if (b.emp_id) u.emp_id = String(b.emp_id).trim();
  if (b.mobile_number) u.mobile_number = mobile10(b.mobile_number);
  if (b.shift_id !== undefined) u.shift_id = Number(b.shift_id) || 0;
  if (b.is_field_staff !== undefined) u.is_field_staff = Number(b.is_field_staff) ? 1 : 0;
  if (b.parent_id !== undefined) u.parent_id = b.parent_id || null;
  if (b.branch_name) {
    const id = resolveByName(c.s.branches, 'branch_name', 'branch_id', b.branch_name, orgId);
    if (id === undefined) fail(400, `Branch '${b.branch_name}' not found`);
    u.branch_id = id;
  }
  if (b.dept_name) {
    const id = resolveByName(c.s.departments, 'dept_name', 'dept_id', b.dept_name, orgId);
    if (id === undefined) fail(400, `Department '${b.dept_name}' not found`);
    u.dept_id = id;
  }
}

function branchOptions(c) {
  const id = c.q.user_id;
  const orgId = D.resolveOrg(c.s, id);
  const mgr = D.user(c.s, id);
  let rows = c.s.branches.filter((b) => b.org_id === orgId);
  if (mgr && mgr.role_id === 2 && mgr.assignments.length) rows = rows.filter((b) => mgr.assignments.some((a) => String(a.branch_id) === String(b.branch_id)));
  return rows.map((b) => ({ branch_id: b.branch_id, branch_name: b.branch_name }));
}

function register(r) {
  r.get('/addstaff/branches', branchOptions);
  r.get('/addstaff/departments', (c) => c.s.departments.filter((d) => d.org_id === D.resolveOrg(c.s, c.q.user_id)).map((d) => ({ dept_id: d.dept_id, dept_name: d.dept_name })));
  r.get('/addstaff/managers', (c) => c.s.users.filter((u) => u.org_id === D.resolveOrg(c.s, c.q.user_id) && u.role_id === 2 && u.status === 1).map((u) => ({ user_id: u.user_id, name: u.name, emp_id: u.emp_id })));

  r.get('/addstaff/next-emp-id', (c) => {
    const orgId = D.resolveOrg(c.s, c.q.user_id);
    const nums = c.s.users.filter((u) => u.org_id === orgId).map((u) => Number(String(u.emp_id).replace(/\D/g, '')) || 0);
    return { next_emp_id: String(Math.max(1000, ...nums) + 1) };
  });

  r.get('/addstaff/validate-emp-id', (c) => {
    const orgId = D.resolveOrg(c.s, c.q.user_id);
    const taken = c.s.users.some((u) => u.org_id === orgId && String(u.emp_id).toLowerCase() === String(c.q.emp_id || '').trim().toLowerCase());
    return { is_available: !taken };
  });

  r.get('/addstaff/count/:org', (c) => ok({ count: D.activeStaff(c.s, D.resolveOrg(c.s, c.p.org)).length }));

  r.get('/addstaff/all-staff/:org', (c) => {
    const orgId = D.resolveOrg(c.s, c.p.org);
    const rows = D.activeStaff(c.s, orgId, { branchId: c.q.branch_id, deptId: c.q.dept_id }).map((u) => ({
      user_id: u.user_id, name: u.name, emp_id: u.emp_id, branch_id: u.branch_id, dept_id: u.dept_id,
      branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '', dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '',
    }));
    return ok({ data: rows });
  });

  r.post('/addstaff', (c) => {
    const b = c.b;
    // the real backend requires name, emp_id and mobile_number only (e-mail is optional)
    for (const f of ['name', 'emp_id', 'mobile_number']) if (!String(b[f] || '').trim()) fail(422, `${f} is required`);
    const orgId = D.resolveOrg(c.s, b.user_id);
    const mobile = mobile10(b.mobile_number);
    if (mobile.length !== 10) fail(400, 'Mobile number must be 10 digits');
    if (c.s.users.some((u) => u.mobile_number === mobile && u.status !== 2)) fail(400, 'Mobile number already exists');
    if (c.s.users.some((u) => u.org_id === orgId && String(u.emp_id).toLowerCase() === String(b.emp_id).trim().toLowerCase() && u.status !== 2)) fail(400, 'Employee ID already exists');
    if (String(b.email || '').trim() && c.s.users.some((u) => String(u.email).toLowerCase() === String(b.email).trim().toLowerCase() && u.status !== 2)) fail(400, 'Email already exists');
    if (D.activeStaff(c.s, orgId).length >= c.s.subscription.staff_limit) fail(400, `Staff limit of ${c.s.subscription.staff_limit} reached. Please upgrade your plan.`);
    c.s.seq.user += 1;
    const u = {
      user_id: `stf-${String(c.s.seq.user).padStart(4, '0')}`, org_id: orgId, role_id: 3, status: 1, is_field_staff: 0, parent_id: null, device_token: null, push_token: null, photo_url: null, face_registered: false,
      branch_id: c.s.branches.find((x) => x.org_id === orgId)?.branch_id || null, dept_id: c.s.departments.find((x) => x.org_id === orgId)?.dept_id || null, shift_id: 0, manager_permissions: null, assignments: [], created_at: T.isoNow(),
      doj: T.today(),
    };
    applyFields(c, u, b, orgId);
    c.s.users.push(u);
    return ok({ message: 'Staff added successfully!', user_id: u.user_id });
  });

  r.get('/addstaff/:id', (c) => {
    const u = D.user(c.s, c.p.id);
    if (!u || u.status === 2) fail(404, 'Staff not found');
    const { profile_photo_url, ...row } = D.profileRow(c.s, u, c.origin);
    return { ...row, profile_photo_url, status: u.status, is_field_staff: u.is_field_staff, parent_id: u.parent_id };
  });

  r.put('/addstaff/:id/status', (c) => {
    const u = D.user(c.s, c.p.id);
    if (!u) fail(404, 'Staff not found');
    const status = Number(c.q.status);
    if (status !== 0 && status !== 1) fail(400, 'status must be 0 or 1');
    if (status === 1 && D.activeStaff(c.s, u.org_id).length >= c.s.subscription.staff_limit && u.status !== 1) fail(400, `Staff limit of ${c.s.subscription.staff_limit} reached. Please upgrade your plan.`);
    u.status = status;
    return ok({ message: status === 1 ? 'Staff activated successfully' : 'Staff deactivated successfully' });
  });

  r.put('/addstaff/:id', (c) => {
    const u = D.user(c.s, c.p.id);
    if (!u || u.status === 2) fail(404, 'Staff not found');
    const b = c.b;
    const mobile = b.mobile_number ? mobile10(b.mobile_number) : u.mobile_number;
    if (c.s.users.some((x) => x !== u && x.mobile_number === mobile && x.status !== 2)) fail(400, 'Mobile number already exists');
    if (b.emp_id && c.s.users.some((x) => x !== u && x.org_id === u.org_id && String(x.emp_id).toLowerCase() === String(b.emp_id).trim().toLowerCase() && x.status !== 2)) fail(400, 'Employee ID already exists');
    applyFields(c, u, b, u.org_id);
    return ok({ message: 'Staff updated successfully!' });
  });

  r.delete('/addstaff/:id/permanent', (c) => {
    if (Number(c.q.requested_by_role_id) !== 1) fail(403, 'Only an admin can permanently delete staff');
    const u = D.user(c.s, c.p.id);
    if (!u || u.role_id === 1) fail(404, 'Staff not found');
    c.s.users = c.s.users.filter((x) => x !== u);
    delete c.s.att[u.user_id];
    return ok({ message: 'Staff member permanently deleted.' });
  });

  r.delete('/addstaff/:id', (c) => {
    const u = D.user(c.s, c.p.id);
    if (!u || u.role_id === 1) fail(404, 'Staff not found');
    u.status = 2;
    return ok({ message: 'Staff deleted successfully!' });
  });
}

module.exports = { register };
