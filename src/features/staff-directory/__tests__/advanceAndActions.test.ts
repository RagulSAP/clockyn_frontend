import { ADVANCE_MESSAGES, sanitizeAmountInput, validateAdvance } from '../utils/advance';
import { composeTime, displayTime, hour12Of, meridiemOf, minuteOf, validatePunchEdit } from '../utils/punchClock';
import { ASSIGN_TARGETS, canPermanentlyDelete, isDeleteConfirmValid } from '../utils/staffActions';

const TODAY = '2026-10-18';

describe('validateAdvance', () => {
  it('requires a date', () => {
    expect(validateAdvance({ date: '', amount: '100' }, TODAY)).toEqual({ ok: false, field: 'date', message: ADVANCE_MESSAGES.dateRequired });
  });
  it('rejects future dates', () => {
    expect(validateAdvance({ date: '2026-10-19', amount: '100' }, TODAY)).toMatchObject({ ok: false, field: 'date', message: ADVANCE_MESSAGES.dateFuture });
  });
  it('rejects empty, non-numeric and trailing-garbage amounts', () => {
    for (const amount of ['', '  ', 'abc', '5abc', '1.2.3', '-5', '1e3']) {
      expect(validateAdvance({ date: TODAY, amount }, TODAY)).toMatchObject({ ok: false, field: 'amount', message: ADVANCE_MESSAGES.amountInvalid });
    }
  });
  it('rejects zero', () => {
    for (const amount of ['0', '0.00', '.0']) {
      expect(validateAdvance({ date: TODAY, amount }, TODAY)).toMatchObject({ ok: false, field: 'amount', message: ADVANCE_MESSAGES.amountPositive });
    }
  });
  it('accepts positive numbers and today', () => {
    expect(validateAdvance({ date: TODAY, amount: '1500' }, TODAY)).toEqual({ ok: true, amount: 1500, date: TODAY });
    expect(validateAdvance({ date: '2026-10-01', amount: ' 250.50 ' }, TODAY)).toEqual({ ok: true, amount: 250.5, date: '2026-10-01' });
    expect(validateAdvance({ date: TODAY, amount: '.5' }, TODAY)).toMatchObject({ ok: true, amount: 0.5 });
  });
});

describe('sanitizeAmountInput', () => {
  it('keeps digits and a single dot', () => {
    expect(sanitizeAmountInput('1,2a3.4.5')).toBe('123.45');
    expect(sanitizeAmountInput('-12')).toBe('12');
  });
});

describe('punch clock helpers', () => {
  it('reads hour, minute and meridiem', () => {
    expect(hour12Of('00:15')).toBe(12);
    expect(hour12Of('13:45')).toBe(1);
    expect(minuteOf('13:45')).toBe(45);
    expect(meridiemOf('11:59')).toBe('AM');
    expect(meridiemOf('12:00')).toBe('PM');
  });
  it('treats an empty value as 12:00 AM', () => {
    expect(hour12Of('')).toBe(12);
    expect(minuteOf('')).toBe(0);
    expect(meridiemOf('')).toBe('AM');
    expect(displayTime('')).toBe('--:--');
  });
  it('composes 24-hour values', () => {
    expect(composeTime(12, 0, 'AM')).toBe('00:00');
    expect(composeTime(12, 30, 'PM')).toBe('12:30');
    expect(composeTime(9, 5, 'PM')).toBe('21:05');
    expect(composeTime(1, 0, 'AM')).toBe('01:00');
    expect(displayTime('21:05')).toBe('09:05 PM');
  });
  it('requires at least one time but allows punch-out before punch-in (overnight)', () => {
    expect(validatePunchEdit('', '').ok).toBe(false);
    expect(validatePunchEdit('09:00', '').ok).toBe(true);
    expect(validatePunchEdit('22:00', '06:00').ok).toBe(true);
  });
});

describe('delete confirmation and role gate', () => {
  it('matches the typed name case-insensitively and trimmed', () => {
    expect(isDeleteConfirmValid('  asha verma ', 'Asha Verma')).toBe(true);
    expect(isDeleteConfirmValid('asha', 'Asha Verma')).toBe(false);
    expect(isDeleteConfirmValid('', 'Asha Verma')).toBe(false);
  });
  it('can never confirm a staff member without a name', () => {
    expect(isDeleteConfirmValid('', '')).toBe(false);
    expect(isDeleteConfirmValid('x', undefined)).toBe(false);
  });
  it('only role 1 may delete permanently', () => {
    expect(canPermanentlyDelete(1)).toBe(true);
    expect(canPermanentlyDelete(2)).toBe(false);
    expect(canPermanentlyDelete(3)).toBe(false);
    expect(canPermanentlyDelete(null)).toBe(false);
  });
});

describe('Assign hub', () => {
  it('lists manager, shift and the six salary components with admin routes', () => {
    expect(ASSIGN_TARGETS.map((t) => t.title)).toEqual([
      'Manager',
      'Shift',
      'Monthly Fixed',
      'Daily Wages',
      'Hourly Charges',
      'Incentive',
      'Overtime (OT)',
      'Bonus',
    ]);
    expect(ASSIGN_TARGETS.every((t) => t.route.startsWith('/admin/'))).toBe(true);
    expect(ASSIGN_TARGETS.filter((t) => t.section === 'salary')).toHaveLength(6);
  });
});
