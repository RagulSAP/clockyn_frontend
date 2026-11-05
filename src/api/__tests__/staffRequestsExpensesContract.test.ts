/**
 * Endpoint / payload / failure-copy contract of the employee request + expense calls (spec pages/12_employee_requests_expenses),
 * checked against a mocked HTTP client.
 */
import * as expenses from '../expenses';
import * as requests from '../requests';

const mockApi = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), upload: jest.fn() };

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

describe('request submit payloads', () => {
  it('leave: leave_dates as YYYY-MM-DD strings', async () => {
    mockApi.post.mockResolvedValue({ success: true, request_id: 'r1' });
    const r = await requests.submitLeave({ userId: 'u', orgId: 'o', dates: ['2026-10-20', '2026-11-02'], reason: 'trip' });
    expect(mockApi.post).toHaveBeenCalledWith('/requests/leave/submit', {
      user_id: 'u',
      org_id: 'o',
      leave_dates: ['2026-10-20', '2026-11-02'],
      reason: 'trip',
    });
    expect(r.requestId).toBe('r1');
  });

  it('permission: permission_date + 24h HH:mm times', async () => {
    mockApi.post.mockResolvedValue({ success: true });
    await requests.submitPermission({ userId: 'u', orgId: 'o', date: '2026-10-20', startTime: '09:30', endTime: '15:30', reason: 'bank' });
    expect(mockApi.post).toHaveBeenCalledWith('/requests/permission/submit', {
      user_id: 'u',
      org_id: 'o',
      permission_date: '2026-10-20',
      start_time: '09:30',
      end_time: '15:30',
      reason: 'bank',
    });
  });

  it('shift change: requested_shift_id number + shift_change_date', async () => {
    mockApi.post.mockResolvedValue({ success: true });
    await requests.submitShiftChange({ userId: 'u', orgId: 'o', reason: 'x', requestedShiftId: 4, date: '2026-10-20' });
    expect(mockApi.post).toHaveBeenCalledWith('/requests/shift-change/submit', {
      user_id: 'u',
      org_id: 'o',
      reason: 'x',
      requested_shift_id: 4,
      shift_change_date: '2026-10-20',
    });
  });

  it('device change: {user_id, org_id, reason}', async () => {
    mockApi.post.mockResolvedValue({ success: true });
    await requests.submitDeviceChange({ userId: 'u', orgId: 'o', reason: 'lost phone' });
    expect(mockApi.post).toHaveBeenCalledWith('/requests/device-change/submit', { user_id: 'u', org_id: 'o', reason: 'lost phone' });
  });

  it.each([
    ['leave', () => requests.submitLeave({ userId: 'u', orgId: 'o', dates: ['2026-10-20'], reason: 'x' })],
    ['permission', () => requests.submitPermission({ userId: 'u', orgId: 'o', date: '2026-10-20', startTime: '09:00', endTime: '10:00', reason: 'x' })],
    ['shift change', () => requests.submitShiftChange({ userId: 'u', orgId: 'o', reason: 'x', requestedShiftId: 1, date: '2026-10-20' })],
    ['device change', () => requests.submitDeviceChange({ userId: 'u', orgId: 'o', reason: 'x' })],
  ])('%s: {success:false} without a message reads "Failed to submit" (never the success text)', async (_n, call) => {
    mockApi.post.mockResolvedValue({ success: false });
    await expect(call()).rejects.toThrow('Failed to submit');
  });

  it('{success:false, message} surfaces the server message', async () => {
    mockApi.post.mockResolvedValue({ success: false, message: 'Date already requested' });
    await expect(requests.submitLeave({ userId: 'u', orgId: 'o', dates: ['2026-10-20'], reason: 'x' })).rejects.toThrow('Date already requested');
  });
});

describe('request reads', () => {
  it('calendar: path ids + start_date / end_date', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [{ date: '2026-10-31', status: 'pending', type: 'leave' }] });
    const days = await requests.getRequestCalendar('u', 'o', '2026-10-01', '2026-10-31');
    expect(mockApi.get).toHaveBeenCalledWith('/requests/calendar/u/o', { start_date: '2026-10-01', end_date: '2026-10-31' });
    expect(days).toEqual([{ date: '2026-10-31', status: 'pending', type: 'leave' }]);
  });

  it('own requests: GET /requests/employee/{userId}/{orgId}', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] });
    await requests.listEmployeeRequests('u', 'o');
    expect(mockApi.get).toHaveBeenCalledWith('/requests/employee/u/o');
  });
});

