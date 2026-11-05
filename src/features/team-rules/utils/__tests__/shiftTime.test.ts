import type { Shift } from '@/types/api/shifts';

import { SHIFT_MESSAGES, formatShiftRange, shiftDurationLabel, shiftTooLongMessage, validateShiftForm } from '../shiftTime';

const shift = (id: number, name: string, startTime: string, endTime: string): Shift => ({ id, name, startTime, endTime, isActive: true, raw: {} });
const existing = [shift(1, 'Morning', '09:00', '18:00'), shift(2, 'Night', '22:00', '06:00')];

describe('validateShiftForm', () => {
  it('reports empty fields (v1 silently did nothing)', () => {
    expect(validateShiftForm({ name: ' ', startTime: '', endTime: '' }, [])).toEqual({
      name: SHIFT_MESSAGES.nameRequired,
      startTime: SHIFT_MESSAGES.startRequired,
      endTime: SHIFT_MESSAGES.endRequired,
    });
    expect(validateShiftForm({ name: 'Eve', startTime: '14:00', endTime: '' }, []).endTime).toBe(SHIFT_MESSAGES.endRequired);
  });

  it('rejects identical start and end', () => {
    expect(validateShiftForm({ name: 'X', startTime: '09:00', endTime: '09:00' }, existing)).toEqual({ form: SHIFT_MESSAGES.sameTime });
  });

  it('rejects a duplicate name case-insensitively and a duplicate time window', () => {
    expect(validateShiftForm({ name: ' morning ', startTime: '10:00', endTime: '14:00' }, existing)).toEqual({ name: SHIFT_MESSAGES.duplicateName });
    expect(validateShiftForm({ name: 'Other', startTime: '09:00', endTime: '18:00' }, existing)).toEqual({ form: SHIFT_MESSAGES.duplicateTime });
  });

  it('applies the v1 rule order: same time, then name, then time window', () => {
    // Same name AND same time window AND start === end -> the start/end rule wins.
    expect(validateShiftForm({ name: 'Morning', startTime: '09:00', endTime: '09:00' }, existing).form).toBe(SHIFT_MESSAGES.sameTime);
    // Same name and same window -> the name rule wins.
    expect(validateShiftForm({ name: 'Morning', startTime: '09:00', endTime: '18:00' }, existing).name).toBe(SHIFT_MESSAGES.duplicateName);
  });

  it('allows a shift to keep its own name and time when editing', () => {
    expect(validateShiftForm({ name: 'Morning', startTime: '09:00', endTime: '18:00' }, existing, 1)).toEqual({});
  });

  it('allows overnight shifts', () => {
    expect(validateShiftForm({ name: 'Late', startTime: '23:00', endTime: '05:00' }, existing)).toEqual({});
  });

  it('rejects shifts longer than 18 hours with an explanation (09:00 -> 06:00 is 21 h)', () => {
    const errors = validateShiftForm({ name: 'Long', startTime: '09:00', endTime: '06:00' }, existing);
    expect(errors.form).toContain('21.0 hours');
    expect(errors.form).toContain('AM/PM');
  });

  it('accepts exactly 18 hours', () => {
    expect(validateShiftForm({ name: 'Edge', startTime: '06:00', endTime: '00:00' }, existing)).toEqual({});
    expect(shiftTooLongMessage('06:00', '00:00')).toBeNull();
    expect(shiftTooLongMessage('06:00', '00:30')).not.toBeNull();
  });
});

describe('shift display helpers', () => {
  it('formats the duration, including overnight spans', () => {
    expect(shiftDurationLabel('09:00', '18:00')).toBe('9h');
    expect(shiftDurationLabel('22:00', '06:00')).toBe('8h');
    expect(shiftDurationLabel('09:00', '17:30')).toBe('8h 30m');
    expect(shiftDurationLabel('', '17:30')).toBeNull();
  });

  it('formats the range as 12-hour times', () => {
    expect(formatShiftRange('09:00', '18:30')).toBe('09:00 AM - 06:30 PM');
    expect(formatShiftRange('00:00', '12:00')).toBe('12:00 AM - 12:00 PM');
  });
});
