import {
  mapAttendanceDay,
  mapAttendanceEditResult,
  mapAttendanceStatus,
  mapMonthlyAttendance,
  mapSessions,
  mapTodayAttendance,
} from '../mappers/attendance';
import {
  computePendingCounts,
  computeUnreadCounts,
  deriveStatus,
  hasPending,
  mapCalendarDay,
  mapRequest,
  mapSessionCheck,
} from '../mappers/requests';

describe('attendance', () => {
  it('mapAttendanceStatus normalises and defaults to absent', () => {
    expect(mapAttendanceStatus('Present')).toBe('present');
    expect(mapAttendanceStatus('half day')).toBe('half_day');
    expect(mapAttendanceStatus('LATE')).toBe('late');
    expect(mapAttendanceStatus('weird')).toBe('absent');
  });

  it('mapAttendanceDay converts times, hours and location', () => {
    const d = mapAttendanceDay({
      date: '2026-03-02',
      status: 'late',
      punch_in: '09:45 AM',
      punch_out: '06:00 PM',
      total_hours: '8.25',
      location: '12.1,77.2',
      punch_in_photo: 'https://x/in.png',
      punch_out_photo: null,
      distance: null,
    });
    expect(d).toMatchObject({
      date: '2026-03-02',
      status: 'late',
      punchIn: '09:45',
      punchOut: '18:00',
      totalHours: 8.25,
      location: { latitude: 12.1, longitude: 77.2 },
      punchInPhoto: 'https://x/in.png',
    });
    expect(d.punchOutPhoto).toBeUndefined();
  });

  it('mapMonthlyAttendance maps counters and drops rows without a date', () => {
    const m = mapMonthlyAttendance(
      {
        month: 3,
        year: 2026,
        total_days: 31,
        present_days: 2,
        absent_days: '29',
        late_days: 1,
        attendance_data: [
          { date: '2026-03-01', status: 'present', punch_in: '09:00 AM', total_hours: '8' },
          { date: '2026-03-02', status: 'late' },
          { status: 'present' },
        ],
      },
      3,
      2026,
    );
    expect(m).toMatchObject({ month: 3, year: 2026, totalDays: 31, presentDays: 2, absentDays: 29, lateDays: 1 });
    expect(m.days.map((d) => d.date)).toEqual(['2026-03-01', '2026-03-02']);
  });

  it('mapMonthlyAttendance falls back to the requested month for empty bodies', () => {
    const m = mapMonthlyAttendance({}, 4, 2026);
    expect(m).toMatchObject({ month: 4, year: 2026, totalDays: 0, days: [] });
  });

  it('mapTodayAttendance handles sessions with seconds', () => {
    const t = mapTodayAttendance({
      success: true,
      punch_in: '09:15:30 AM',
      punch_out: null,
      is_punched_in: true,
      sessions: [{ punch_in: '09:15:30 AM', punch_out: null, work_hours: 0 }],
      total_work_hours: 0,
    });
    expect(t).toMatchObject({ punchIn: '09:15', isPunchedIn: true, punchCount: 1, totalWorkHours: 0 });
    expect(t.punchOut).toBeUndefined();
    expect(t.sessions[0]).toMatchObject({ punchIn: '09:15', workHours: 0 });
  });

  it('mapTodayAttendance falls back to punch_count and empty days', () => {
    expect(mapTodayAttendance({ punch_count: 2, is_punched_in: false }).punchCount).toBe(2);
    expect(mapTodayAttendance({ success: true, sessions: [] })).toMatchObject({ isPunchedIn: false, punchCount: 0, sessions: [] });
  });

  it('mapSessions reads the `sessions` envelope', () => {
    const s = mapSessions({
      success: true,
      sessions: [
        { punch_in: '09:00:00 AM', punch_out: '01:00:00 PM', punch_in_photo: 'a', punch_out_photo: 'b' },
        { punch_in: '02:00:00 PM', punch_out: null, punch_in_photo: null, punch_out_photo: null },
      ],
    });
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ punchIn: '09:00', punchOut: '13:00', punchInPhoto: 'a' });
    expect(s[1].punchOut).toBeUndefined();
  });

  it('mapAttendanceEditResult', () => {
    expect(
      mapAttendanceEditResult({ success: true, message: 'Attendance updated successfully', work_hours: 8.5, punch_in: '09:00 AM', punch_out: '05:30 PM' }),
    ).toEqual({ message: 'Attendance updated successfully', workHours: 8.5, punchIn: '09:00', punchOut: '17:30' });
  });
});

