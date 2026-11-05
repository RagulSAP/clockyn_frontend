import { mapDeviceVerifyResult, mapLoginResult, mapRegisterResult, mapVerifyOtpResult, toRegisterBody } from '../mappers/auth';
import { mapExpense, mapOdometerReading, odometerMode } from '../mappers/expenses';
import { mapLocationCheck, mapPunchResult } from '../mappers/face';
import { mapLocationPoint, mapLocationStats, mapPunchPin, mapStaffLocation } from '../mappers/location';

describe('auth mappers', () => {
  it('mapLoginResult (admin)', () => {
    const r = mapLoginResult({
      success: true,
      message: 'Login successful!',
      user_id: 'u1',
      email: 'a@b.c',
      org_name: 'Acme',
      org_id: 'o1',
      role_id: 1,
      org_logo: 'https://x/l.png',
      plan_id: 2,
      is_free_trial: false,
      free_trial_end: null,
      redirect: 'home',
    });
    expect(r).toMatchObject({
      userId: 'u1',
      orgId: 'o1',
      orgName: 'Acme',
      roleId: 1,
      planId: 2,
      isFreeTrial: false,
      freeTrialEnd: null,
      managerPermissions: [],
      orgLogo: 'https://x/l.png',
    });
  });

  it('mapLoginResult (manager) keeps permissions and the trial end date', () => {
    const r = mapLoginResult({
      user_id: 'u2',
      org_name: 'Acme',
      current_org_id: 'o1',
      role_id: '2',
      manager_permissions: ['Staff Management', '', 'Shift Management'],
      plan_id: null,
      is_free_trial: 1,
      free_trial_end: '2026-04-01T00:00:00',
    });
    expect(r).toMatchObject({
      orgId: 'o1',
      roleId: 2,
      planId: null,
      isFreeTrial: true,
      freeTrialEnd: '2026-04-01',
      managerPermissions: ['Staff Management', 'Shift Management'],
    });
  });

  it('mapLoginResult falls back to the user id as org id', () => {
    expect(mapLoginResult({ user_id: 'u9', role_id: 3 }).orgId).toBe('u9');
  });

  it('mapVerifyOtpResult', () => {
    expect(mapVerifyOtpResult({ success: true, message: 'ok', device_token: 'tok', user_exists: true, role_id: 3 })).toEqual({
      message: 'ok',
      deviceToken: 'tok',
      userExists: true,
      roleId: 3,
    });
    expect(mapVerifyOtpResult({ success: true, device_token: 't', user_exists: false, role_id: null }).roleId).toBeNull();
  });

  it('mapDeviceVerifyResult: success carries a session, failures carry flags', () => {
    const ok = mapDeviceVerifyResult({ success: true, skip_otp: true, user_id: 'u', org_id: 'o', org_name: 'A', role_id: 3 });
    expect(ok).toMatchObject({ success: true, skipOtp: true, userId: 'u', orgId: 'o' });
    expect(ok.session).toMatchObject({ userId: 'u', roleId: 3 });

    const mismatch = mapDeviceVerifyResult({ success: false, message: 'Other device', skip_otp: false, device_mismatch: true, user_id: 'u', org_id: 'o' });
    expect(mismatch).toMatchObject({ success: false, skipOtp: false, deviceMismatch: true, message: 'Other device' });
    expect(mismatch.session).toBeUndefined();

    expect(mapDeviceVerifyResult({ success: false, deleted: true })).toMatchObject({ deleted: true, inactive: false });
    expect(mapDeviceVerifyResult({ success: false, session_expired: true }).sessionExpired).toBe(true);
    expect(mapDeviceVerifyResult({ success: false, device_change_approved: true }).deviceChangeApproved).toBe(true);
  });

  it('mapRegisterResult', () => {
    expect(mapRegisterResult({ success: true, message: 'Registration successful!', user_id: 'u', org_id: 'o', org_name: 'A', role_id: 1 })).toMatchObject({
      userId: 'u',
      orgId: 'o',
      roleId: 1,
    });
  });

  it('toRegisterBody sends the GST in both fields the server model needs', () => {
    const body = toRegisterBody({
      name: ' Owner ',
      empId: '1',
      mobile: '9876543210',
      email: 'o@x.y',
      orgName: 'Acme',
      orgAddress: 'Rd',
      gst: '29ABCDE1234F1Z5',
      departments: ['General'],
      branches: ['Main Branch'],
      pincode: 560001,
      pan: '',
    });
    expect(body).toMatchObject({ name: 'Owner', org_gst: '29ABCDE1234F1Z5', gst_number: '29ABCDE1234F1Z5', pincode: 560001 });
    expect('pan_number' in body).toBe(false);
  });
});