describe('expense calls', () => {
  it('odometer readings: user_id + reading_date', async () => {
    mockApi.get.mockResolvedValue({ success: true, data: [] });
    await expenses.getOdometerReadings('u', '2026-10-18');
    expect(mockApi.get).toHaveBeenCalledWith('/expenses/odometer/readings', { user_id: 'u', reading_date: '2026-10-18' });
  });

  it('odometer start / stop payloads', async () => {
    mockApi.post.mockResolvedValue({ success: true, distance: 12.5 });
    await expenses.startOdometer({ userId: 'u', date: '2026-10-18', startKm: 100 });
    expect(mockApi.post).toHaveBeenLastCalledWith('/expenses/odometer/start', { user_id: 'u', reading_date: '2026-10-18', start_km: 100 });
    const stop = await expenses.stopOdometer({ userId: 'u', date: '2026-10-18', stopKm: 112.5 });
    expect(mockApi.post).toHaveBeenLastCalledWith('/expenses/odometer/stop', { user_id: 'u', reading_date: '2026-10-18', stop_km: 112.5 });
    expect(stop.distanceKm).toBe(12.5);
  });

  it('odometer photo upload carries user_id, reading_date and photo_type in the query', async () => {
    mockApi.upload.mockResolvedValue({ success: true });
    await expenses.uploadOdometerPhoto({ userId: 'u', date: '2026-10-18', photoType: 'start', file: { uri: 'file:///a.jpg' } });
    expect(mockApi.upload.mock.calls[0][0]).toBe('/expenses/odometer/upload-photo');
    expect(mockApi.upload.mock.calls[0][2]).toEqual({ query: { user_id: 'u', reading_date: '2026-10-18', photo_type: 'start' } });
  });

  it('odometer failures without a detail read "Failed to submit" / "Failed to upload photo"', async () => {
    mockApi.post.mockResolvedValue({ success: false });
    await expect(expenses.startOdometer({ userId: 'u', date: '2026-10-18', startKm: 1 })).rejects.toThrow('Failed to submit');
    await expect(expenses.stopOdometer({ userId: 'u', date: '2026-10-18', stopKm: 1 })).rejects.toThrow('Failed to submit');
    mockApi.upload.mockResolvedValue({ success: false });
    await expect(expenses.uploadOdometerPhoto({ userId: 'u', date: '2026-10-18', photoType: 'stop', file: { uri: 'file:///a.jpg' } })).rejects.toThrow(
      'Failed to upload photo',
    );
  });

  it('travel / bill record keeps the casing the caller gives (submit lower-case), list upper-cases it', async () => {
    mockApi.post.mockResolvedValue({ success: true, expense_id: 'e1' });
    const r = await expenses.submitExpense({ userId: 'u', date: '2026-10-18', type: 'travel', amount: 150.5 });
    expect(mockApi.post).toHaveBeenCalledWith('/expenses/travel-bill/submit', { user_id: 'u', expense_date: '2026-10-18', expense_type: 'travel', amount: 150.5 });
    expect(r.expenseId).toBe('e1');
    mockApi.get.mockResolvedValue({ success: true, data: [] });
    await expenses.listMyExpenses('u', { type: 'bill', date: '2026-10-18' });
    expect(mockApi.get).toHaveBeenCalledWith('/expenses/travel-bill/expenses', { user_id: 'u', expense_type: 'BILL', expense_date: '2026-10-18' });
  });

  it('expense photo upload: user_id + expense_id query', async () => {
    mockApi.upload.mockResolvedValue({ success: true });
    await expenses.uploadExpensePhoto({ userId: 'u', expenseId: 'e1', file: { uri: 'file:///a.jpg' } });
    expect(mockApi.upload.mock.calls[0][0]).toBe('/expenses/travel-bill/upload-photo');
    expect(mockApi.upload.mock.calls[0][2]).toEqual({ query: { user_id: 'u', expense_id: 'e1' } });
  });
});