describe('requests', () => {
  const leaveAdmin = {
    request_id: 'r1',
    request_type: 'leave',
    reason: 'Family function',
    status: null,
    user_id: 'u1',
    staff_name: 'Asha',
    created_at: '2026-03-01T04:00:00+00:00',
    dates: ['2026-03-10', '2026-03-11', '2026-03-12'],
    date_statuses: {
      '2026-03-10': { status: 'approved', action_by: 'admin', action_at: '2026-03-02T05:00:00' },
      '2026-03-11': { status: 'pending' },
      '2026-03-12': { status: 'rejected' },
    },
  };

  it('maps an admin leave request with per-date decisions', () => {
    const r = mapRequest(leaveAdmin);
    expect(r.type).toBe('leave');
    expect(r).toMatchObject({ id: 'r1', userId: 'u1', staffName: 'Asha', dates: ['2026-03-10', '2026-03-11', '2026-03-12'] });
    expect(r.dateStatuses['2026-03-10']).toEqual({ status: 'approved', actionBy: 'admin', actionAt: '2026-03-02T05:00:00' });
    expect(r.status).toBe('pending');
    expect(hasPending(r)).toBe(true);
  });

  it('deriveStatus: pending > approved > rejected, then the request-level value', () => {
    expect(deriveStatus(undefined, { a: { status: 'approved' }, b: { status: 'rejected' } })).toBe('approved');
    expect(deriveStatus(undefined, { a: { status: 'rejected' } })).toBe('rejected');
    expect(deriveStatus('approved', {})).toBe('approved');
    expect(deriveStatus(undefined, {})).toBe('pending');
  });

  it('maps a permission request with 24h times', () => {
    const r = mapRequest({
      request_id: 'r2',
      request_type: 'permission',
      reason: 'Doctor',
      status: 'approved',
      permission_start_time: '10:00:00',
      permission_end_time: '12:30',
      dates: ['2026-03-05'],
    });
    expect(r.type).toBe('permission');
    if (r.type === 'permission') {
      expect(r.startTime).toBe('10:00');
      expect(r.endTime).toBe('12:30');
    }
    expect(r.status).toBe('approved');
  });

  it('maps a shift-change request', () => {
    const r = mapRequest({
      request_id: 'r3',
      request_type: 'shift_change',
      reason: 'Exam',
      status: 'pending',
      requested_shift_id: '4',
      current_shift_id: 2,
      requested_shift_timing: '10:00 AM - 07:00 PM',
      shift_change_date: '2026-03-08T00:00:00',
      dates: [],
    });
    expect(r.type).toBe('shift_change');
    if (r.type === 'shift_change') {
      expect(r).toMatchObject({ requestedShiftId: 4, currentShiftId: 2, requestedShiftTiming: '10:00 AM - 07:00 PM', shiftChangeDate: '2026-03-08' });
    }
  });

  it('employee rows (no date_statuses) fall back to the request status and default to pending', () => {
    expect(mapRequest({ request_id: 'e1', request_type: 'device_change', status: 'rejected', dates: [] }).status).toBe('rejected');
    expect(mapRequest({ request_id: 'e2', request_type: 'leave', status: null, dates: ['2026-03-01'] }).status).toBe('pending');
  });

  it('unknown types become leave and invalid dates are dropped', () => {
    const r = mapRequest({ request_id: 'x', request_type: 'mystery', dates: ['bad', '2026-03-01'] });
    expect(r.type).toBe('leave');
    expect(r.dates).toEqual(['2026-03-01']);
  });

  it('computePendingCounts follows the v1 rule (any pending date, else request status)', () => {
    const list = [
      mapRequest(leaveAdmin),
      mapRequest({ request_id: 'l2', request_type: 'leave', status: null, dates: ['2026-03-01'], date_statuses: { '2026-03-01': { status: 'approved' } } }),
      mapRequest({ request_id: 'p1', request_type: 'permission', status: 'pending', dates: ['2026-03-05'], date_statuses: { '2026-03-05': { status: 'pending' } } }),
      mapRequest({ request_id: 's1', request_type: 'shift_change', status: 'pending', dates: [] }),
      mapRequest({ request_id: 's2', request_type: 'shift_change', status: 'approved', dates: [] }),
      mapRequest({ request_id: 'd1', request_type: 'device_change', status: 'pending', dates: [] }),
    ];
    expect(computePendingCounts(list)).toEqual({ total: 4, leave: 1, permission: 1, shiftChange: 1, deviceChange: 1 });
    expect(computePendingCounts([])).toEqual({ total: 0, leave: 0, permission: 0, shiftChange: 0, deviceChange: 0 });
  });

  it('computeUnreadCounts clamps at zero', () => {
    const pending = { total: 7, leave: 3, permission: 2, shiftChange: 1, deviceChange: 1 };
    expect(computeUnreadCounts(pending, { leave: 1, permission: 5 })).toEqual({ total: 4, leave: 2, permission: 0, shiftChange: 1, deviceChange: 1 });
    expect(computeUnreadCounts(pending, null)).toEqual({ total: 7, leave: 3, permission: 2, shiftChange: 1, deviceChange: 1 });
  });

  it('mapCalendarDay', () => {
    expect(mapCalendarDay({ date: '2026-03-09', status: 'approved', type: 'permission' })).toEqual({ date: '2026-03-09', status: 'approved', type: 'permission' });
    expect(mapCalendarDay({ date: '2026-03-09T00:00:00', status: 'x', type: 'leave' })).toEqual({ date: '2026-03-09', status: 'pending', type: 'leave' });
  });

  it('mapSessionCheck', () => {
    expect(mapSessionCheck({ valid: true, force_logout: false })).toEqual({ valid: true, forceLogout: false, reason: undefined });
    expect(mapSessionCheck({ valid: false, force_logout: true, reason: 'logged_in_on_another_device' })).toEqual({
      valid: false,
      forceLogout: true,
      reason: 'logged_in_on_another_device',
    });
    expect(mapSessionCheck({ force_logout: true }).valid).toBe(false);
  });
});
