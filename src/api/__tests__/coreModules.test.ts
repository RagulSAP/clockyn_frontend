/**
 * Request-building / error-handling checks of the core domain modules against a mocked HTTP client.
 * (Pure mapping is covered by the mapper tests.)
 */
import { ApiError } from '@/lib/api/errors';

import * as attendance from '../attendance';
import * as auth from '../auth';
import * as expenses from '../expenses';
import * as face from '../face';
import * as home from '../home';
import * as requests from '../requests';
import * as shifts from '../shifts';
import * as staff from '../staff';

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  upload: jest.fn(),
};

jest.mock('@/lib/api/client', () => ({
  api: {
    get: (...a: unknown[]) => mockApi.get(...a),
    post: (...a: unknown[]) => mockApi.post(...a),
    put: (...a: unknown[]) => mockApi.put(...a),
    delete: (...a: unknown[]) => mockApi.delete(...a),
    upload: (...a: unknown[]) => mockApi.upload(...a),
  },
  isApiError: (e: unknown) => e instanceof jest.requireActual('@/lib/api/errors').ApiError,
  ApiError: jest.requireActual('@/lib/api/errors').ApiError,
}));

beforeEach(() => {
  Object.values(mockApi).forEach((m) => m.mockReset());
});

describe('home', () => {
  it('sends the org id as user_id and IST date strings', async () => {
    mockApi.get.mockResolvedValue({ total_staff: 3, punched_in: 1, working: 1, punched_out: 0, absent: 2, late_punched_in: 0 });
    const stats = await home.getDashboardStats('org-1', { branchId: 'b1', date: '2026-03-05' });
    expect(mockApi.get).toHaveBeenCalledWith('/home/dashboard-status', { user_id: 'org-1', branch_id: 'b1', target_date: '2026-03-05' });
    expect(stats.totalStaff).toBe(3);
  });

  it('converts a Date to its IST calendar day (not the UTC day)', async () => {
    mockApi.get.mockResolvedValue({});
    // 2026-03-04T20:00:00Z is already 2026-03-05 01:30 in IST.
    await home.getDashboardStats('org-1', { date: new Date('2026-03-04T20:00:00Z') });
    expect(mockApi.get.mock.calls[0][1]).toMatchObject({ target_date: '2026-03-05' });
  });

  it('omits empty branch / date', async () => {
    mockApi.get.mockResolvedValue([]);
    await home.getStaffByStatus('absent', 'org-1', { branchId: '' });
    expect(mockApi.get).toHaveBeenCalledWith('/home/absent-staff', { user_id: 'org-1', branch_id: undefined, target_date: undefined });
  });

  it('getMonthlyAttendance surfaces failures instead of an empty month', async () => {
    mockApi.get.mockRejectedValue(new ApiError({ status: 500, message: 'boom' }));
    await expect(home.getMonthlyAttendance('s1', 'o1', 3, 2026)).rejects.toBeInstanceOf(ApiError);
  });

  it('updateAttendancePunch validates times and sends HH:mm', async () => {
    mockApi.put.mockResolvedValue({ success: true, message: 'Attendance updated successfully', work_hours: 8 });
    await home.updateAttendancePunch({ staffId: 's', orgId: 'o', date: '2026-03-05', punchIn: '9:00 AM', punchOut: '17:30' });
    expect(mockApi.put).toHaveBeenCalledWith('/home/update-attendance-punch', {
      staff_id: 's',
      org_id: 'o',
      date: '2026-03-05',
      punch_in: '09:00',
      punch_out: '17:30',
    });
    await expect(home.updateAttendancePunch({ staffId: 's', orgId: 'o', date: '2026-03-05', punchIn: 'nope' })).rejects.toThrow();
  });
});

describe('error surfacing', () => {
  it('verifyOtp throws the server message for {success:false}', async () => {
    mockApi.post.mockResolvedValue({ success: false, message: 'Invalid or expired login mobile OTP' });
    await expect(auth.verifyOtp({ contact: '9876543210', otp: '123456', purpose: 'login' })).rejects.toMatchObject({
      message: 'Invalid or expired login mobile OTP',
    });
  });

  it('verifyDeviceToken returns failure flags instead of throwing', async () => {
    mockApi.post.mockResolvedValue({ success: false, message: 'Mismatch', device_mismatch: true });
    await expect(auth.verifyDeviceToken({ contact: '98', deviceToken: 't' })).resolves.toMatchObject({ success: false, deviceMismatch: true });
  });

  it('login uses the portal-specific endpoint', async () => {
    mockApi.post.mockResolvedValue({ success: true, user_id: 'u', org_id: 'o', role_id: 3 });
    await auth.login('9876543210', 'employee');
    expect(mockApi.post).toHaveBeenCalledWith('/auth/employee-login', { login_id: '9876543210' });
    await auth.login('9876543210');
    expect(mockApi.post).toHaveBeenLastCalledWith('/auth/login', { login_id: '9876543210' });
  });

  it('write endpoints throw ApiError on success:false', async () => {
    mockApi.post.mockResolvedValue({ success: false, message: 'Request not found' });
    await expect(
      requests.updateRequestStatus({ requestId: 'r', status: 'approved', actionBy: 'a', roleId: 1 }),
    ).rejects.toMatchObject({ name: 'ApiError', message: 'Request not found' });
  });
});

