import type { AttendanceDay } from '@/types/api/attendance';
import type { StaffRequest } from '@/types/api/requests';
import type { Shift } from '@/types/api/shifts';

import { buildShiftHistory, deriveDay, isHalfDay, mergeApprovedLeave, shiftForDate } from '../attendanceCalendar';
import { numberToWords, rupeesInWords } from '../numberToWords';

const day = (over: Partial<AttendanceDay> & { date: string }): AttendanceDay => ({ status: 'present', raw: {}, ...over });

// 2026-10-18 is a Sunday; 2026-10-14 a Wednesday; 2026-10-17 a Saturday.
const TODAY = '2026-10-16';

describe('deriveDay', () => {
  it('colours present and late green (late with a Late caption)', () => {
    expect(deriveDay('2026-10-14', day({ date: '2026-10-14', punchIn: '09:00', punchOut: '18:00', totalHours: 9 }), TODAY)).toMatchObject({ status: 'present', color: 'statusPresent', caption: undefined });
    expect(deriveDay('2026-10-14', day({ date: '2026-10-14', status: 'late', punchIn: '10:00', punchOut: '19:00', totalHours: 9 }), TODAY)).toMatchObject({ status: 'late', color: 'statusPresent', caption: 'Late' });
  });

  it('an elapsed day with no record is Absent and tappable', () => {
    const v = deriveDay('2026-10-14', undefined, TODAY);
    expect(v).toMatchObject({ status: 'absent', color: 'statusAbsent' });
    expect(v.displayRecord).toMatchObject({ date: '2026-10-14', status: 'absent' });
  });

  it('today and future days with no record have no status and cannot be opened', () => {
    expect(deriveDay(TODAY, undefined, TODAY)).toMatchObject({ status: 'none', color: null, displayRecord: undefined });
    expect(deriveDay('2026-10-20', undefined, TODAY)).toMatchObject({ status: 'none', color: null, displayRecord: undefined });
  });

  it('Sunday is the weekly off colour whatever the record says, without a HALF caption', () => {
    const v = deriveDay('2026-10-11', day({ date: '2026-10-11', punchIn: '09:00', punchOut: '10:00', totalHours: 1 }), TODAY);
    expect(v.color).toBe('statusWeekOff');
    expect(v.caption).toBeUndefined();
    // an elapsed Sunday without a record still opens the sheet (Absent), like v1
    expect(deriveDay('2026-10-11', undefined, TODAY).displayRecord?.status).toBe('absent');
  });

  it('leave and half-day statuses use their own colours', () => {
    expect(deriveDay('2026-10-14', day({ date: '2026-10-14', status: 'leave' }), TODAY).color).toBe('statusLeave');
    expect(deriveDay('2026-10-14', day({ date: '2026-10-14', status: 'half_day' }), TODAY)).toMatchObject({ color: 'statusHalfDay', caption: 'HALF', status: 'half_day' });
  });

  it('a late day under half the shift is Half Day (HALF, not Late)', () => {
    const v = deriveDay('2026-10-14', day({ date: '2026-10-14', status: 'late', punchIn: '10:00', punchOut: '13:50', totalHours: 3 + 50 / 60 }), TODAY);
    expect(v).toMatchObject({ status: 'half_day', caption: 'HALF', color: 'statusHalfDay' });
  });
});

describe('isHalfDay', () => {
  it('worked 3:50 on the default 9 h shift is a half day; 4:30 is not', () => {
    expect(isHalfDay(day({ date: 'x', totalHours: 3 + 50 / 60 }))).toBe(true);
    expect(isHalfDay(day({ date: 'x', totalHours: 4.5 }))).toBe(false);
  });
  it('uses punch times when there is no total, including a punch-out after midnight', () => {
    expect(isHalfDay(day({ date: 'x', punchIn: '09:00', punchOut: '12:00' }))).toBe(true);
    expect(isHalfDay(day({ date: 'x', punchIn: '22:00', punchOut: '06:00' }))).toBe(false);
  });
  it('uses the record shift times when present (overnight shift)', () => {
    const raw = { shift_start_time: '22:00', shift_end_time: '06:00' };
    expect(isHalfDay(day({ date: 'x', raw, totalHours: 3.5 }))).toBe(true);
    expect(isHalfDay(day({ date: 'x', raw, totalHours: 4.5 }))).toBe(false);
  });
  it('never flags an empty day', () => {
    expect(isHalfDay(day({ date: 'x' }))).toBe(false);
  });
});

