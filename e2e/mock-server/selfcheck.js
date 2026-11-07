#!/usr/bin/env node
'use strict';
/**
 * Contract smoke test of the mock backend itself: calls every endpoint family the app uses and checks the status +
 * envelope. Run against a running server:  node e2e/mock-server/selfcheck.js  (MOCK_PORT to override).
 * Exit code 1 on any failure. Leaves the server state mutated — it resets first and last.
 */
const BASE = `http://127.0.0.1:${process.env.MOCK_PORT || 8787}`;
const ORG = 'org-0001';
const ADM = 'adm-0001';
const STF = 'stf-0001';
const MGR = 'mgr-0001';
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const month = Number(today.slice(5, 7));
const year = Number(today.slice(0, 4));
const ym = today.slice(0, 7);

let failures = 0;
async function call(method, path, { body, form, expect = 200, check } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['content-type'] = 'application/json';
  }
  if (form) init.body = form;
  let res;
  try {
    res = await fetch(BASE + path, init);
  } catch (e) {
    failures += 1;
    console.log(`FAIL ${method} ${path} -> network (${e.message})`);
    return null;
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  let problem = res.status !== expect ? `status ${res.status} (wanted ${expect}) ${text.slice(0, 160)}` : null;
  if (!problem && check) {
    try { const r = check(json, res); if (r) problem = r; } catch (e) { problem = `check threw: ${e.message}`; }
  }
  if (problem) {
    failures += 1;
    console.log(`FAIL ${method} ${path} -> ${problem}`);
  }
  return json;
}

const list = (j) => (Array.isArray(j) ? j : j && Array.isArray(j.data) ? j.data : null);
const isList = (min = 0) => (j) => { const l = list(j); return l && l.length >= min ? null : `expected list with >= ${min} rows`; };
const isOk = (j) => (j && j.success === true ? null : `expected success:true, got ${JSON.stringify(j).slice(0, 120)}`);
const isBiz = (j) => (j && j.success === false ? null : 'expected success:false');

