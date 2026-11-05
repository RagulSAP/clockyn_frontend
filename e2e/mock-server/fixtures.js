'use strict';
/**
 * Stable fixture identifiers shared by the mock backend and the Playwright helpers.
 * Everything else (rows, counts) is seeded in state.js and can be inspected through `GET /__test/fixtures`.
 */

const OTP = '123456';

const ORG = { id: 'org-0001', name: 'Acme Traders' };

/** Sign-in identities. `mobile` is what the login screens take; ids are what the API and the session use. */
const USERS = {
  admin: { userId: 'adm-0001', mobile: '9000000001', name: 'Anita Desai', roleId: 1, email: 'anita.desai@clockyn.test', deviceToken: null },
  manager: { userId: 'mgr-0001', mobile: '9000000002', name: 'Meera Iyer', roleId: 2, email: 'meera.iyer@clockyn.test', deviceToken: 'devtok-mgr-0001' },
  staff: { userId: 'stf-0001', mobile: '9000000003', name: 'Aarav Sharma', roleId: 3, email: 'aarav.sharma@clockyn.test', deviceToken: 'devtok-stf-0001' },
  /** Field staff (location tracking + odometer), already punched in today. */
  fieldStaff: { userId: 'stf-0002', mobile: '9000000004', name: 'Bhavna Rao', roleId: 3, email: 'bhavna.rao@clockyn.test', deviceToken: 'devtok-stf-0002' },
};

const MANAGER_PERMISSIONS = [
  'Staff Management',
  'Branch Management',
  'Attendance Reports',
  'Salary Management',
  'Holiday Management',
  'Shift Management',
  'Leads Management',
  'Incentive Management',
  'Company Settings',
  'Requests Management',
];

const BRANCHES = {
  hq: { id: '101', name: 'Head Office', address: '12 MG Road, Bengaluru', latitude: 12.9716, longitude: 77.5946, radius: 150 },
  warehouse: { id: '102', name: 'Warehouse', address: '48 Hosur Road, Bengaluru', latitude: 12.9352, longitude: 77.6245, radius: 200 },
};

const DEPARTMENTS = {
  sales: { id: 'dept-101', name: 'Sales' },
  operations: { id: 'dept-102', name: 'Operations' },
  engineering: { id: 'dept-103', name: 'Engineering' },
};

const SHIFTS = {
  general: { id: 1, name: 'General', start: '09:00', end: '18:00' },
  morning: { id: 2, name: 'Morning', start: '06:00', end: '14:00' },
  night: { id: 3, name: 'Night', start: '21:00', end: '06:00' },
};

/** Ids of seeded rows that screens need as route params. */
const IDS = {
  org: ORG.id,
  staffDetail: 'stf-0003', // active, on-time, today working (birthday opt-in: state { birthdays: [id] })
  inactiveStaff: 'stf-0005',
  managerUser: 'mgr-0001',
  payslipTemplate: 'ps-1',
  wageTemplate: 'dw-1',
  group: 'grp-1',
  lead: 'lead-001',
  leadAssignedToStaff: 'lead-004',
  pendingLeave: 'req-001',
  pendingPermission: 'req-101',
  pendingShift: 'req-201',
  pendingDevice: 'req-301',
  announcement: 'ann-1',
  supportTicket: 'tkt-1',
};

/** Where the browser is told it is (inside the Head Office geofence). */
const GEO = { latitude: BRANCHES.hq.latitude, longitude: BRANCHES.hq.longitude };

module.exports = { OTP, ORG, USERS, MANAGER_PERMISSIONS, BRANCHES, DEPARTMENTS, SHIFTS, IDS, GEO };
