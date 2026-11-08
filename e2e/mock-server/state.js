'use strict';
/**
 * In-memory, stateful fixture database of the mock backend. `createState()` builds a fresh, deterministic seed
 * (relative to the mock clock's "today"); `POST /__test/reset` simply replaces the live state with a new one.
 */
const F = require('./fixtures');
const T = require('./lib/time');

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLAN_CATALOGUE = [
  { plan_id: 1, plan_name: 'Core', plan_amount: 999, plan_month: 1 },
  { plan_id: 2, plan_name: 'Prime', plan_amount: 1999, plan_month: 1 },
  { plan_id: 3, plan_name: 'Elite', plan_amount: 2999, plan_month: 1 },
];

const STAFF_NAMES = [
  'Aarav Sharma', 'Bhavna Rao', 'Chirag Patel', 'Divya Nair', 'Esha Kapoor', 'Farhan Sheikh', 'Gauri Menon', 'Harish Kumar',
  'Isha Reddy', 'Jatin Malhotra', 'Kavya Pillai', 'Lakshmi Narayan', 'Manish Gupta', 'Neha Joshi', 'Omkar Patil', 'Pooja Singh',
  'Qadir Ali', 'Rhea Dsouza', 'Sandeep Yadav', 'Tanvi Bhatt', 'Uday Chawla', 'Varun Khanna', 'Wasim Akhtar',
];

/** Live "today" situation of staff 1..23 (index = staff number). */
const TODAY_PLAN = {
  1: { kind: 'absent' },
  2: { kind: 'working', sessions: [['09:02']] },
  3: { kind: 'working', sessions: [['08:55']] },
  4: { kind: 'working', sessions: [['09:48']] }, // late
  6: { kind: 'out', sessions: [['09:00', '17:30']] },
  7: { kind: 'out', sessions: [['09:40', '18:05']] }, // late
  8: { kind: 'working', sessions: [['09:00', '13:00'], ['14:00']] },
  9: { kind: 'absent' },
  10: { kind: 'working', sessions: [['09:10']] },
  12: { kind: 'working', sessions: [['09:00']] },
  13: { kind: 'working', sessions: [['10:05']] }, // late
  14: { kind: 'out', sessions: [['09:00', '18:00']] },
  15: { kind: 'absent' },
  16: { kind: 'leave' },
  17: { kind: 'working', sessions: [['08:58']] },
  18: { kind: 'out', sessions: [['09:05', '17:55']] },
  20: { kind: 'absent' },
  21: { kind: 'working', sessions: [['09:01']] },
  22: { kind: 'out', sessions: [['09:50', '18:10']] }, // late
  23: { kind: 'working', sessions: [['09:03']] },
};
const INACTIVE_STAFF = new Set([5, 11, 19]);
const FIELD_STAFF = new Set([2, 4, 6, 8, 10]);
const LATE_GRACE_MIN = 15;

