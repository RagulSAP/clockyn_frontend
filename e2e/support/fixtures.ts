/**
 * Typed view of the mock backend's stable fixtures (single source of truth: e2e/mock-server/fixtures.js).
 * Rows beyond these ids come from `mock.fixtures()` (live snapshot of the worker's tenant).
 */
const raw = require('../mock-server/fixtures.js');

export type Role = 'admin' | 'manager' | 'staff' | 'fieldStaff';

export interface FixtureUser {
  userId: string;
  mobile: string;
  name: string;
  roleId: 1 | 2 | 3;
  email: string;
  /** Trusted-device token the mock accepts for this user (null for the admin). */
  deviceToken: string | null;
}

export const OTP: string = raw.OTP;
export const ORG: { id: string; name: string } = raw.ORG;
export const USERS: Record<Role, FixtureUser> = raw.USERS;
export const MANAGER_PERMISSIONS: string[] = raw.MANAGER_PERMISSIONS;
export const BRANCHES: Record<'hq' | 'warehouse', { id: string; name: string; address: string; latitude: number; longitude: number; radius: number }> = raw.BRANCHES;
export const DEPARTMENTS: Record<'sales' | 'operations' | 'engineering', { id: string; name: string }> = raw.DEPARTMENTS;
export const SHIFTS: Record<'general' | 'morning' | 'night', { id: number; name: string; start: string; end: string }> = raw.SHIFTS;
export const IDS: {
  org: string;
  staffDetail: string;
  inactiveStaff: string;
  managerUser: string;
  payslipTemplate: string;
  wageTemplate: string;
  group: string;
  lead: string;
  leadAssignedToStaff: string;
  pendingLeave: string;
  pendingPermission: string;
  pendingShift: string;
  pendingDevice: string;
  announcement: string;
  supportTicket: string;
} = raw.IDS;
export const GEO: { latitude: number; longitude: number } = raw.GEO;

/** Plan states accepted by `mock.setPlan` / `POST /__test/state { plan }`. */
export type PlanState = 'elite' | 'prime' | 'core' | 'trial' | 'expired' | 'none';