describe('requests', () => {
  it('checkSession fails open for transport / HTTP errors only', async () => {
    mockApi.get.mockRejectedValueOnce(new ApiError({ status: 0, message: 'offline', isNetwork: true }));
    await expect(requests.checkSession('u', 't')).resolves.toEqual({ valid: true, forceLogout: false });
    mockApi.get.mockRejectedValueOnce(new ApiError({ status: 500, message: 'x' }));
    await expect(requests.checkSession('u', 't')).resolves.toEqual({ valid: true, forceLogout: false });
    mockApi.get.mockRejectedValueOnce(new Error('programming bug'));
    await expect(requests.checkSession('u', 't')).rejects.toThrow('programming bug');
    mockApi.get.mockResolvedValueOnce({ valid: false, force_logout: true, reason: 'device_change_approved' });
    await expect(requests.checkSession('u', 't')).resolves.toMatchObject({ forceLogout: true, reason: 'device_change_approved' });
  });

  it('submitPermission normalises times and checks them', async () => {
    mockApi.post.mockResolvedValue({ success: true, request_id: 'r1', message: 'ok' });
    const r = await requests.submitPermission({ userId: 'u', orgId: 'o', date: '2026-03-05', startTime: '10:00 AM', endTime: '12:00', reason: 'x' });
    expect(r).toEqual({ requestId: 'r1', message: 'ok' });
    expect(mockApi.post.mock.calls[0][1]).toMatchObject({ permission_date: '2026-03-05', start_time: '10:00', end_time: '12:00' });
    await expect(
      requests.submitPermission({ userId: 'u', orgId: 'o', date: '2026-03-05', startTime: 'x', endTime: '12:00', reason: 'x' }),
    ).rejects.toThrow();
  });

  it('getPendingCounts counts from the admin list and propagates errors', async () => {
    mockApi.get.mockResolvedValueOnce({
      success: true,
      data: [
        { request_id: '1', request_type: 'leave', status: null, dates: ['2026-03-01'], date_statuses: { '2026-03-01': { status: 'pending' } } },
        { request_id: '2', request_type: 'device_change', status: 'pending', dates: [] },
      ],
    });
    await expect(requests.getPendingCounts('o')).resolves.toEqual({ total: 2, leave: 1, permission: 0, shiftChange: 0, deviceChange: 1 });
    mockApi.get.mockRejectedValueOnce(new ApiError({ status: 500, message: 'x' }));
    await expect(requests.getPendingCounts('o')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('face', () => {
  it('check-location posts multipart form data (URLSearchParams has no Content-Type on React Native)', async () => {
    mockApi.post.mockResolvedValue({ success: false, message: 'You are 250m away' });
    const res = await face.checkPunchLocation({ userId: 'u', latitude: 12.5, longitude: 77.5 });
    expect(res).toEqual({ allowed: false, message: 'You are 250m away' });
    const [path, body] = mockApi.post.mock.calls[0];
    expect(path).toBe('/face/check-location');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('user_id')).toBe('u');
    expect((body as FormData).get('latitude')).toBe('12.5');
    expect((body as FormData).get('longitude')).toBe('77.5');
  });

  it('punch uploads the face with the v1 field names and force_accept only when asked', async () => {
    mockApi.upload.mockResolvedValue({ success: true, message: 'Punched in successfully', time: '09:00 AM', face_mismatch: false });
    const res = await face.punch({ userId: 'u', orgId: 'o', action: 'punch_in', faceUri: 'file:///f.jpg', latitude: 1, longitude: 2 });
    expect(res).toMatchObject({ success: true, time: '09:00' });
    const [path, input, opts] = mockApi.upload.mock.calls[0];
    expect(path).toBe('/face/punch');
    expect(input).toMatchObject({ fieldName: 'face', fileUri: 'file:///f.jpg', fields: { user_id: 'u', org_id: 'o', action: 'punch_in', latitude: 1, longitude: 2, force_accept: undefined } });
    expect(opts).toEqual({ timeoutMs: 30000 });

    await face.punch({ userId: 'u', orgId: 'o', action: 'punch_out', faceUri: 'x', forceAccept: true });
    expect(mockApi.upload.mock.calls[1][1].fields.force_accept).toBe('true');
  });

  it('punch resolves business failures (holiday) but rethrows HTTP errors', async () => {
    mockApi.upload.mockResolvedValueOnce({ success: false, message: 'Today is a holiday', is_holiday: true });
    await expect(face.punch({ userId: 'u', orgId: 'o', action: 'punch_in', faceUri: 'x' })).resolves.toMatchObject({ success: false, isHoliday: true });
    mockApi.upload.mockRejectedValueOnce(new ApiError({ status: 403, message: 'Your plan has expired.' }));
    await expect(face.punch({ userId: 'u', orgId: 'o', action: 'punch_in', faceUri: 'x' })).rejects.toMatchObject({ status: 403 });
  });

  it('registerFace needs at least 4 photos and sends them as repeated `faces`', async () => {
    await expect(face.registerFace({ userId: 'u', orgId: 'o', faceUris: ['a', 'b'] })).rejects.toThrow();
    mockApi.upload.mockResolvedValue({ success: true, message: 'Face registered' });
    await face.registerFace({ userId: 'u', orgId: 'o', faceUris: ['a', 'b', 'c', 'd'] });
    const input = mockApi.upload.mock.calls[0][1];
    expect(input.files).toHaveLength(4);
    expect(input.files[0]).toMatchObject({ fieldName: 'faces', fileName: 'face0.jpg' });
    expect(input.fields).toEqual({ user_id: 'u', org_id: 'o' });
  });
});

describe('shifts', () => {
  it('createShift sends compact 12h times', async () => {
    mockApi.post.mockResolvedValue({ success: true, message: 'Shift created successfully', shift_id: 9 });
    const res = await shifts.createShift({ orgId: 'o', name: 'Day', startTime: '09:30', endTime: '18:00' });
    expect(res).toEqual({ shiftId: 9, message: 'Shift created successfully' });
    expect(mockApi.post).toHaveBeenCalledWith('/shift/create', { org_id: 'o', shift_name: 'Day', start_time: '09:30AM', end_time: '06:00PM' });
  });

  it('listShifts maps the {success,data} envelope', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [{ shift_id: 1, shift_name: 'A', start_time: '09:00AM', end_time: '05:00PM', status: 1 }] });
    const list = await shifts.listShifts('o');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 1, startTime: '09:00', endTime: '17:00' });
  });

  it('getShift falls back to the list on an HTTP error when the org id is known', async () => {
    mockApi.get
      .mockRejectedValueOnce(new ApiError({ status: 404, message: 'Shift not found' }))
      .mockResolvedValueOnce({ success: true, data: [{ shift_id: 4, shift_name: 'N', start_time: '10:00PM', end_time: '06:00AM' }] });
    await expect(shifts.getShift(4, 'o')).resolves.toMatchObject({ id: 4, startTime: '22:00' });
    mockApi.get.mockRejectedValueOnce(new ApiError({ status: 404, message: 'Shift not found' }));
    await expect(shifts.getShift(4)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('staff', () => {
  it('getBranchOptions falls back to /home/branches on an HTTP error but not on a network error', async () => {
    mockApi.get
      .mockRejectedValueOnce(new ApiError({ status: 500, message: 'x' }))
      .mockResolvedValueOnce([{ branch_id: 3, branch_name: 'HQ', org_id: 'o' }]);
    await expect(staff.getBranchOptions('o', 1)).resolves.toEqual([{ id: '3', name: 'HQ' }]);
    mockApi.get.mockRejectedValueOnce(new ApiError({ status: 0, message: 'offline', isNetwork: true }));
    await expect(staff.getBranchOptions('o', 1)).rejects.toMatchObject({ isNetwork: true });
  });

  it('keeps the documented fail-soft defaults for next id / availability', async () => {
    mockApi.get.mockRejectedValueOnce(new ApiError({ status: 500, message: 'x' }));
    await expect(staff.getNextEmployeeId('o', 1)).resolves.toBe('1000');
    mockApi.get.mockResolvedValueOnce({ next_emp_id: 1005 });
    await expect(staff.getNextEmployeeId('o', 1)).resolves.toBe('1005');
    mockApi.get.mockRejectedValueOnce(new ApiError({ status: 500, message: 'x' }));
    await expect(staff.isEmployeeIdAvailable('o', 1, '1')).resolves.toBe(true);
    mockApi.get.mockResolvedValueOnce({ is_available: false });
    await expect(staff.isEmployeeIdAvailable('o', 1, '1')).resolves.toBe(false);
  });

  it('setStaffActive sends the status as a query parameter', async () => {
    mockApi.put.mockResolvedValue({ success: true, message: 'activated' });
    await staff.setStaffActive('u1', false);
    expect(mockApi.put).toHaveBeenCalledWith('/addstaff/u1/status', undefined, { query: { status: 0 } });
  });

  it('permanentlyDeleteStaff passes the asserted role id in the query', async () => {
    mockApi.delete.mockResolvedValue({ success: true, message: 'deleted' });
    await staff.permanentlyDeleteStaff('u1', 1);
    expect(mockApi.delete).toHaveBeenCalledWith('/addstaff/u1/permanent', { requested_by_role_id: 1 });
  });
});

describe('attendance & expenses', () => {
  it('getSessions requires a valid date', async () => {
    mockApi.get.mockResolvedValue({ success: true, sessions: [] });
    await attendance.getSessions('u', '2026-03-05');
    expect(mockApi.get).toHaveBeenCalledWith('/attendance/sessions/u', { date: '2026-03-05' });
    await expect(attendance.getSessions('u', 'not-a-date')).rejects.toThrow('Invalid date');
  });

  it('listMyExpenses upper-cases the type filter; submitExpense sends the lower-case type like v1', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] });
    await expenses.listMyExpenses('u', { type: 'travel' });
    expect(mockApi.get).toHaveBeenCalledWith('/expenses/travel-bill/expenses', { user_id: 'u', expense_type: 'TRAVEL', expense_date: undefined });
    mockApi.post.mockResolvedValue({ success: true, expense_id: 'e1' });
    await expect(expenses.submitExpense({ userId: 'u', date: '2026-03-05', type: 'bill', amount: 99 })).resolves.toMatchObject({ expenseId: 'e1' });
    expect(mockApi.post.mock.calls[0][1]).toEqual({ user_id: 'u', expense_date: '2026-03-05', expense_type: 'bill', amount: 99 });
  });

  it('setAllowanceRate sends a whole number and rejects values below 1', async () => {
    mockApi.post.mockResolvedValue({ success: true, message: 'saved' });
    await expenses.setAllowanceRate('o', 7.6);
    expect(mockApi.post).toHaveBeenCalledWith('/expenses/admin/allowance-rate', { org_id: 'o', rate: 8 });
    await expect(expenses.setAllowanceRate('o', 0.2)).rejects.toThrow();
    await expect(expenses.setAllowanceRate('o', Number.NaN)).rejects.toThrow();
  });

  it('uploadOdometerPhoto puts the ids in the query and the file in the `file` field', async () => {
    mockApi.upload.mockResolvedValue({ success: true });
    await expenses.uploadOdometerPhoto({ userId: 'u', date: '2026-03-05', photoType: 'start', file: { uri: 'file:///p.jpg', mimeType: 'image/jpeg', fileName: 'p.jpg' } });
    const [path, input, opts] = mockApi.upload.mock.calls[0];
    expect(path).toBe('/expenses/odometer/upload-photo');
    expect(input).toMatchObject({ fieldName: 'file', fileUri: 'file:///p.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg' });
    expect(opts).toEqual({ query: { user_id: 'u', reading_date: '2026-03-05', photo_type: 'start' } });
  });
});

describe('auth config (sign-in mode)', () => {
  it('reads user_auth from GET /auth/config', async () => {
    mockApi.get.mockResolvedValue({ success: true, user_auth: 'email' });
    await expect(auth.getAuthMode()).resolves.toBe('email');
    expect(mockApi.get).toHaveBeenCalledWith('/auth/config');
    mockApi.get.mockResolvedValue({ success: true, user_auth: 'otp' });
    await expect(auth.getAuthMode()).resolves.toBe('otp');
  });

  it('falls back to the original mobile + SMS sign-in when the server has no such route or fails', async () => {
    mockApi.get.mockRejectedValue(new ApiError({ status: 404, detail: 'Not Found' }));
    await expect(auth.getAuthMode()).resolves.toBe('otp');
    mockApi.get.mockResolvedValue({ success: true });
    await expect(auth.getAuthMode()).resolves.toBe('otp');
  });
});
