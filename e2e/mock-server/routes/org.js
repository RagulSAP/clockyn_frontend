'use strict';
/** Organisation structure: branches, departments, company, managers, shifts, holidays, attendance rule, system. */
const { fail, bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');
const { branchRow } = require('./home');
const { MANAGER_PERMISSIONS } = require('../fixtures');

const ok = (extra) => ({ success: true, ...extra });

function org(c, id) {
  return D.resolveOrg(c.s, id);
}

function nextId(c, key, prefix) {
  c.s.seq[key] += 1;
  return prefix ? `${prefix}${c.s.seq[key]}` : String(c.s.seq[key]);
}

function companyRow(o, origin) {
  return { ...o, logo_url: o.logo_url ? D.abs(origin, o.logo_url) : null, org_logo: o.logo_url ? D.abs(origin, o.logo_url) : null };
}

function addBranches(c, orgId, list) {
  for (const b of Array.isArray(list) ? list : []) {
    const name = typeof b === 'string' ? b : b.branch_name || b.name;
    if (!name) continue;
    c.s.branches.push({ branch_id: nextId(c, 'branch'), branch_name: name, branch_address: (b && b.branch_address) || '', org_id: orgId, branch_latitude: (b && b.branch_latitude) || 12.9716, branch_longitude: (b && b.branch_longitude) || 77.5946, punch_radius: (b && b.punch_radius) || 100 });
  }
}

function addDepartments(c, orgId, list) {
  for (const d of Array.isArray(list) ? list : []) {
    const name = typeof d === 'string' ? d : d.dept_name || d.name;
    if (name) c.s.departments.push({ dept_id: nextId(c, 'dept', 'dept-'), dept_name: name, org_id: orgId });
  }
}

function managerRow(c, u) {
  return {
    user_id: u.user_id,
    name: u.name,
    emp_id: u.emp_id,
    assignments: u.assignments.map((a) => ({ branch_id: a.branch_id, branch_name: (D.branch(c.s, a.branch_id) || {}).branch_name || '', dept_id: a.dept_id, dept_name: a.dept_id ? (D.dept(c.s, a.dept_id) || {}).dept_name || '' : 'All Departments' })),
  };
}

function registerBranchesDepartments(r) {
  r.get('/branch/:id', (c) => {
    const b = D.branch(c.s, c.p.id);
    if (!b) fail(404, 'Branch not found');
    return branchRow(b);
  });

  r.post('/branch/add', (c) => {
    const b = c.b;
    if (!String(b.branch_name || '').trim()) fail(422, 'branch_name is required');
    const orgId = org(c, b.org_id);
    if (c.s.branches.some((x) => x.org_id === orgId && x.branch_name.toLowerCase() === String(b.branch_name).trim().toLowerCase())) fail(400, 'Branch name already exists');
    const row = { branch_id: nextId(c, 'branch'), branch_name: String(b.branch_name).trim(), branch_address: b.branch_address || '', org_id: orgId, branch_latitude: Number(b.branch_latitude) || 0, branch_longitude: Number(b.branch_longitude) || 0, punch_radius: Number(b.punch_radius) || 100 };
    c.s.branches.push(row);
    return { message: 'Branch added successfully', branch_id: row.branch_id, branch_name: row.branch_name };
  });

  r.put('/branch/update/:id', (c) => {
    const row = D.branch(c.s, c.p.id);
    if (!row) fail(404, 'Branch not found');
    const b = c.b;
    if (b.branch_name !== undefined) row.branch_name = String(b.branch_name).trim();
    if (b.branch_address !== undefined) row.branch_address = b.branch_address;
    if (b.branch_latitude !== undefined) row.branch_latitude = Number(b.branch_latitude);
    if (b.branch_longitude !== undefined) row.branch_longitude = Number(b.branch_longitude);
    if (b.punch_radius !== undefined) row.punch_radius = Number(b.punch_radius);
    return { message: 'Branch updated successfully', branch_id: row.branch_id, branch_name: row.branch_name };
  });

  r.post('/branch/delete/:id', (c) => {
    const row = D.branch(c.s, c.p.id);
    if (!row) fail(404, 'Branch not found');
    const staff = c.s.users.filter((u) => String(u.branch_id) === String(row.branch_id) && u.role_id !== 1 && u.status !== 2);
    if (staff.length) fail(400, `Cannot delete branch: ${staff.length} staff member(s) are assigned to it. Reassign them first.`);
    c.s.branches = c.s.branches.filter((b) => b !== row);
    return { message: 'Branch deleted successfully', branch_id: row.branch_id, branch_name: row.branch_name };
  });

  r.get('/branch/staff/:id', (c) =>
    c.s.users
      .filter((u) => String(u.branch_id) === String(c.p.id) && u.role_id !== 1 && u.status !== 2)
      .map((u) => ({ user_id: u.user_id, name: u.name, emp_id: u.emp_id, mobile_number: u.mobile_number, email: u.email, dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '', current_branch_id: u.branch_id, current_branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '' })),
  );

  r.post('/branch/reassign-staff', (c) => {
    const target = D.branch(c.s, c.b.new_branch_id);
    if (!target) fail(404, 'Target branch not found');
    const ids = Array.isArray(c.b.staff_ids) ? c.b.staff_ids : [];
    let count = 0;
    for (const id of ids) {
      const u = D.user(c.s, id);
      if (u) { u.branch_id = target.branch_id; count += 1; }
    }
    let deleted = false;
    if (c.b.delete_branch_id) {
      const old = D.branch(c.s, c.b.delete_branch_id);
      const left = old ? c.s.users.filter((u) => String(u.branch_id) === String(old.branch_id) && u.role_id !== 1 && u.status !== 2).length : 1;
      if (old && left === 0) { c.s.branches = c.s.branches.filter((b) => b !== old); deleted = true; }
    }
    return { message: 'Staff reassigned successfully', reassigned_count: count, branch_deleted: deleted };
  });

  // departments
  r.post('/department/add', (c) => {
    const name = String(c.b.dept_name || '').trim();
    if (!name) fail(422, 'dept_name is required');
    const orgId = org(c, c.b.org_id);
    if (c.s.departments.some((d) => d.org_id === orgId && d.dept_name.toLowerCase() === name.toLowerCase())) return bizFail('Department already exists');
    const row = { dept_id: nextId(c, 'dept', 'dept-'), dept_name: name, org_id: orgId };
    c.s.departments.push(row);
    return ok({ message: 'Department added successfully', dept_id: row.dept_id, dept_name: row.dept_name });
  });
  r.put('/department/update/:id', (c) => {
    const row = D.dept(c.s, c.p.id);
    if (!row) return bizFail('Department not found');
    row.dept_name = String(c.b.dept_name || row.dept_name).trim();
    return ok({ message: 'Department updated successfully', dept_id: row.dept_id, dept_name: row.dept_name });
  });
  r.post('/department/delete/:id', (c) => {
    const row = D.dept(c.s, c.p.id);
    if (!row) return bizFail('Department not found');
    const staff = c.s.users.filter((u) => u.dept_id === row.dept_id && u.role_id !== 1 && u.status !== 2);
    if (staff.length) return bizFail(`Cannot delete department: ${staff.length} staff member(s) belong to it.`);
    c.s.departments = c.s.departments.filter((d) => d !== row);
    return ok({ message: 'Department deleted successfully', dept_id: row.dept_id, dept_name: row.dept_name });
  });
}

function registerCompany(r) {
  r.post('/company/add', (c) => {
    const b = c.b;
    if (!String(b.org_name || '').trim()) fail(422, 'org_name is required');
    const admin = D.user(c.s, b.user_id) || c.s.users.find((u) => u.role_id === 1);
    const seq = (c.s.seq.org += 1);
    const orgId = `org-${String(seq).padStart(4, '0')}`;
    c.s.orgs.push({ org_id: orgId, org_name: b.org_name, org_address: b.org_address || '', org_gst: b.org_gst || '', gst_number: b.gst_number || '', parent_id: admin.user_id, state: b.state || null, district: b.district || null, pincode: b.pincode || null, mobile_number: b.mobile_number || admin.mobile_number, email: b.email || admin.email, pan_number: b.pan_number || null, company_website: b.company_website || null, cin_number: b.cin_number || null, tan_number: b.tan_number || null, msme_number: b.msme_number || null, business_category: b.business_category || null, logo_url: null, created_at: T.isoNow() });
    addBranches(c, orgId, b.branches);
    addDepartments(c, orgId, b.departments);
    return ok({ message: 'Company added successfully!', org_id: orgId, org_name: b.org_name, user_id: admin.user_id });
  });

  r.put('/company/update/:org', (c) => {
    const o = D.org(c.s, c.p.org);
    if (!o) fail(404, 'Company not found');
    for (const k of ['org_name', 'org_address', 'org_gst', 'gst_number', 'state', 'district', 'pincode', 'mobile_number', 'email', 'pan_number', 'company_website', 'cin_number', 'tan_number', 'msme_number', 'business_category']) {
      if (c.b[k] !== undefined) o[k] = c.b[k];
    }
    return ok({ message: 'Company updated successfully!', org_id: o.org_id, org_name: o.org_name, user_id: o.parent_id });
  });

  r.get('/company/details/:org', (c) => {
    const o = D.org(c.s, c.p.org);
    if (!o) return bizFail('Company not found');
    return ok({ data: companyRow(o, c.origin) });
  });

  r.get('/company/list/:uid', (c) => ok({ data: c.s.orgs.filter((o) => o.parent_id === c.p.uid).map((o) => companyRow(o, c.origin)) }));

  r.delete('/company/delete/:org/:uid', (c) => {
    const mine = c.s.orgs.filter((o) => o.parent_id === c.p.uid);
    if (mine.length <= 1) fail(400, 'Cannot delete the only company');
    const o = D.org(c.s, c.p.org);
    if (!o) fail(404, 'Company not found');
    c.s.orgs = c.s.orgs.filter((x) => x !== o);
    c.s.users = c.s.users.filter((u) => u.org_id !== o.org_id || u.role_id === 1);
    c.s.branches = c.s.branches.filter((b) => b.org_id !== o.org_id);
    c.s.departments = c.s.departments.filter((d) => d.org_id !== o.org_id);
    c.s.shifts = c.s.shifts.filter((x) => x.org_id !== o.org_id);
    return ok({ message: 'Company deleted successfully', remaining_companies: c.s.orgs.filter((x) => x.parent_id === c.p.uid).map((x) => companyRow(x, c.origin)) });
  });

  r.post('/company/update-logo/:org', (c) => {
    const o = D.org(c.s, c.p.org);
    if (!o) fail(404, 'Company not found');
    if (!c.files.some((f) => f.field === 'logo')) fail(422, 'logo file is required');
    o.logo_url = `/files/logo/${o.org_id}.png`;
    return ok({ message: 'Logo updated successfully', logo_url: D.abs(c.origin, o.logo_url) });
  });

  r.delete('/company/delete-account/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'User not found');
    u.status = 2;
    return ok({ message: 'Account deleted successfully' });
  });

  r.post('/company/request-deletion/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'User not found');
    if (!c.s.deletionRequests.includes(u.user_id)) c.s.deletionRequests.push(u.user_id);
    // The real backend deactivates the account; the mock only records the request so the seeded user stays usable.
    return ok({ message: 'Account deletion request submitted.' });
  });

  r.post('/company/suggest-feature', (c) => {
    if (!String(c.b.subject || '').trim() || !String(c.b.content || '').trim()) fail(422, 'subject and content are required');
    c.s.suggestions.push({ ...c.b, created_at: T.isoNow() });
    return ok({ message: 'Thank you for your suggestion!' });
  });
}

