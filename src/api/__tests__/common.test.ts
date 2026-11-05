import {
  arr,
  bool,
  dateOnly,
  isFailureBody,
  listOf,
  messageOf,
  num,
  objectOf,
  optNum,
  optStr,
  parseLatLng,
  pick,
  rec,
  roleId,
  str,
  toCompact12h,
  toHHmm,
} from '../mappers/common';

describe('toHHmm', () => {
  it.each([
    ['09:15 AM', '09:15'],
    ['09:15:30 AM', '09:15'],
    ['12:00 AM', '00:00'],
    ['12:30 PM', '12:30'],
    ['01:05 PM', '13:05'],
    ['09:30AM', '09:30'],
    ['06:00PM', '18:00'],
    ['14:05', '14:05'],
    ['14:05:59', '14:05'],
    ['9:05', '09:05'],
    [' 07:45 pm ', '19:45'],
  ])('%s -> %s', (input, expected) => {
    expect(toHHmm(input)).toBe(expected);
  });

  it.each([[''], [null], [undefined], ['abc'], ['25:00'], ['13:00 PM'], ['00:30 AM'], ['10:75'], [42]])(
    'rejects %p',
    (input) => {
      expect(toHHmm(input)).toBeUndefined();
    },
  );
});

describe('toCompact12h', () => {
  it('formats the compact shift style', () => {
    expect(toCompact12h('09:30')).toBe('09:30AM');
    expect(toCompact12h('00:05')).toBe('12:05AM');
    expect(toCompact12h('12:00')).toBe('12:00PM');
    expect(toCompact12h('18:45')).toBe('06:45PM');
  });
  it('accepts already-12h input and rejects garbage', () => {
    expect(toCompact12h('9:30 PM')).toBe('09:30PM');
    expect(() => toCompact12h('nope')).toThrow();
  });
});

describe('dateOnly', () => {
  it('keeps the calendar part without shifting zones', () => {
    expect(dateOnly('2026-03-01')).toBe('2026-03-01');
    expect(dateOnly('2026-03-01T23:30:00Z')).toBe('2026-03-01');
    expect(dateOnly('2026-03-01 10:00:00')).toBe('2026-03-01');
  });
  it('returns undefined for non-dates', () => {
    expect(dateOnly('')).toBeUndefined();
    expect(dateOnly('01/03/2026')).toBeUndefined();
    expect(dateOnly(null)).toBeUndefined();
  });
});

describe('scalar readers', () => {
  it('str / optStr', () => {
    expect(str(null)).toBe('');
    expect(str(12)).toBe('12');
    expect(str('  hi ')).toBe('hi');
    expect(str({}, 'x')).toBe('x');
    expect(optStr('  ')).toBeUndefined();
    expect(optStr('a')).toBe('a');
  });
  it('num / optNum', () => {
    expect(num('8.5')).toBe(8.5);
    expect(num('abc', 3)).toBe(3);
    expect(num(NaN, 1)).toBe(1);
    expect(optNum('')).toBeUndefined();
    expect(optNum(null)).toBeUndefined();
    expect(optNum('0')).toBe(0);
  });
  it('bool', () => {
    expect([true, 1, '1', 'true', 'YES'].every(bool)).toBe(true);
    expect([false, 0, '0', 'false', null, undefined, {}].some(bool)).toBe(false);
  });
  it('roleId', () => {
    expect(roleId(1)).toBe(1);
    expect(roleId('3')).toBe(3);
    expect(roleId(9)).toBeUndefined();
  });
  it('rec / arr / pick', () => {
    expect(rec(null)).toEqual({});
    expect(rec([1])).toEqual({});
    expect(arr('x')).toEqual([]);
    expect(pick({ a: null, b: 0, c: 1 }, 'a', 'b', 'c')).toBe(0);
  });
});

describe('envelopes', () => {
  it('listOf unwraps bare arrays and keyed envelopes', () => {
    expect(listOf([{ a: 1 }, 'x'])).toEqual([{ a: 1 }]);
    expect(listOf({ success: true, data: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(listOf({ success: true, sessions: [{ a: 2 }] }, ['sessions'])).toEqual([{ a: 2 }]);
    expect(listOf({ success: true })).toEqual([]);
    expect(listOf(null)).toEqual([]);
  });
  it('objectOf unwraps data / bare objects', () => {
    expect(objectOf({ success: true, data: { a: 1 } })).toEqual({ a: 1 });
    expect(objectOf({ a: 1 })).toEqual({ a: 1 });
    expect(objectOf({ shift: { id: 1 } }, ['data', 'shift'])).toEqual({ id: 1 });
    expect(objectOf('x')).toEqual({});
  });
  it('isFailureBody / messageOf', () => {
    expect(isFailureBody({ success: false, message: 'no' })).toBe(true);
    expect(isFailureBody({ success: true })).toBe(false);
    expect(isFailureBody([])).toBe(false);
    expect(messageOf({ message: ' hi ' }, 'x')).toBe('hi');
    expect(messageOf({}, 'fallback')).toBe('fallback');
  });
  it('parseLatLng', () => {
    expect(parseLatLng('12.5, 77.25')).toEqual({ latitude: 12.5, longitude: 77.25 });
    expect(parseLatLng('x,y')).toBeUndefined();
    expect(parseLatLng('1,2,3')).toBeUndefined();
    expect(parseLatLng(null)).toBeUndefined();
  });
});