function createState() {
  const todayStr = T.today();
  const rnd = prng(20260918);
  const s = {
    createdAt: T.isoNow(),
    seq: { user: 100, branch: 200, dept: 200, shift: 10, req: 1000, expense: 100, reading: 100, lead: 100, category: 100, msg: 1000, group: 10, ann: 10, payslip: 10, wage: 10, inc: 10, advance: 10, holiday: 10, ticket: 10, invoice: 10, order: 10, cfr: 10, org: 1 },
    flags: { plan: 'elite', latencyMs: 0, failNext: [], forceLogout: [], faceMismatch: false, otp: F.OTP, locationLogStatus: null, userAuth: 'otp', requireAuth: false },
    otp: {}, // contact -> { attempts }
    tokens: {}, // access_token -> { userId, revoked } (see lib/authz.js)
    orgs: [],
    users: [],
    branches: [],
    departments: [],
    shifts: [],
    att: {}, // userId -> date -> { sessions:[{in,out,in_photo,out_photo}], status, late, in_loc }
    holidays: [],
    weeklyOffs: [6],
    attendanceRule: { late_punch_in_count: 3, consider_as: 'Half Day' },
    requests: [],
    readings: [],
    expenses: [],
    allowanceRate: 8,
    locations: {}, // userId -> [{latitude,longitude,timestamp}]
    messages: [],
    // Live Chat (org admin <-> support): threads by org id { thread_id, status } and the messages of all threads
    liveChat: { threads: {}, messages: [], seq: 0 },
    groups: [],
    groupMessages: [],
    announcements: [],
    leads: [],
    categories: [],
    carryForward: [],
    payslips: [],
    payslipAssign: {}, // userId -> payslipId
    wageTemplates: [], // {id, kind:'daily'|'hourly', amount}
    wageAssign: {}, // wageTemplateId -> [userIds]
    incentives: [], // {id, kind, ...}
    incentiveAssign: {}, // incentiveId -> [userIds]
    advances: [],
    paid: {}, // `${month}-${year}` -> {userId: date}
    tickets: [],
    // Video Hub (GET /support/videos lists the active ones; POST /support/videos/:id/view logs a tap)
    videos: [
      { id: 1, video_name: 'Getting started', path: 'getting-started.mp4', status: 1 },
      { id: 2, video_name: 'Marking attendance with your face', path: 'mark-attendance.mp4', status: 1 },
      { id: 3, video_name: 'Retired walkthrough', path: 'retired.mp4', status: 0 },
    ],
    videoViews: [],
    subjects: [
      { sub_id: 1, sub_name: 'Login issue' },
      { sub_id: 2, sub_name: 'Billing and plans' },
      { sub_id: 3, sub_name: 'Attendance problem' },
      { sub_id: 4, sub_name: 'Other' },
    ],
    invoices: [],
    subscription: null,
    coupon: { coupon_id: 1, coupon_name: 'WELCOME10', discount: 10 },
    suggestions: [],
    deletionRequests: [],
    registered: [],
  };

  // ── organisation ──────────────────────────────────────────────────────────────────────────────
  s.orgs.push({
    org_id: F.ORG.id,
    org_name: F.ORG.name,
    org_address: '12 MG Road, Bengaluru, Karnataka 560001',
    org_gst: '29ABCDE1234F1Z5',
    gst_number: '29ABCDE1234F1Z5',
    parent_id: F.USERS.admin.userId,
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    pincode: 560001,
    mobile_number: F.USERS.admin.mobile,
    email: F.USERS.admin.email,
    pan_number: 'ABCDE1234F',
    company_website: 'https://acme.example.test',
    cin_number: 'U12345KA2020PTC123456',
    tan_number: 'BLRA12345B',
    msme_number: 'UDYAM-KR-03-0012345',
    business_category: 'Retail',
    logo_url: null,
    created_at: '2025-01-15T09:00:00',
  });

  // ── branches / departments / shifts ───────────────────────────────────────────────────────────
  for (const b of Object.values(F.BRANCHES)) {
    s.branches.push({ branch_id: b.id, branch_name: b.name, branch_address: b.address, org_id: F.ORG.id, branch_latitude: b.latitude, branch_longitude: b.longitude, punch_radius: b.radius });
  }
  for (const d of Object.values(F.DEPARTMENTS)) s.departments.push({ dept_id: d.id, dept_name: d.name, org_id: F.ORG.id });
  for (const sh of Object.values(F.SHIFTS)) s.shifts.push({ shift_id: sh.id, shift_name: sh.name, start_time: sh.start, end_time: sh.end, org_id: F.ORG.id, status: 1 });

  // ── users ─────────────────────────────────────────────────────────────────────────────────────
  const baseUser = (o) => ({
    org_id: F.ORG.id, status: 1, is_field_staff: 0, parent_id: null, device_token: null, push_token: null, photo_url: null, face_registered: false,
    gender: 'Male', dob: '1992-04-12', doj: '2023-06-01', address: '221B Residency Road, Bengaluru', emergency_contact_no: '9888800000', blood_group: 'B+',
    bank_name: 'HDFC Bank', bank_branch: 'MG Road', acc_no: '50100123456789', ifsc_code: 'HDFC0000123', father_name: 'Ramesh Kumar', marital_status: 'Single',
    aadhaar_no: '123412341234', pan_no: 'ABCPK1234D', uan_no: '100200300400', pf_no: 'KN/BLR/0012345', esi_no: '1234567890', created_at: '2025-02-01T10:00:00',
    manager_permissions: null, assignments: [], branch_id: F.BRANCHES.hq.id, dept_id: F.DEPARTMENTS.sales.id, shift_id: 1, ...o,
  });

  s.users.push(baseUser({ user_id: F.USERS.admin.userId, name: F.USERS.admin.name, emp_id: 'A1000', mobile_number: F.USERS.admin.mobile, email: F.USERS.admin.email, role_id: 1, branch_id: null, dept_id: null, shift_id: 0, gender: 'Female' }));

  const allPerms = Object.fromEntries(F.MANAGER_PERMISSIONS.map((p) => [p, true]));
  s.users.push(
    baseUser({
      user_id: 'mgr-0001', name: F.USERS.manager.name, emp_id: 'M2001', mobile_number: F.USERS.manager.mobile, email: F.USERS.manager.email, role_id: 2, gender: 'Female',
      device_token: F.USERS.manager.deviceToken, manager_permissions: { ...allPerms }, face_registered: true, shift_id: 1,
      assignments: [{ branch_id: F.BRANCHES.hq.id, dept_id: null }],
    }),
    baseUser({
      user_id: 'mgr-0002', name: 'Rahul Verma', emp_id: 'M2002', mobile_number: '9000000012', email: 'rahul.verma@clockyn.test', role_id: 2, branch_id: F.BRANCHES.warehouse.id,
      dept_id: F.DEPARTMENTS.operations.id, device_token: 'devtok-mgr-0002', manager_permissions: Object.fromEntries(F.MANAGER_PERMISSIONS.map((p) => [p, p === 'Requests Management'])),
      assignments: [{ branch_id: F.BRANCHES.warehouse.id, dept_id: F.DEPARTMENTS.operations.id }],
    }),
  );

  const deptIds = Object.values(F.DEPARTMENTS).map((d) => d.id);
  const branchIds = Object.values(F.BRANCHES).map((b) => b.id);
  for (let i = 1; i <= 23; i += 1) {
    const num = String(i).padStart(4, '0');
    const branch = branchIds[(i - 1) % 2];
    const named = {
      1: F.USERS.staff,
      2: F.USERS.fieldStaff,
    }[i];
    s.users.push(
      baseUser({
        user_id: `stf-${num}`,
        name: STAFF_NAMES[i - 1],
        emp_id: `E${1000 + i}`,
        mobile_number: named ? named.mobile : `90001${String(i).padStart(5, '0')}`,
        email: named ? named.email : `${STAFF_NAMES[i - 1].toLowerCase().replace(/[^a-z]+/g, '.')}@clockyn.test`,
        role_id: 3,
        status: INACTIVE_STAFF.has(i) ? 0 : 1,
        is_field_staff: FIELD_STAFF.has(i) ? 1 : 0,
        branch_id: branch,
        dept_id: deptIds[(i - 1) % 3],
        shift_id: i % 7 === 0 ? 2 : i % 11 === 0 ? 3 : 1,
        parent_id: branch === F.BRANCHES.hq.id ? 'mgr-0001' : 'mgr-0002',
        gender: i % 2 === 0 ? 'Female' : 'Male',
        device_token: named ? named.deviceToken : `devtok-stf-${num}`,
        face_registered: i !== 3 && i !== 9, // two staff still need to enrol their face
        doj: `202${3 + (i % 3)}-0${1 + (i % 9)}-15`,
        dob: `199${i % 10}-0${1 + (i % 9)}-1${i % 9}`,
      }),
    );
  }

  // ── attendance ────────────────────────────────────────────────────────────────────────────────
  const shiftOf = (u) => s.shifts.find((x) => x.shift_id === u.shift_id) || s.shifts[0];
  const setAtt = (userId, date, rec) => {
    (s.att[userId] = s.att[userId] || {})[date] = rec;
  };
  const branchOf = (u) => s.branches.find((b) => b.branch_id === u.branch_id) || s.branches[0];
  const locOf = (u) => ({ lat: Number(branchOf(u).branch_latitude) + (rnd() - 0.5) * 0.0004, lng: Number(branchOf(u).branch_longitude) + (rnd() - 0.5) * 0.0004 });
  const isLate = (u, inTime) => T.toMinutes(inTime) > T.toMinutes(shiftOf(u).start_time) + LATE_GRACE_MIN;

  const active = s.users.filter((u) => u.role_id !== 1 && u.status === 1);
  // history: previous 45 days, no Sundays
  for (const u of active) {
    for (let back = 1; back <= 45; back += 1) {
      const date = T.addDays(todayStr, -back);
      if (T.weekdayOf(date) === 0) continue;
      const r = rnd();
      const sh = shiftOf(u);
      if (r < 0.06) setAtt(u.user_id, date, { sessions: [], status: 'absent', late: false });
      else if (r < 0.1) setAtt(u.user_id, date, { sessions: [], status: 'leave', late: false });
      else {
        const lateMin = r < 0.2 ? 20 + Math.floor(rnd() * 40) : Math.floor(rnd() * 10);
        const inM = T.toMinutes(sh.start_time) + lateMin;
        const inT = `${T.pad(Math.floor(inM / 60) % 24)}:${T.pad(inM % 60)}`;
        const outM = T.toMinutes(sh.end_time) + Math.floor(rnd() * 20);
        const outT = `${T.pad(Math.floor(outM / 60) % 24)}:${T.pad(outM % 60)}`;
        const late = lateMin > LATE_GRACE_MIN;
        setAtt(u.user_id, date, { sessions: [{ in: inT, out: outT, in_photo: '/files/punch/in.png', out_photo: '/files/punch/out.png' }], status: late ? 'late' : 'present', late, in_loc: locOf(u) });
      }
    }
  }
  // today
  const stfNum = (u) => (u.user_id.startsWith('stf-') ? Number(u.user_id.slice(4)) : 0);
  for (const u of s.users.filter((x) => x.role_id !== 1 && x.status === 1)) {
    const plan = u.user_id === 'mgr-0001' ? { kind: 'working', sessions: [['08:50']] } : u.user_id === 'mgr-0002' ? { kind: 'out', sessions: [['09:00', '17:00']] } : TODAY_PLAN[stfNum(u)] || { kind: 'absent' };
    if (plan.kind === 'absent') continue;
    if (plan.kind === 'leave') {
      setAtt(u.user_id, todayStr, { sessions: [], status: 'leave', late: false });
      continue;
    }
    const sessions = plan.sessions.map(([i, o]) => ({ in: i, out: o || null, in_photo: '/files/punch/in.png', out_photo: o ? '/files/punch/out.png' : null }));
    const late = isLate(u, sessions[0].in);
    setAtt(u.user_id, todayStr, { sessions, status: late ? 'late' : 'present', late, in_loc: locOf(u) });
  }
  // field staff positions for today
  for (const u of s.users.filter((x) => x.is_field_staff === 1 && x.status === 1)) {
    const rec = s.att[u.user_id] && s.att[u.user_id][todayStr];
    if (!rec || !rec.sessions.length) continue;
    const b = branchOf(u);
    const pts = [];
    const base = T.now().getTime();
    for (let k = 0; k < 6; k += 1) {
      pts.push({ latitude: Number(b.branch_latitude) + k * 0.0011, longitude: Number(b.branch_longitude) + k * 0.0009, timestamp: new Date(base - (6 - k) * 20 * 60_000).toISOString() });
    }
    s.locations[u.user_id] = pts;
  }

  // ── holidays ──────────────────────────────────────────────────────────────────────────────────
  s.holidays.push(
    { id: 1, org_id: F.ORG.id, name: 'Founders Day', date: T.addDays(todayStr, 9), branch_name: null, dept_name: null, block_attendance: true },
    { id: 2, org_id: F.ORG.id, name: 'Warehouse Maintenance', date: T.addDays(todayStr, 12), branch_name: F.BRANCHES.warehouse.name, dept_name: null, block_attendance: false },
    { id: 3, org_id: F.ORG.id, name: 'Festival Holiday', date: T.addDays(todayStr, -20), branch_name: null, dept_name: null, block_attendance: true },
  );

  // ── requests ──────────────────────────────────────────────────────────────────────────────────
  const userById = (id) => s.users.find((u) => u.user_id === id);
  const reqBase = (id, type, userId, extra) => {
    const u = userById(userId);
    return {
      request_id: id, request_type: type, user_id: userId, org_id: F.ORG.id, staff_name: u.name, emp_id: u.emp_id, reason: 'Personal work', status: 'pending', dates: [], date_statuses: {},
      created_at: new Date(T.now().getTime() - 3_600_000 * (1 + (Number(id.slice(-2)) % 20))).toISOString(), action_by: null, action_by_name: null, action_at: null, profile_photo: null, ...extra,
    };
  };
  const leaveReq = (id, userId, dates, status, reason) => {
    const ds = {};
    for (const d of dates) ds[d] = { status, action_by: status === 'pending' ? null : F.USERS.admin.userId, action_at: status === 'pending' ? null : T.isoNow() };
    s.requests.push(reqBase(id, 'leave', userId, { dates, date_statuses: ds, status, reason: reason || 'Family function', action_by: status === 'pending' ? null : F.USERS.admin.userId, action_by_name: status === 'pending' ? null : F.USERS.admin.name }));
  };
  leaveReq('req-001', 'stf-0003', [T.addDays(todayStr, 3), T.addDays(todayStr, 4)], 'pending');
  leaveReq('req-002', 'stf-0007', [T.addDays(todayStr, 5)], 'pending', 'Medical appointment');
  leaveReq('req-003', 'stf-0009', [T.addDays(todayStr, -6)], 'approved');
  leaveReq('req-004', 'stf-0012', [T.addDays(todayStr, -9), T.addDays(todayStr, -8)], 'rejected');
  leaveReq('req-005', 'stf-0001', [T.addDays(todayStr, 10)], 'pending', 'Vacation');
  const permReq = (id, userId, date, st, en, status) =>
    s.requests.push(reqBase(id, 'permission', userId, { dates: [date], date_statuses: { [date]: { status, action_by: status === 'pending' ? null : F.USERS.admin.userId, action_at: status === 'pending' ? null : T.isoNow() } }, permission_date: date, permission_start_time: st, permission_end_time: en, status, reason: 'Bank work' }));
  permReq('req-101', 'stf-0004', T.addDays(todayStr, 1), '14:00', '16:00', 'pending');
  permReq('req-102', 'stf-0008', T.addDays(todayStr, 2), '10:00', '11:30', 'pending');
  permReq('req-103', 'stf-0010', T.addDays(todayStr, -3), '15:00', '17:00', 'approved');
  const shiftReq = (id, userId, date, from, to, status) =>
    s.requests.push(
      reqBase(id, 'shift_change', userId, {
        shift_change_date: date, requested_shift_id: to, current_shift_id: from,
        requested_shift_timing: `${T.fmtCompact12(s.shifts.find((x) => x.shift_id === to).start_time)} - ${T.fmtCompact12(s.shifts.find((x) => x.shift_id === to).end_time)}`,
        current_shift_timing: `${T.fmtCompact12(s.shifts.find((x) => x.shift_id === from).start_time)} - ${T.fmtCompact12(s.shifts.find((x) => x.shift_id === from).end_time)}`,
        status, dates: [date], reason: 'Childcare', action_by: status === 'pending' ? null : F.USERS.admin.userId,
      }),
    );
  shiftReq('req-201', 'stf-0013', T.addDays(todayStr, 2), 1, 2, 'pending');
  shiftReq('req-202', 'stf-0014', T.addDays(todayStr, 4), 1, 3, 'pending');
  shiftReq('req-203', 'stf-0015', T.addDays(todayStr, -5), 1, 2, 'approved');
  s.requests.push(reqBase('req-301', 'device_change', 'stf-0012', { reason: 'New phone' }));
  s.requests.push(reqBase('req-302', 'device_change', 'stf-0016', { reason: 'Lost phone', status: 'approved', action_by: F.USERS.admin.userId }));

  // ── expenses ──────────────────────────────────────────────────────────────────────────────────
  const field = ['stf-0002', 'stf-0004', 'stf-0006'];
  let rid = 1;
  for (const uid of field) {
    for (let back = 1; back <= 4; back += 1) {
      const startKm = 12000 + rid * 37;
      const dist = 20 + ((rid * 13) % 60);
      s.readings.push({
        readings_id: `odo-${String(rid).padStart(3, '0')}`, user_id: uid, org_id: F.ORG.id, user_name: userById(uid).name, reading_date: T.addDays(todayStr, -back),
        start_km: startKm, stop_km: startKm + dist, distance_km: dist, status: back === 1 ? 'pending' : back === 2 ? 'rejected' : 'approved',
        start_photo_url: '/files/odometer/start.png', stop_photo_url: '/files/odometer/stop.png', created_at: `${T.addDays(todayStr, -back)}T09:00:00`,
      });
      rid += 1;
    }
  }
  s.readings.push({ readings_id: 'odo-100', user_id: 'stf-0002', org_id: F.ORG.id, user_name: userById('stf-0002').name, reading_date: todayStr, start_km: 15200, stop_km: null, distance_km: null, status: 'pending', start_photo_url: '/files/odometer/start.png', stop_photo_url: null, created_at: `${todayStr}T09:05:00` });
  const expRows = [
    ['stf-0002', 'TRAVEL', 450, 'pending'], ['stf-0004', 'TRAVEL', 1200, 'approved'], ['stf-0006', 'TRAVEL', 300, 'rejected'], ['stf-0008', 'TRAVEL', 880, 'pending'],
    ['stf-0002', 'BILL', 560, 'pending'], ['stf-0004', 'BILL', 150, 'approved'], ['stf-0010', 'BILL', 2200, 'pending'], ['stf-0001', 'BILL', 99, 'rejected'], ['stf-0001', 'TRAVEL', 120, 'pending'],
  ];
  expRows.forEach(([uid, type, amount, status], i) => {
    const id = `exp-${String(i + 1).padStart(3, '0')}`;
    s.expenses.push({ expense_id: id, id, user_id: uid, org_id: F.ORG.id, user_name: userById(uid).name, expense_date: T.addDays(todayStr, -(i % 5)), expense_type: type, amount, status, photo_url: '/files/expense/receipt.png', created_at: `${T.addDays(todayStr, -(i % 5))}T11:00:00` });
  });

  // ── chat ──────────────────────────────────────────────────────────────────────────────────────
  const msg = (from, to, text, minsAgo, read) => {
    s.seq.msg += 1;
    s.messages.push({ message_id: `msg-${s.seq.msg}`, sender_id: from, receiver_id: to, message: text, message_type: 'text', file_url: null, timestamp: new Date(T.now().getTime() - minsAgo * 60_000).toISOString(), is_read: !!read, is_delivered: true, sender_name: userById(from).name });
  };
  msg('adm-0001', 'stf-0001', 'Good morning Aarav, please share the weekly report.', 240, true);
  msg('stf-0001', 'adm-0001', 'Sure, sending it by noon.', 230, true);
  msg('adm-0001', 'stf-0001', 'Thanks. Also check the new shift roster.', 120, false);
  msg('adm-0001', 'stf-0001', 'And update me on the Mysore lead.', 118, false);
  msg('mgr-0001', 'adm-0001', 'Team attendance looks good today.', 90, true);
  msg('adm-0001', 'mgr-0001', 'Great, keep it up.', 80, true);
  msg('stf-0001', 'stf-0003', 'Can you cover my desk at 3pm?', 60, true);
  msg('stf-0003', 'stf-0001', 'Yes, no problem.', 55, true);
  msg('mgr-0001', 'stf-0001', 'Please come to my cabin after lunch.', 30, false);

  const memberIds = s.users.filter((u) => u.status === 1 && u.role_id !== 1).map((u) => u.user_id);
  s.groups.push(
    { group_id: 'grp-1', group_name: 'All Hands', created_by: 'adm-0001', org_id: F.ORG.id, members: ['adm-0001', ...memberIds], created_at: T.isoNow(), read: {} },
    { group_id: 'grp-2', group_name: 'Sales Team', created_by: 'mgr-0001', org_id: F.ORG.id, members: ['adm-0001', 'mgr-0001', 'stf-0001', 'stf-0003', 'stf-0007'], created_at: T.isoNow(), read: {} },
  );
  const gmsg = (gid, from, text, minsAgo) => {
    s.seq.msg += 1;
    s.groupMessages.push({ message_id: `gmsg-${s.seq.msg}`, group_id: gid, sender_id: from, sender_name: userById(from).name, message: text, message_type: 'text', file_url: null, timestamp: new Date(T.now().getTime() - minsAgo * 60_000).toISOString(), read_by: [from] });
  };
  gmsg('grp-1', 'adm-0001', 'Welcome to the All Hands group.', 600);
  gmsg('grp-1', 'mgr-0001', 'Reminder: quarterly review on Friday.', 300);
  gmsg('grp-1', 'stf-0003', 'Noted, thanks!', 290);
  gmsg('grp-2', 'mgr-0001', 'Targets for this week are up on the board.', 200);
  gmsg('grp-2', 'stf-0001', 'Will review them tonight.', 190);

  // ── announcements ─────────────────────────────────────────────────────────────────────────────
  const ann = (id, title, message, target, extra) => s.announcements.push({ id, org_id: F.ORG.id, title, message, target, branch_id: null, dept_id: null, selected_user_ids: [], sent_by: 'adm-0001', created_at: new Date(T.now().getTime() - 86_400_000 * (s.announcements.length + 1)).toISOString(), ...extra });
  ann('ann-1', 'Office closed on Founders Day', 'The office will remain closed on Founders Day. Enjoy the break!', 'all', {});
  ann('ann-2', 'Sales review', 'Selected members: join the sales review at 4pm.', 'selected', { selected_user_ids: ['stf-0001', 'stf-0003'] });
  ann('ann-3', 'Head Office parking', 'Parking for Head Office moves to Basement 2.', 'branch', { branch_id: Number(F.BRANCHES.hq.id) });
  ann('ann-4', 'Engineering stand-up', 'Daily stand-up shifts to 10:15am for Engineering.', 'dept', { dept_id: F.DEPARTMENTS.engineering.id });

  // ── CRM ───────────────────────────────────────────────────────────────────────────────────────
  for (const n of ['General', 'Retail', 'Wholesale', 'Corporate']) {
    s.seq.category += 1;
    s.categories.push({ category_id: `cat-${s.seq.category}`, category_name: n, org_id: F.ORG.id });
  }
  const pipeline = ['new', 'new', 'new', 'contacted', 'contacted', 'contacted', 'interested', 'interested', 'converted', 'converted', 'not_interested', 'not_interested'];
  const work = [null, null, null, 'pending', 'working', 'completed', 'working', 'pending', 'completed', 'completed', 'carry_forward', 'pending'];
  const assignee = [null, null, null, 'stf-0001', 'stf-0001', 'stf-0003', 'mgr-0001', 'stf-0003', 'stf-0007', 'stf-0001', 'stf-0003', 'stf-0007'];
  pipeline.forEach((st, i) => {
    const id = `lead-${String(i + 1).padStart(3, '0')}`;
    const au = assignee[i];
    s.leads.push({
      leads_id: id, org_id: F.ORG.id, client_name: ['Sunrise Stores', 'Metro Mart', 'Blue Ocean Traders', 'Kiran Textiles', 'Pioneer Foods', 'Zenith Pharma', 'Orchid Hotels', 'Lotus Electronics', 'Prime Hardware', 'Skyline Realty', 'Green Valley Farms', 'Urban Cafe'][i],
      mobile_number: `98450${String(10000 + i * 137).slice(0, 5)}`, client_address: `${10 + i} Market Street, Bengaluru`, category_name: s.categories[i % 4].category_name, remarks: i % 2 ? 'Call back next week' : '',
      created_date: au ? todayStr : null, created_at: `${T.addDays(todayStr, -(i % 6))}T10:00:00`, assigned_user_id: au, assigned_user_name: au ? userById(au).name : null, work_status: au ? work[i] : null, assigned_at: au ? `${todayStr}T09:30:00` : null, lead_status: st,
    });
  });
  s.carryForward.push(
    { request_id: 'cfr-1', leads_id: 'lead-011', user_id: 'stf-0003', employee_name: userById('stf-0003').name, description: 'Client asked to meet next week', request_date: T.addDays(todayStr, 7), status: 'pending', created_at: T.isoNow(), client_name: 'Green Valley Farms', lead_date: todayStr, actioned_at: null },
    { request_id: 'cfr-2', leads_id: 'lead-009', user_id: 'stf-0007', employee_name: userById('stf-0007').name, description: 'Needs revised quote', request_date: T.addDays(todayStr, 3), status: 'approved', created_at: T.isoNow(), client_name: 'Prime Hardware', lead_date: todayStr, actioned_at: T.isoNow() },
  );

  // ── payroll ───────────────────────────────────────────────────────────────────────────────────
  s.payslips.push(
    { pay_slip_id: 'ps-1', payslip_name: 'Standard Monthly', org_id: F.ORG.id, basic_pay: 25000, hra: 10000, epf: 3000, professional_tax: 200, health_insurance: 500, custom_earnings: [{ name: 'Conveyance', amount: 1600 }], custom_deductions: [], created_at: T.isoNow() },
    { pay_slip_id: 'ps-2', payslip_name: 'Senior Monthly', org_id: F.ORG.id, basic_pay: 50000, hra: 20000, epf: 6000, professional_tax: 200, health_insurance: 1000, custom_earnings: [{ name: 'Special Allowance', amount: 5000 }], custom_deductions: [{ name: 'Loan EMI', amount: 2000 }], created_at: T.isoNow() },
  );
  [1, 2, 3, 4, 6].forEach((n) => { s.payslipAssign[`stf-${String(n).padStart(4, '0')}`] = 'ps-1'; });
  [7, 8, 9].forEach((n) => { s.payslipAssign[`stf-${String(n).padStart(4, '0')}`] = 'ps-2'; });
  s.wageTemplates.push({ id: 'dw-1', kind: 'daily', amount: 800 }, { id: 'dw-2', kind: 'daily', amount: 1000 }, { id: 'hc-1', kind: 'hourly', amount: 150 });
  s.wageAssign['dw-1'] = ['stf-0010', 'stf-0012'];
  s.wageAssign['dw-2'] = [];
  s.wageAssign['hc-1'] = ['stf-0013'];
  s.incentives.push(
    { incentive_id: 'inc-c1', kind: 'count', template_name: '1', count_upto_basic_salary: 20, next_count: 5, each_incentive: 100, created_at: T.isoNow() },
    { incentive_id: 'inc-t1', kind: 'turnover', template_name: '1', turnover_upto_basic_salary: 100000, after_target_incentive_percent: 2, created_at: T.isoNow() },
    { incentive_id: 'inc-o1', kind: 'overtime', template_name: '1', duration_minutes: 60, amount: 150, created_at: T.isoNow() },
    { incentive_id: 'inc-b1', kind: 'bonus', template_name: '1', bonus_percent: 10, month: 'October', year: 2026, created_at: T.isoNow() },
  );
  s.incentiveAssign['inc-c1'] = ['stf-0001', 'stf-0002'];
  s.incentiveAssign['inc-t1'] = ['stf-0003'];
  s.incentiveAssign['inc-o1'] = ['stf-0004', 'stf-0006'];
  s.incentiveAssign['inc-b1'] = ['stf-0007'];
  s.advances.push(
    { id: 'adv-1', org_id: F.ORG.id, user_id: 'stf-0003', advance_amt: 5000, date: T.addDays(todayStr, -10), created_by: 'adm-0001' },
    { id: 'adv-2', org_id: F.ORG.id, user_id: 'stf-0007', advance_amt: 2500, date: T.addDays(todayStr, -4), created_by: 'adm-0001' },
    { id: 'adv-3', org_id: F.ORG.id, user_id: 'stf-0001', advance_amt: 1000, date: T.addDays(todayStr, -2), created_by: 'adm-0001' },
  );

  // ── billing / support ─────────────────────────────────────────────────────────────────────────
  s.subscription = { plan_id: 3, start_date: T.addDays(todayStr, -60), end_date: T.addDays(todayStr, 120), staff_limit: 50, status: 'ACTIVE' };
  s.invoices.push(
    { invoice_number: 'INV-2026-0001', payment_date: `${T.addDays(todayStr, -60)}T10:00:00`, plan_name: 'Elite', staff_count: 50, total_amount: 3538.82, valid_till: T.addDays(todayStr, 120), user_id: 'adm-0001', org_id: F.ORG.id },
    { invoice_number: 'INV-2026-0002', payment_date: `${T.addDays(todayStr, -150)}T10:00:00`, plan_name: 'Prime', staff_count: 25, total_amount: 2358.82, valid_till: T.addDays(todayStr, -60), user_id: 'adm-0001', org_id: F.ORG.id },
  );
  s.tickets.push(
    { id: 'tkt-1', org_id: F.ORG.id, user_id: 'adm-0001', sub_id: 2, sub_name: 'Billing and plans', client_msg: 'Need a GST invoice for last month.', photo_url: null, status: 'in_progress', created_at: T.isoNow(), replies: [{ reply_text: 'We are on it.', author_name: 'Support', is_admin: true, created_at: T.isoNow() }] },
    { id: 'tkt-2', org_id: F.ORG.id, user_id: 'adm-0001', sub_id: 1, sub_name: 'Login issue', client_msg: 'OTP did not arrive once.', photo_url: null, status: 'resolved', created_at: T.isoNow(), replies: [] },
  );

  s.todayStr = todayStr;
  return s;
}

module.exports = { createState, PLAN_CATALOGUE, LATE_GRACE_MIN };