function registerManagers(r) {
  r.get('/managers', (c) => {
    const orgId = org(c, c.q.org_id);
    return c.s.users.filter((u) => u.org_id === orgId && u.role_id === 2 && u.status !== 2).map((u) => managerRow(c, u));
  });

  r.get('/managers/staff', (c) => {
    const orgId = org(c, c.q.org_id);
    const branchId = c.q.branch_id && c.q.branch_id !== '0' ? c.q.branch_id : null;
    const deptId = c.q.dept_id && c.q.dept_id !== 'ALL' ? c.q.dept_id : null;
    return c.s.users
      .filter((u) => u.org_id === orgId && u.role_id === 3 && u.status === 1 && (!branchId || String(u.branch_id) === String(branchId)) && (!deptId || u.dept_id === deptId))
      .map((u) => ({ user_id: u.user_id, name: u.name, emp_id: u.emp_id }));
  });

  r.post('/managers/assign', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const assignments = (Array.isArray(c.b.assignments) ? c.b.assignments : []).map((a) => ({ branch_id: String(a.branch_id), dept_id: a.dept_id || null }));
    if (!assignments.length) fail(400, 'At least one branch assignment is required');
    u.role_id = 2;
    u.assignments = assignments;
    if (!u.manager_permissions) u.manager_permissions = Object.fromEntries(MANAGER_PERMISSIONS.map((p) => [p, false]));
    return ok({ message: 'Manager assigned successfully' });
  });

  r.get('/managers/:uid/permissions', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u || u.role_id !== 2) fail(404, 'Manager not found');
    return ok({ permissions: u.manager_permissions || {} });
  });

  r.post('/managers/:uid/permissions', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u || u.role_id !== 2) fail(404, 'Manager not found');
    u.manager_permissions = { ...(c.b.permissions || {}) };
    return ok({ message: 'Permissions saved successfully' });
  });

  r.get('/managers/:uid/staff', (c) => {
    const m = D.user(c.s, c.p.uid);
    if (!m) fail(404, 'Manager not found');
    const scope = D.scopeFilter(c.s, m.user_id);
    return D.activeStaff(c.s, m.org_id, { scope }).filter((u) => u.role_id === 3).map((u) => ({ user_id: u.user_id, name: u.name, emp_id: u.emp_id, branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '', dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '' }));
  });

  r.delete('/managers/:uid', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u || u.role_id !== 2) fail(404, 'Manager not found');
    u.role_id = 3;
    u.assignments = [];
    u.manager_permissions = null;
    return ok({ message: 'Manager removed successfully' });
  });
}