async function main() {
  await call('POST', '/__test/reset', { body: {} });

  // auth
  await call('POST', '/auth/login', { body: { login_id: '9000000001' }, check: (j) => (j.role_id === 1 ? null : 'role') });
  await call('POST', '/auth/login', { body: { login_id: '9000000003' }, expect: 403 });
  await call('POST', '/auth/login', { body: { login_id: '1111111111' }, expect: 401 });
  await call('POST', '/auth/employee-login', { body: { login_id: '9000000002' }, check: (j) => (j.manager_permissions.length === 10 ? null : 'perms') });
  await call('POST', '/auth/generate-otp', { body: { contact: '9000000003', purpose: 'login', role_id: 3 }, check: isOk });
  await call('POST', '/auth/validate-otp', { body: { contact: '9000000003', otp_code: '000000', purpose: 'login' }, expect: 400 });
  const v = await call('POST', '/auth/validate-otp', { body: { contact: '9000000003', otp_code: '123456', purpose: 'login', device_token: 'selfcheck-token' }, check: (j) => (j.device_token === 'selfcheck-token' ? null : 'device token') });
  await call('POST', '/auth/verify-device-token', { body: { contact: '9000000003', device_token: v && v.device_token }, check: (j) => (j.skip_otp ? null : 'skip_otp') });
  await call('POST', '/auth/verify-device-token', { body: { contact: '9000000003', device_token: 'other' }, check: (j) => (j.device_mismatch ? null : 'mismatch') });
  await call('POST', '/auth/validate-otp', { body: { contact: '9000000003', otp_code: '123456', purpose: 'login', device_token: 'selfcheck-token' }, check: (j) => (j.access_token && j.expires_in === 7776000 ? null : 'access_token') });
  await call('POST', '/auth/logout', { body: { user_id: STF }, check: isOk });
  await call('GET', '/auth/check-mobile/9000000001', { check: (j) => (j.exists ? null : 'exists') });
  await call('GET', `/auth/org-logo/${ORG}`, { check: isOk });
  await call('GET', `/auth/push-token/${STF}`, { expect: 404 });
  await call('GET', `/requests/check-session/${STF}?device_token=selfcheck-token`, { check: (j) => (j.valid ? null : 'valid') });
  await call('GET', `/requests/check-session/${STF}?device_token=nope`, { check: (j) => (j.force_logout ? null : 'force') });

  // home
  await call('GET', `/home/dashboard-status?user_id=${ORG}`, { check: (j) => (j.total_staff > 0 ? null : 'total') });
  await call('GET', `/home/department-stats?user_id=${ORG}`, { check: isList(3) });
  await call('GET', '/home/current-date', { check: (j) => (j.current_date === today ? null : 'date') });
  for (const k of ['absent', 'late-punched-in', 'punched-in', 'working', 'punched-out']) await call('GET', `/home/${k}-staff?user_id=${ORG}`, { check: isList(1) });
  await call('GET', `/home/all-staff?user_id=${ORG}`, { check: isList(20) });
  await call('GET', `/home/branches?org_id=${ORG}`, { check: isList(2) });
  await call('GET', `/home/departments?org_id=${ORG}`, { check: isList(3) });
  await call('GET', `/home/staff-detail?staff_id=stf-0003&org_id=${ORG}`, { check: (j) => (j.name ? null : 'name') });
  await call('GET', `/home/staff-profile?staff_id=stf-0003&org_id=${ORG}`, { check: (j) => (j.bank_name ? null : 'bank') });
  await call('GET', `/home/daily-attendance?org_id=${ORG}&target_date=${today}`, { check: isList(20) });
  await call('GET', `/home/monthly-attendance?staff_id=stf-0003&org_id=${ORG}&month=${month}&year=${year}`, { check: (j) => (j.attendance_data.length > 0 ? null : 'rows') });
  await call('PUT', '/home/update-attendance-punch', { body: { staff_id: 'stf-0009', org_id: ORG, date: today, punch_in: '09:10', punch_out: '18:00' }, check: isOk });
  await call('GET', `/home/org-admin/${ORG}`, { check: (j) => (j.user_id === ADM ? null : 'admin') });
  await call('GET', `/home/staff-punch-locations?org_id=${ORG}&target_date=${today}`, { check: isList(5) });

  // org structure
  await call('GET', '/branch/101', { check: (j) => (j.punch_radius ? null : 'radius') });
  const nb = await call('POST', '/branch/add', { body: { branch_name: 'Selfcheck Branch', branch_address: 'x', branch_latitude: 1, branch_longitude: 2, punch_radius: 80, org_id: ORG }, check: (j) => (j.branch_id ? null : 'id') });
  await call('PUT', `/branch/update/${nb.branch_id}`, { body: { branch_name: 'Selfcheck Branch 2' } });
  await call('GET', `/branch/staff/101?org_id=${ORG}`, { check: isList(1) });
  await call('POST', `/branch/delete/${nb.branch_id}?org_id=${ORG}`, { check: (j) => (j.message ? null : 'msg') });
  await call('POST', '/branch/delete/101?org_id=' + ORG, { expect: 400 });
  const nd = await call('POST', '/department/add', { body: { dept_name: 'Selfcheck Dept', org_id: ORG }, check: isOk });
  await call('PUT', `/department/update/${nd.dept_id}`, { body: { dept_name: 'Selfcheck Dept 2', org_id: ORG }, check: isOk });
  await call('POST', `/department/delete/${nd.dept_id}?org_id=${ORG}`, { check: isOk });
  await call('GET', `/company/details/${ORG}`, { check: (j) => (j.data.org_name ? null : 'name') });
  await call('GET', `/company/list/${ADM}`, { check: isList(1) });
  await call('DELETE', `/company/delete/${ORG}/${ADM}`, { expect: 400 });
  await call('GET', `/managers/?org_id=${ORG}`, { check: isList(2) });
  await call('GET', `/managers/staff?org_id=${ORG}&branch_id=0&dept_id=ALL`, { check: isList(5) });
  await call('GET', `/managers/${MGR}/permissions`, { check: (j) => (Object.keys(j.permissions).length === 10 ? null : 'perms') });
  await call('POST', `/managers/${MGR}/permissions`, { body: { permissions: { 'Staff Management': false } }, check: isOk });
  await call('GET', `/managers/${MGR}/staff`, { check: isList(1) });
  await call('POST', '/managers/assign', { body: { user_id: 'stf-0020', assignments: [{ branch_id: 101 }] }, check: isOk });
  await call('DELETE', '/managers/stf-0020', { check: isOk });
  await call('GET', `/shift/get_shifts/${ORG}`, { check: isList(3) });
  const sh = await call('POST', '/shift/create', { body: { org_id: ORG, shift_name: 'Selfcheck', start_time: '10:00AM', end_time: '07:00PM' }, check: isOk });
  await call('GET', `/shift/get_shift/${sh.shift_id}`, { check: (j) => (j.data.start_time === '10:00AM' ? null : 'time') });
  await call('POST', '/shift/assign_staff', { body: { org_id: ORG, user_ids: ['stf-0003'], shift_id: sh.shift_id }, check: isOk });
  await call('GET', `/shift/assigned_staff/${ORG}/${sh.shift_id}`, { check: isList(1) });
  await call('GET', `/shift/unassigned_staff/${ORG}/${sh.shift_id}`, { check: isList(1) });
  await call('DELETE', `/shift/unassign_staff/${ORG}/stf-0003/${sh.shift_id}`, { check: isOk });
  await call('DELETE', `/shift/delete/${sh.shift_id}?org_id=${ORG}`, { check: isOk });
  await call('GET', `/api/holidays/${ORG}?year=${year}&month=${month}`, { check: isOk });
  const hol = await call('POST', `/api/holidays/${ORG}`, { body: { name: 'Selfcheck Day', date: `${ym}-27`, block_attendance: true }, check: isOk });
  await call('PUT', `/api/holidays/${ORG}/${hol.id}`, { body: { name: 'Selfcheck Day 2' }, check: isOk });
  await call('DELETE', `/api/holidays/${ORG}/${hol.id}`, { check: isOk });
  await call('GET', `/api/holidays/off-days/${ORG}`, { check: (j) => (Array.isArray(j.off_days) ? null : 'off') });
  await call('POST', `/api/holidays/off-days/${ORG}`, { body: { off_days: [6] }, check: isOk });
  await call('GET', `/api/holidays/working-days/${ORG}?year=${year}&month=${month}`, { check: (j) => (j.working_days > 0 ? null : 'wd') });
  await call('GET', `/api/attendance-rule/${ORG}`, { check: (j) => (j.late_punch_in_count ? null : 'rule') });
  await call('POST', `/api/attendance-rule/${ORG}`, { body: { late_punch_in_count: 4, consider_as: 'Leave' }, check: isOk });

  // staff CRUD
  await call('GET', `/addstaff/branches?user_id=${ORG}&role_id=1`, { check: isList(2) });
  await call('GET', `/addstaff/departments?user_id=${ORG}&role_id=1`, { check: isList(3) });
  await call('GET', `/addstaff/managers/?user_id=${ORG}&role_id=1`, { check: isList(2) });
  await call('GET', `/addstaff/next-emp-id?user_id=${ORG}&role_id=3`, { check: (j) => (j.next_emp_id ? null : 'next') });
  await call('GET', `/addstaff/validate-emp-id?user_id=${ORG}&role_id=3&emp_id=E1001`, { check: (j) => (j.is_available === false ? null : 'avail') });
  await call('GET', `/addstaff/count/${ORG}`, { check: (j) => (j.count > 0 ? null : 'count') });
  await call('GET', `/addstaff/all-staff/${ORG}`, { check: isList(20) });
  const ns = await call('POST', '/addstaff/', { body: { name: 'Selfcheck Person', emp_id: 'E9999', mobile_number: '9111111111', email: 'sc@clockyn.test', user_id: ORG, shift_id: 1, is_field_staff: 0, branch_name: 'Head Office', dept_name: 'Sales' }, check: isOk });
  await call('POST', '/addstaff/', { body: { name: 'Dup', emp_id: 'E9998', mobile_number: '9111111111', email: 'dup@clockyn.test', user_id: ORG }, expect: 400 });
  await call('GET', `/addstaff/${ns.user_id}`, { check: (j) => (j.status === 1 ? null : 'status') });
  await call('PUT', `/addstaff/${ns.user_id}`, { body: { name: 'Selfcheck Renamed', user_id: ORG, email: 'sc@clockyn.test', emp_id: 'E9999', mobile_number: '9111111111' }, check: isOk });
  await call('PUT', `/addstaff/${ns.user_id}/status?status=0`, { check: isOk });
  await call('DELETE', `/addstaff/${ns.user_id}/permanent?requested_by_role_id=3`, { expect: 403 });
  await call('DELETE', `/addstaff/${ns.user_id}/permanent?requested_by_role_id=1`, { check: isOk });

  // employee side
  await call('GET', `/attendance/today/${STF}`, { check: isOk });
  await call('GET', `/attendance/sessions/stf-0002?date=${today}`, { check: (j) => (j.sessions.length > 0 ? null : 'sessions') });
  await call('GET', `/face/check/${STF}`, { check: (j) => (j.registered === true ? null : 'face') });
  await call('POST', '/face/check-location', { form: new URLSearchParams({ user_id: STF, latitude: '12.9716', longitude: '77.5946' }), check: isOk });
  await call('POST', '/face/check-location', { form: new URLSearchParams({ user_id: STF, latitude: '13.5', longitude: '77.5946' }), check: isBiz });
  const fd = () => { const f = new FormData(); f.append('user_id', STF); f.append('org_id', ORG); f.append('action', 'punch_in'); f.append('latitude', '12.9716'); f.append('longitude', '77.5946'); f.append('face', new Blob(['x'], { type: 'image/jpeg' }), 'face.jpg'); return f; };
  await call('POST', '/face/punch', { form: fd(), check: (j) => (j.success && j.time ? null : JSON.stringify(j)) });
  await call('POST', '/face/punch', { form: fd(), check: isBiz }); // already punched in
  await call('GET', `/attendance/today/${STF}`, { check: (j) => (j.is_punched_in ? null : 'punched in') });
  await call('GET', `/employee/personal-details/${STF}`, { check: (j) => (j.name ? null : 'name') });
  await call('PUT', `/employee/personal-details/${STF}`, { body: { name: 'Aarav Sharma', mobile_number: '9000000003', email: 'aarav.sharma@clockyn.test', dob: '1992-04-12' }, check: isOk });
  await call('GET', `/employee/today-birthdays/${ORG}?exclude_user_id=${STF}`, { check: (j) => (Array.isArray(j.birthdays) && j.birthdays.length === 0 ? null : 'bdays') });
  await call('POST', '/staff-location/log', { body: { user_id: STF, org_id: ORG, latitude: 1, longitude: 2 }, expect: 403 });
  await call('POST', '/staff-location/log', { body: { user_id: 'stf-0002', org_id: ORG, latitude: 12.97, longitude: 77.59 }, check: isOk });
  await call('GET', `/staff-location/locations?org_id=${ORG}&target_date=${today}`, { check: isList(1) });
  await call('GET', `/staff-location/stats?org_id=${ORG}&target_date=${today}`, { check: (j) => (j.data.total > 0 ? null : 'total') });
  await call('GET', `/staff-location/history/stf-0002?start_date=${today}&end_date=${today}`, { check: isList(1) });

  // requests
  await call('GET', `/requests/admin/${ORG}`, { check: isList(10) });
  await call('GET', `/requests/employee/${STF}/${ORG}`, { check: isList(1) });
  const lv = await call('POST', '/requests/leave/submit', { body: { user_id: STF, org_id: ORG, leave_dates: [`${ym}-26`], reason: 'x' }, check: isOk });
  await call('POST', '/requests/leave/submit', { body: { user_id: STF, org_id: ORG, leave_dates: [`${ym}-26`], reason: 'x' }, check: isBiz });
  await call('POST', '/requests/permission/submit', { body: { user_id: STF, org_id: ORG, permission_date: today, start_time: '10:00', end_time: '11:00', reason: 'x' }, check: isOk });
  await call('POST', '/requests/shift-change/submit', { body: { user_id: STF, org_id: ORG, reason: 'x', requested_shift_id: 2, shift_change_date: today }, check: isOk });
  await call('POST', '/requests/device-change/submit', { body: { user_id: STF, org_id: ORG, reason: 'x' }, check: isOk });
  await call('POST', '/requests/update-status', { body: { request_id: lv.request_id, status: 'approved', action_by: ADM, role_id: 1, leave_date: `${ym}-26` }, check: isOk });
  await call('POST', '/requests/update-status', { body: { request_id: 'req-301', status: 'approved', action_by: ADM, role_id: 1 }, check: isOk });
  await call('GET', `/requests/calendar/${STF}/${ORG}?start_date=${ym}-01&end_date=${ym}-30`, { check: isList(1) });

  // expenses
  await call('GET', `/expenses/odometer/readings?user_id=stf-0002`, { check: isList(1) });
  await call('POST', '/expenses/odometer/start', { body: { user_id: 'stf-0004', reading_date: today, start_km: 100 }, check: isOk });
  await call('POST', '/expenses/odometer/stop', { body: { user_id: 'stf-0004', reading_date: today, stop_km: 150 }, check: (j) => (j.distance === 50 ? null : 'distance') });
  const pf = new FormData(); pf.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'o.jpg');
  await call('POST', `/expenses/odometer/upload-photo?user_id=stf-0004&reading_date=${today}&photo_type=start`, { form: pf, check: isOk });
  const ex = await call('POST', '/expenses/travel-bill/submit', { body: { user_id: STF, expense_date: today, expense_type: 'travel', amount: 100 }, check: (j) => (j.expense_id ? null : 'id') });
  const pf2 = new FormData(); pf2.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'r.jpg');
  await call('POST', `/expenses/travel-bill/upload-photo?user_id=${STF}&expense_id=${ex.expense_id}`, { form: pf2, check: isOk });
  await call('GET', `/expenses/travel-bill/expenses?user_id=${STF}&expense_type=TRAVEL`, { check: isList(1) });
  await call('GET', `/expenses/admin/odometer-readings/${ORG}`, { check: isList(5) });
  await call('PUT', '/expenses/admin/odometer-readings/odo-001/status', { body: { status: 'approved', org_id: ORG }, check: isOk });
  await call('GET', `/expenses/admin/travel-bill/${ORG}?expense_type=BILL`, { check: isList(1) });
  await call('PUT', `/expenses/admin/travel-bill/${ex.expense_id}/status`, { body: { status: 'rejected', org_id: ORG }, check: isOk });
  await call('GET', `/expenses/admin/allowance-rate/${ORG}`, { check: (j) => (j.rate > 0 ? null : 'rate') });
  await call('POST', '/expenses/admin/allowance-rate', { body: { org_id: ORG, rate: 9 }, check: isOk });

  // chat
  await call('GET', `/chat/list/${STF}?org_id=${ORG}`, { check: isList(5) });
  await call('GET', `/chat/search/${STF}?q=meera`, { check: isList(1) });
  await call('GET', `/chat/messages/${STF}/${ADM}`, { check: isList(3) });
  await call('POST', '/chat/send', { body: { sender_id: STF, receiver_id: ADM, message: 'hello' }, check: (j) => (j.message_id ? null : 'id') });
  const cf = new FormData(); cf.append('sender_id', STF); cf.append('receiver_id', ADM); cf.append('file', new Blob(['x'], { type: 'image/png' }), 'p.png');
  await call('POST', '/chat/send-file', { form: cf, check: (j) => (j.message_type === 'image' ? null : 'type') });
  await call('PUT', '/chat/mark-read', { body: { sender_id: ADM, receiver_id: STF }, check: isOk });
  await call('GET', `/group-chat/list/${STF}?org_id=${ORG}`, { check: isList(2) });
  await call('GET', '/group-chat/messages/grp-1?user_id=' + STF, { check: isList(3) });
  await call('POST', '/group-chat/send', { body: { group_id: 'grp-1', sender_id: STF, message: 'hi all' }, check: (j) => (j.message_id ? null : 'id') });
  await call('POST', '/group-chat/send', { body: { group_id: 'grp-2', sender_id: 'stf-0020', message: 'x' }, expect: 403 });
  await call('GET', '/group-chat/members/grp-2', { check: isList(3) });
  const g = await call('POST', '/group-chat/create', { body: { group_name: 'Selfcheck', created_by: STF, member_ids: [STF, ADM], org_id: ORG }, check: (j) => (j.group_id ? null : 'id') });
  await call('POST', '/group-chat/add-members', { body: { group_id: g.group_id, member_ids: ['stf-0003'] }, check: isOk });
  await call('PUT', '/group-chat/mark-read', { body: { group_id: 'grp-1', user_id: STF }, check: isOk });
  await call('GET', `/api/announcements/${ORG}`, { check: isList(4) });
  await call('GET', `/api/announcements/employee/${STF}`, { check: isList(2) });
  const an = await call('POST', '/api/announcements', { body: { org_id: ORG, sent_by_id: ADM, title: 't', message: 'm', target: 'branch', branch_id: 101 }, check: (j) => (j.recipient_count > 0 ? null : 'rc') });
  await call('POST', '/api/announcements', { body: { org_id: ORG, sent_by_id: STF, title: 't', message: 'm', target: 'all' }, expect: 403 });
  await call('DELETE', `/api/announcements/${an.announcement_id}`, { check: isOk });

  // crm
  await call('GET', `/api/leads/${ORG}`, { check: isList(12) });
  await call('GET', `/api/leads/employee/${ORG}/${STF}`, { check: isList(1) });
  await call('GET', `/api/leads/categories/${ORG}`, { check: isList(4) });
  const lead = await call('POST', '/api/leads/create', { body: { org_id: ORG, name: 'Selfcheck Co', mobile: '9222222222', address: 'a', category: 'General', remarks: '', required_date: null }, check: (j) => (j.leads_id ? null : 'id') });
  await call('PUT', `/api/leads/${lead.leads_id}`, { body: { org_id: ORG, name: 'Selfcheck Co 2', mobile: '9222222222', address: 'a', category: 'General', remarks: '', required_date: null }, check: isOk });
  await call('POST', `/api/leads/assign?leads_id=${lead.leads_id}&org_id=${ORG}&user_id=${STF}`, { check: isOk });
  await call('PUT', `/api/leads/assignment/${lead.leads_id}?user_id=stf-0003`, { check: isOk });
  await call('PUT', `/api/leads/${lead.leads_id}/work-status?work_status=working&user_id=stf-0003`, { check: isOk });
  await call('PUT', `/api/leads/${lead.leads_id}/status?status=contacted`, { check: isOk });
  const cat = await call('POST', `/api/leads/categories?org_id=${ORG}&category_name=Selfcheck`, { check: (j) => (j.category_id ? null : 'id') });
  await call('DELETE', `/api/leads/categories/${cat.category_id}`, { check: isOk });
  await call('GET', `/api/leads/carry-forward/requests/${ORG}`, { check: isList(2) });
  await call('GET', `/api/leads/carry-forward/my/${ORG}/stf-0003`, { check: isList(1) });
  const cf1 = await call('POST', `/api/leads/carry-forward/request?leads_id=lead-004&org_id=${ORG}&user_id=${STF}&description=later`, { check: (j) => (j.request_id ? null : 'id') });
  await call('PUT', `/api/leads/carry-forward/${cf1.request_id}/action?action=approved&admin_id=${ADM}`, { check: isOk });
  await call('DELETE', `/api/leads/${lead.leads_id}`, { check: isOk });

  // payroll
  await call('GET', `/api/salary/templates/${ORG}`, { check: isList(2) });
  const ps = await call('POST', '/api/salary/template', { body: { payslip_name: 'Selfcheck', org_id: ORG, basic_pay: 1000, hra: 100, epf: 10, professional_tax: 1, health_insurance: 1, custom_earnings: [], custom_deductions: [] }, check: (j) => (j.pay_slip_id ? null : 'id') });
  await call('GET', `/api/salary/template/${ps.pay_slip_id}`, { check: isOk });
  await call('PUT', `/api/salary/template/${ps.pay_slip_id}`, { body: { payslip_name: 'Selfcheck 2', org_id: ORG, basic_pay: 2000, hra: 100, epf: 10, professional_tax: 1, health_insurance: 1 }, check: isOk });
  await call('GET', `/api/salary/branches/${ORG}`, { check: isList(2) });
  await call('GET', `/api/salary/departments/${ORG}`, { check: isList(3) });
  await call('GET', `/api/salary/staff/${ORG}?pay_slip_id=ps-1`, { check: isList(10) });
  await call('POST', '/api/salary/assign', { body: { org_id: ORG, staff_id: 'stf-0020', pay_slip_id: ps.pay_slip_id }, check: isOk });
  await call('POST', '/api/salary/assign', { body: { org_id: ORG, staff_id: 'stf-0020', pay_slip_id: 'ps-1' }, check: isBiz });
  await call('GET', `/api/salary/employee/${ORG}/stf-0020`, { check: isOk });
  await call('GET', `/api/salary/preview/${ORG}/stf-0020/${ps.pay_slip_id}`, { check: (j) => (j.net_pay > 0 ? null : 'net') });
  await call('DELETE', `/api/salary/template/${ps.pay_slip_id}`, { check: isOk });
  for (const [base, kind] of [['/api/daily-wages', 'daily'], ['/api/hourly-charges', 'hourly']]) {
    await call('GET', `${base}/templates/${ORG}`, { check: isList(1) });
    const w = await call('POST', `${base}/template`, { body: { org_id: ORG, amount: 777 }, check: (j) => (j.id ? null : 'id') });
    await call('PUT', `${base}/template/${w.id}`, { body: { org_id: ORG, amount: 778 }, check: isOk });
    await call('GET', `/api/wages/unassigned/${ORG}/${w.id}`, { check: isList(1) });
    await call('POST', '/api/wages/assign', { body: { org_id: ORG, user_ids: ['stf-0020'], temp_id: w.id }, check: isOk });
    await call('GET', `/api/wages/assigned/${ORG}/${w.id}`, { check: isList(1) });
    await call('DELETE', `/api/wages/unassign/${ORG}/stf-0020/${w.id}`, { check: isOk });
    await call('DELETE', `${base}/template/${w.id}`, { check: isOk });
    void kind;
  }
  for (const kind of ['count', 'turnover', 'overtime', 'bonus']) {
    await call('GET', `/api/incentive/${kind}/${ORG}`, { check: isList(1) });
  }
  await call('GET', '/api/incentive/count/details/inc-c1', { check: isList(1) });
  const ic = await call('POST', '/api/incentive/count', { body: { org_id: ORG, template_name: '2', count_upto: 10, next_count: 2, each_incentive: 50 }, check: (j) => (j.incentive_id ? null : 'id') });
  await call('PUT', `/api/incentive/count/${ic.incentive_id}`, { body: { count_upto: 11, next_count: 2, each_incentive: 50 }, check: isOk });
  await call('POST', '/api/incentive/turnover', { body: { org_id: ORG, template_name: '2', turnover_upto: 1000, incentive_percent: 3 }, check: isOk });
  await call('POST', '/api/incentive/overtime', { body: { org_id: ORG, template_name: '2', duration_minutes: 30, amount: 100 }, check: isOk });
  await call('POST', '/api/incentive/bonus', { body: { org_id: ORG, template_name: '2', bonus_percent: 5, month: 'October', year: 2026 }, check: isOk });
  await call('GET', `/api/incentive/unassigned-all/${ORG}`, { check: isList(1) });
  await call('GET', `/api/incentive/unassigned/${ORG}/${ic.incentive_id}`, { check: isList(1) });
  await call('POST', '/api/incentive/assign', { body: { org_id: ORG, user_ids: ['stf-0020'], incentive_id: ic.incentive_id }, check: isOk });
  await call('GET', `/api/incentive/assigned/${ORG}/${ic.incentive_id}`, { check: isList(1) });
  await call('DELETE', `/api/incentive/unassign/${ORG}/stf-0020/${ic.incentive_id}`, { check: isOk });
  await call('DELETE', `/api/incentive/count/${ic.incentive_id}`, { check: isOk });

  // reports / salary
  for (const p of [`/api/reports/monthly-attendance-all/${ORG}/${ym}`, `/api/reports/monthly-attendance/${STF}/${ym}`, `/api/reports/manager/${MGR}/monthly-attendance-all/${ym}`, `/api/reports/manager/${MGR}/monthly-attendance/${STF}/${ym}`]) {
    const res = await fetch(BASE + p);
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.status !== 200 || !buf.slice(0, 5).toString().startsWith('%PDF')) { failures += 1; console.log(`FAIL GET ${p} -> not a pdf (${res.status})`); }
  }
  await call('GET', `/api/incentive/overtime-report/${ORG}?month=${month}&year=${year}`, { check: isList(1) });
  await call('GET', `/api/salary/staff-breakdown?org_id=${ORG}&month=${month}&year=${year}`, { check: isList(10) });
  await call('GET', `/salary/monthly-list?org_id=${ORG}&month=${month}&year=${year}`, { check: isList(10) });
  await call('POST', '/salary/mark-paid', { body: { org_id: ORG, user_ids: [STF], month, year }, check: isOk });
  await call('GET', `/salary/monthly-list?org_id=${ORG}&month=${month}&year=${year}`, { check: (j) => (j.data.find((r) => r.user_id === STF).paid ? null : 'paid') });
  await call('GET', `/api/advance/org/${ORG}`, { check: isList(3) });
  await call('GET', `/api/advance/user/stf-0003/${ORG}`, { check: isList(1) });
  const adv = await call('POST', '/api/advance', { body: { org_id: ORG, user_id: STF, created_by: ADM, advance_amt: 100, date: today }, check: isOk });
  await call('DELETE', `/api/advance/${adv.data.id}/${ORG}`, { check: isOk });

  // billing / support / misc
  await call('GET', `/plans/plan-status/${ORG}`, { check: (j) => (j.plan_id === 3 ? null : 'plan') });
  await call('GET', `/plans/subscription/${ORG}`, { check: (j) => (j.data.staff_limit === 50 ? null : 'limit') });
  await call('GET', '/plans/get_plans', { check: isList(3) });
  await call('GET', '/plans/coupon/first', { check: (j) => (j.coupon_name ? null : 'coupon') });
  await call('GET', '/plans/coupon/validate?coupon_name=NOPE', { check: isBiz });
  await call('GET', `/orders/check_first_payment?user_id=${ADM}`, { check: (j) => (j.is_first_payment === false ? null : 'first') });
  // POST /orders/quote: renewal = 12 months of the current tier (Elite 2999) for 10 staff + 18 % GST; money as numbers in rupees
  await call('POST', '/orders/quote', { body: { user_id: ADM, org_id: ORG, staff_limit: 10, mode: 'renew' }, check: (j) => {
    const q = j.data;
    if (!j.success || q.mode !== 'renew' || q.staff_charge !== 359880 || q.gst !== 64778 || q.grand_total !== 424658) return `renew quote ${JSON.stringify(q).slice(0, 200)}`;
    return q.amount_paise === 42465800 && q.payable === true && typeof q.grand_total === 'number' ? null : 'quote amount_paise / types';
  } });
  await call('POST', '/orders/quote', { body: { user_id: ADM, org_id: ORG, plan_id: 2, staff_limit: 50, coupon_code: 'welcome10' }, check: (j) => {
    const q = j.data; // new plan, credit = 10 x Elite 2999 x 1 month = 29990, coupon 10 % of the rest
    const rest = 50 * 1999 - 29990;
    const disc = Math.round(rest * 0.1);
    return q.mode === 'new' && q.credit === 29990 && q.coupon_applied === true && q.discount_amount === disc && q.grand_total === (rest - disc) + Math.round((rest - disc) * 0.18) ? null : `new quote ${JSON.stringify(q).slice(0, 200)}`;
  } });
  // flat / capped / minimum-amount coupon rules (set through the control endpoint, restored right after)
  await call('POST', '/__test/state', { body: { coupon: { discount: 0, discount_type: 'flat', flat_amount: 500, max_discount: null, min_amount: null } } });
  await call('POST', '/orders/quote', { body: { user_id: ADM, org_id: ORG, plan_id: 2, staff_limit: 50, coupon_code: 'welcome10' }, check: (j) => {
    const q = j.data;
    const rest = 50 * 1999 - 29990 - 500;
    return q.coupon_applied === true && q.discount_percent === null && q.discount_amount === 500 && q.grand_total === rest + Math.round(rest * 0.18) ? null : `flat quote ${JSON.stringify(q).slice(0, 200)}`;
  } });
  await call('POST', '/__test/state', { body: { coupon: { discount: 10, discount_type: 'percent', flat_amount: null, max_discount: 100, min_amount: 10000000 } } });
  await call('POST', '/orders/quote', { body: { user_id: ADM, org_id: ORG, plan_id: 2, staff_limit: 50, coupon_code: 'welcome10' }, check: (j) => (j.data.coupon_applied === false && /minimum order/.test(j.data.coupon_message || '') && j.data.discount_amount === 0 ? null : `min-amount quote ${JSON.stringify(j.data).slice(0, 200)}`) });
  await call('POST', '/__test/state', { body: { coupon: { discount: 10, discount_type: 'percent', flat_amount: null, max_discount: 100, min_amount: null } } });
  await call('POST', '/orders/quote', { body: { user_id: ADM, org_id: ORG, plan_id: 2, staff_limit: 50, coupon_code: 'welcome10' }, check: (j) => (j.data.coupon_applied === true && j.data.discount_percent === 10 && j.data.discount_amount === 100 ? null : `capped quote ${JSON.stringify(j.data).slice(0, 200)}`) });
  await call('POST', '/__test/state', { body: { coupon: { max_discount: null, min_amount: null, discount_type: 'percent' } } });
  await call('POST', '/orders/quote', { body: { user_id: ADM, org_id: ORG, plan_id: 2, staff_limit: 50, mode: 'bogus' }, expect: 400 });
  await call('POST', '/orders/create', { body: { user_id: ADM, org_id: ORG, plan_id: 2, amount: 1000, staff_limit: 30, mode: 'bogus' }, expect: 400 });
  const od = await call('POST', '/orders/create', { body: { user_id: ADM, org_id: ORG, plan_id: 2, amount: 1000, staff_limit: 30, coupon_code: null, mode: 'new' }, check: (j) => (j.checkout.order_id && j.amount === 1000 && j.checkout.amount === 1000 ? null : 'order (amount is in rupees)') });
  await call('POST', '/payments/verify', { body: { user_id: ADM, email: 'a@b.test', razorpay_order_id: od.order_id, razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' }, check: isOk });
  await call('GET', `/plans/plan-status/${ORG}`, { check: (j) => (j.plan_id === 2 ? null : 'plan after purchase') });
  await call('GET', `/invoice/history?user_id=${ADM}&org_id=${ORG}`, { check: isList(3) });
  const inv = await fetch(`${BASE}/invoice/download?user_id=${ADM}&org_id=${ORG}&invoice_number=INV-2026-0001`);
  if (inv.status !== 200) { failures += 1; console.log('FAIL invoice download'); }
  await call('GET', '/support/subjects', { check: isList(3) });
  await call('GET', '/support/videos', { check: isList(2) }); // only the active ones
  await call('POST', '/support/videos/1/view', { body: { user_id: ADM, org_id: ORG }, check: isOk });
  await call('GET', `/support/requests/${ORG}`, { check: isList(2) });
  const sf = new FormData(); sf.append('subject', 'Other'); sf.append('message', 'help'); sf.append('user_id', ADM); sf.append('org_id', ORG);
  await call('POST', '/support/submit', { form: sf, check: isOk });
  await call('POST', '/support/tkt-1/reply', { body: { reply_text: 'thanks', author_name: 'Anita', is_admin: false }, check: isOk });
  await call('GET', '/version/check?platform=android&version=1.0.0', { check: (j) => (j.update_required === false ? null : 'ver') });
  await call('POST', '/company/suggest-feature', { body: { org_id: ORG, subject: 's', content: 'c', company_name: 'x', user_email: 'a@b.test' }, check: isOk });
  await call('POST', `/company/request-deletion/${ADM}`, { check: isOk });
  await call('POST', '/attribution/meta', { body: { user_id: ADM, source: 'organic' }, check: isOk });

  // plan gating
  await call('POST', '/__test/state', { body: { plan: 'expired' } });
  await call('GET', `/api/leads/${ORG}`, { expect: 403 });
  await call('GET', `/chat/list/${STF}?org_id=${ORG}`, { expect: 500, check: (j) => (String(j.detail).startsWith('403:') ? null : 'wrapped') });
  await call('GET', `/staff-location/locations?org_id=${ORG}`, { expect: 403 });
  await call('GET', `/api/salary/staff-breakdown?org_id=${ORG}&month=${month}&year=${year}`, { expect: 403 });
  await call('POST', '/__test/state', { body: { plan: 'trial' } });
  await call('GET', `/plans/plan-status/${ORG}`, { check: (j) => (j.is_free_trial && j.plan_id === null ? null : 'trial') });
  await call('GET', `/api/leads/${ORG}`, { check: isOk });
  await call('POST', '/__test/state', { body: { failNext: { path: '/home/branches', status: 503 } } });
  await call('GET', `/home/branches?org_id=${ORG}`, { expect: 503 });
  await call('GET', `/home/branches?org_id=${ORG}`, { check: isList(2) });
  await call('GET', '/__test/requests?path=/home/branches', { check: isList(2) });

  await call('POST', '/__test/reset', { body: {} });
  console.log(failures ? `\n${failures} check(s) failed` : '\nmock-server selfcheck: all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