describe('expenses mappers', () => {
  it('mapExpense (employee row)', () => {
    const e = mapExpense({
      id: 11,
      user_id: 'u',
      org_id: 'o',
      expense_id: 'x-1',
      expense_date: '2026-03-03',
      expense_type: 'TRAVEL',
      amount: '250.5',
      status: 'Approved',
      photo_url: null,
    });
    expect(e).toMatchObject({ id: '11', expenseId: 'x-1', date: '2026-03-03', type: 'travel', amount: 250.5, status: 'approved' });
    expect(e.photoUrl).toBeUndefined();
  });

  it('mapExpense (admin row) falls back between id and expense_id and defaults unknown status to pending', () => {
    const e = mapExpense({ id: 'abc', user_name: 'Asha', expense_type: 'bill', amount: 10, status: 'weird', expense_date: '2026-03-03T00:00:00' });
    expect(e).toMatchObject({ id: 'abc', expenseId: 'abc', userName: 'Asha', type: 'bill', status: 'pending', date: '2026-03-03' });
  });

  it('mapOdometerReading + odometerMode', () => {
    const open = mapOdometerReading({ id: 1, readings_id: 'r-1', reading_date: '2026-03-03', start_km: '1200', stop_km: null, status: 'pending' });
    expect(open).toMatchObject({ readingId: 'r-1', startKm: 1200 });
    expect(open.stopKm).toBeUndefined();
    expect(odometerMode(open)).toBe('stop');
    expect(odometerMode(undefined)).toBe('start');
    const done = mapOdometerReading({ reading_date: '2026-03-03', start_km: 10, stop_km: 25, distance_km: 15, allowance_rate: 8, user_name: 'A' });
    expect(done).toMatchObject({ distanceKm: 15, allowanceRate: 8, userName: 'A' });
    expect(odometerMode(done)).toBe('done');
  });
});

describe('face mappers', () => {
  it('mapLocationCheck', () => {
    expect(mapLocationCheck({ success: true, message: 'Location check passed' })).toEqual({ allowed: true, message: 'Location check passed' });
    expect(mapLocationCheck({ success: false, message: 'You are 250m away from your branch. Must be within 100m to punch.' }).allowed).toBe(false);
    expect(mapLocationCheck({ detail: 'bad' }).allowed).toBe(false);
  });

  it('mapPunchResult: success, mismatch, holiday', () => {
    expect(mapPunchResult({ success: true, message: 'Punched in successfully', time: '09:05 AM', attendance_id: 7, face_mismatch: false })).toMatchObject({
      success: true,
      time: '09:05',
      attendanceId: '7',
      faceMismatch: false,
      isHoliday: false,
    });
    expect(mapPunchResult({ success: true, time: '06:10 PM', work_hours: '8.5', total_work_hours: 8.5, face_mismatch: true })).toMatchObject({
      time: '18:10',
      workHours: 8.5,
      totalWorkHours: 8.5,
      faceMismatch: true,
    });
    expect(mapPunchResult({ success: false, message: 'Today is a holiday (Holi).', is_holiday: true })).toMatchObject({ success: false, isHoliday: true });
    expect(mapPunchResult({ success: false, message: 'Face not recognized' })).toMatchObject({ success: false, isHoliday: false, faceMismatch: false });
  });
});

describe('location mappers', () => {
  it('mapStaffLocation', () => {
    expect(
      mapStaffLocation({
        user_id: 'u',
        name: 'A',
        emp_id: 'E',
        branch_name: 'No Branch',
        dept_name: 'No Department',
        latitude: 12.9,
        longitude: '77.6',
        location_updated_at: '2026-03-03T05:00:00+00:00',
        punch_in: '09:00 AM',
        punch_out: null,
      }),
    ).toMatchObject({ latitude: 12.9, longitude: 77.6, updatedAt: '2026-03-03T05:00:00+00:00', punchIn: '09:00', branch: 'No Branch' });
    expect(mapStaffLocation({ user_id: 'u2' }).latitude).toBeUndefined();
  });

  it('mapLocationPoint drops points without coordinates', () => {
    expect(mapLocationPoint({ latitude: 1, longitude: 2, timestamp: '2026-03-03T05:00:00' })).toEqual({ latitude: 1, longitude: 2, timestamp: '2026-03-03T05:00:00' });
    expect(mapLocationPoint({ latitude: null, longitude: 2 })).toBeUndefined();
    expect(mapLocationPoint({ latitude: 0, longitude: 0, timestamp: 't' })).toBeDefined();
  });

  it('mapLocationStats / mapPunchPin', () => {
    expect(mapLocationStats({ success: true, data: { recent: 3, outdated: 1, no_location: 2, total: 6 }, date: '2026-03-03' })).toEqual({
      recent: 3,
      outdated: 1,
      noLocation: 2,
      total: 6,
      date: '2026-03-03',
    });
    const pin = mapPunchPin({ user_id: 'u', name: 'A', emp_id: 'E', branch_name: 'B', dept_name: 'D', punch_in: '09:00 AM', punch_in_lat: 12, punch_in_lng: 77, punch_out_lat: null, punch_out_lng: null });
    expect(pin).toMatchObject({ punchIn: '09:00', punchInLocation: { latitude: 12, longitude: 77 } });
    expect(pin.punchOutLocation).toBeUndefined();
  });
});