const shiftRow = (x) => ({ shift_id: x.shift_id, shift_name: x.shift_name, start_time: T.fmtCompact12(x.start_time), end_time: T.fmtCompact12(x.end_time), org_id: x.org_id, status: x.status });

function registerShifts(r) {
  r.get('/shift/get_shifts/:org', (c) => ok({ data: c.s.shifts.filter((x) => x.org_id === org(c, c.p.org) && x.status === 1).map(shiftRow) }));

  r.get('/shift/get_shift/:id', (c) => {
    const x = D.shift(c.s, c.p.id);
    if (!x) fail(404, 'Shift not found');
    return ok({ data: shiftRow(x) });
  });

  r.post('/shift/create', (c) => {
    const name = String(c.b.shift_name || '').trim();
    const st = T.toHHmm(c.b.start_time);
    const en = T.toHHmm(c.b.end_time);
    if (!name || !st || !en) fail(422, 'shift_name, start_time and end_time are required');
    const orgId = org(c, c.b.org_id);
    if (c.s.shifts.some((x) => x.org_id === orgId && x.status === 1 && x.shift_name.toLowerCase() === name.toLowerCase())) return bizFail('Shift name already exists');
    const row = { shift_id: Number(nextId(c, 'shift')), shift_name: name, start_time: st, end_time: en, org_id: orgId, status: 1 };
    c.s.shifts.push(row);
    return ok({ message: 'Shift created successfully', shift_id: row.shift_id });
  });

  r.put('/shift/update/:id', (c) => {
    const x = D.shift(c.s, c.p.id);
    if (!x) fail(404, 'Shift not found');
    if (c.b.shift_name) x.shift_name = String(c.b.shift_name).trim();
    if (T.toHHmm(c.b.start_time)) x.start_time = T.toHHmm(c.b.start_time);
    if (T.toHHmm(c.b.end_time)) x.end_time = T.toHHmm(c.b.end_time);
    return ok({ message: 'Shift updated successfully' });
  });

  r.delete('/shift/delete/:id', (c) => {
    const x = D.shift(c.s, c.p.id);
    if (!x) fail(404, 'Shift not found');
    x.status = 0;
    for (const u of c.s.users) if (String(u.shift_id) === String(x.shift_id)) u.shift_id = 0;
    return ok({ message: 'Shift deleted successfully' });
  });

  r.get('/shift/assigned_staff/:org/:shift', (c) => ok({ data: D.activeStaff(c.s, org(c, c.p.org)).filter((u) => String(u.shift_id) === String(c.p.shift)).map((u) => D.staffRow(c.s, u, T.today(), c.origin)) }));
  r.get('/shift/unassigned_staff/:org/:shift', (c) => ok({ data: D.activeStaff(c.s, org(c, c.p.org)).filter((u) => String(u.shift_id) !== String(c.p.shift)).map((u) => D.staffRow(c.s, u, T.today(), c.origin)) }));
  r.post('/shift/assign_staff', (c) => {
    if (!D.shift(c.s, c.b.shift_id)) fail(404, 'Shift not found');
    for (const id of c.b.user_ids || []) {
      const u = D.user(c.s, id);
      if (u) u.shift_id = Number(c.b.shift_id);
    }
    return ok({ message: 'Staff assigned successfully' });
  });
  r.delete('/shift/unassign_staff/:org/:uid/:shift', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'Staff not found');
    u.shift_id = 0;
    return ok({ message: 'Staff unassigned successfully' });
  });
}