describe('mergeApprovedLeave', () => {
  it('adds approved leave only where there is no attendance record', () => {
    const merged = mergeApprovedLeave(
      [day({ date: '2026-10-02' })],
      [
        { date: '2026-10-02', status: 'approved', type: 'leave' },
        { date: '2026-10-03', status: 'approved', type: 'leave' },
        { date: '2026-10-04', status: 'pending', type: 'leave' },
        { date: '2026-10-05', status: 'approved', type: 'permission' },
      ],
    );
    expect(merged.map((r) => [r.date, r.status])).toEqual([
      ['2026-10-02', 'present'],
      ['2026-10-03', 'leave'],
    ]);
  });
});

describe('shift history', () => {
  const shifts: Shift[] = [
    { id: 1, name: 'General', startTime: '09:00', endTime: '18:00', isActive: true, raw: {} },
    { id: 2, name: 'Night', startTime: '22:00', endTime: '06:00', isActive: true, raw: {} },
  ];
  const request = (over: Record<string, unknown>) =>
    ({ id: 'r', type: 'shift_change', status: 'approved', reason: '', dates: [], dateStatuses: {}, raw: {}, ...over }) as unknown as StaffRequest;

  it('builds the timeline of approved changes, oldest first, keyed by the change date', () => {
    const history = buildShiftHistory(
      [
        request({ requestedShiftId: 2, currentShiftId: 1, shiftChangeDate: '2026-10-10' }),
        request({ status: 'pending', requestedShiftId: 1 }),
        request({ type: 'leave' }),
        request({ requestedShiftId: 1, shiftChangeDate: '2026-09-01', actionAt: '2026-08-30T10:00:00' }),
      ],
      shifts,
    );
    expect(history.map((h) => [h.effectiveDate, h.name])).toEqual([
      ['2026-09-01', 'General'],
      ['2026-10-10', 'Night'],
    ]);
  });

  it('picks the shift in force on a date; before the first change it uses the shift that preceded it', () => {
    const current = { name: 'Night', start: '22:00', end: '06:00' };
    const history = buildShiftHistory([request({ requestedShiftId: 2, currentShiftId: 1, shiftChangeDate: '2026-10-10' })], shifts);
    expect(shiftForDate('2026-10-12', undefined, current, history)?.name).toBe('Night');
    expect(shiftForDate('2026-10-09', undefined, current, history)?.name).toBe('General'); // v1 showed the CURRENT shift here
    expect(shiftForDate('2026-10-09', undefined, current, [])).toBe(current);
  });

  it('a record that carries its own shift times wins', () => {
    const rec = day({ date: '2026-10-12', raw: { shift_start_time: '08:00', shift_end_time: '16:00' } });
    expect(shiftForDate('2026-10-12', rec, undefined, [])).toEqual({ start: '08:00', end: '16:00' });
  });
});

describe('numberToWords', () => {
  it('uses Indian numbering', () => {
    expect(numberToWords(0)).toBe('Zero');
    expect(numberToWords(21)).toBe('Twenty One');
    expect(numberToWords(1000)).toBe('One Thousand');
    expect(numberToWords(125000)).toBe('One Lakh Twenty Five Thousand');
    expect(numberToWords(12345678)).toBe('One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight');
  });
  it('ignores paise and appends the suffix', () => {
    expect(rupeesInWords(40000.99)).toBe('Forty Thousand Rupees Only');
    expect(rupeesInWords(0)).toBe('Zero Rupees Only');
  });
});