function registerHolidays(r) {
  r.get('/api/holidays/off-days/:org', (c) => ok({ off_days: c.s.weeklyOffs }));
  r.post('/api/holidays/off-days/:org', (c) => {
    c.s.weeklyOffs = [...new Set((c.b.off_days || []).map(Number).filter((n) => n >= 0 && n <= 6))].sort();
    return ok({ message: 'Weekly offs saved', off_days: c.s.weeklyOffs });
  });

  r.get('/api/holidays/working-days/:org', (c) => {
    const year = Number(c.q.year);
    const month = Number(c.q.month);
    const total = T.daysInMonth(year, month);
    const prefix = T.monthPrefix(year, month);
    let off = 0;
    let hol = 0;
    for (let d = 1; d <= total; d += 1) {
      const date = `${prefix}-${T.pad(d)}`;
      if (c.s.weeklyOffs.includes(T.pyWeekday(date))) { off += 1; continue; }
      const h = c.s.holidays.some((x) => x.date === date && (!x.branch_name || x.branch_name === c.q.branch_name) && (!x.dept_name || x.dept_name === c.q.dept_name || !c.q.dept_name) && x.block_attendance !== false);
      if (h) hol += 1;
    }
    return ok({ total_days: total, off_days: off, holidays: hol, working_days: total - off - hol });
  });

  r.get('/api/holidays/:org', (c) => {
    const prefix = T.monthPrefix(Number(c.q.year), Number(c.q.month));
    return ok({ data: c.s.holidays.filter((h) => h.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date)).map(({ id, name, date, branch_name, dept_name, block_attendance }) => ({ id, name, date, branch_name, dept_name, block_attendance })) });
  });

  r.post('/api/holidays/:org', (c) => {
    const { name, date } = c.b;
    if (!name || !date) fail(422, 'name and date are required');
    if (c.s.holidays.some((h) => h.date === date && h.name === name)) return bizFail('Holiday already exists for this date');
    const row = { id: Number(nextId(c, 'holiday')), org_id: org(c, c.p.org), name, date, branch_name: c.b.branch_name || null, dept_name: c.b.dept_name || null, block_attendance: c.b.block_attendance !== false };
    c.s.holidays.push(row);
    return ok({ message: 'Holiday added successfully', id: row.id });
  });

  r.put('/api/holidays/:org/:id', (c) => {
    const h = c.s.holidays.find((x) => String(x.id) === c.p.id);
    if (!h) return bizFail('Holiday not found');
    if (c.b.name) h.name = c.b.name;
    if (c.b.block_attendance !== undefined) h.block_attendance = !!c.b.block_attendance;
    if (c.b.date) h.date = c.b.date;
    return ok({ message: 'Holiday updated successfully' });
  });

  r.delete('/api/holidays/:org/:id', (c) => {
    const h = c.s.holidays.find((x) => String(x.id) === c.p.id);
    if (!h) return bizFail('Holiday not found');
    c.s.holidays = c.s.holidays.filter((x) => x !== h);
    return ok({ message: 'Holiday deleted successfully' });
  });

  r.get('/api/attendance-rule/:org', (c) => ok({ ...c.s.attendanceRule }));
  r.post('/api/attendance-rule/:org', (c) => {
    c.s.attendanceRule = { late_punch_in_count: Number(c.b.late_punch_in_count) || 3, consider_as: c.b.consider_as === 'Leave' ? 'Leave' : 'Half Day' };
    return ok({ message: 'Attendance rule saved' });
  });

  r.get('/version/check', (c) => ok({ update_required: false, latest_version: '1.0.0', force_update: false, message: null, store_url: null, ...(c.s.flags.version || {}) }));
}

function register(r) {
  registerBranchesDepartments(r);
  registerCompany(r);
  registerManagers(r);
  registerShifts(r);
  registerHolidays(r);
}

module.exports = { register };
