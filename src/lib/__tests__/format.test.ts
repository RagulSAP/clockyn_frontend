import {
  decimalHoursToHM,
  digitsOnly,
  formatBytes,
  formatClockHours,
  formatDuration,
  formatDurationMinutes,
  formatHoursMinutesLabel,
  formatINR,
  formatNumber,
  formatPhone,
  initials,
  isValidEmail,
  isValidMobile,
  maskPhone,
  normalizeMobile,
  numberOr,
  parseIntSafe,
  parseMoney,
  pluralize,
  pluralWord,
  roundTo,
  titleCase,
  toNumber,
  truncate,
  validateMoney,
} from '../format';

describe('toNumber', () => {
  it('parses numbers and numeric strings', () => {
    expect(toNumber(12)).toBe(12);
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber('1,23,456.75')).toBe(123456.75);
    expect(toNumber('₹ 500')).toBe(500);
    expect(toNumber('-3')).toBe(-3);
    expect(toNumber('.5')).toBe(0.5);
  });
  it('rejects non-numbers', () => {
    expect(toNumber('')).toBeNull();
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('12abc')).toBeNull();
    expect(toNumber('1e5')).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
    expect(toNumber(Infinity)).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });
});

describe('formatINR / formatNumber', () => {
  it('uses Indian grouping', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(999)).toBe('₹999');
    expect(formatINR(1000)).toBe('₹1,000');
    expect(formatINR(123456)).toBe('₹1,23,456');
    expect(formatINR(1234567)).toBe('₹12,34,567');
    expect(formatINR(123456789)).toBe('₹12,34,56,789');
  });
  it('keeps decimals instead of truncating (v1 parseInt bug)', () => {
    expect(formatINR(1234.5)).toBe('₹1,234.5');
    expect(formatINR(1234.56)).toBe('₹1,234.56');
    expect(formatINR('1500.75')).toBe('₹1,500.75');
    expect(formatINR(10.999)).toBe('₹11');
  });
  it('supports fixed decimals', () => {
    expect(formatINR(1234.5, { decimals: 2 })).toBe('₹1,234.50');
    expect(formatINR(1234, { decimals: 2 })).toBe('₹1,234.00');
    expect(formatINR(1234.5, { decimals: 0 })).toBe('₹1,235');
  });
  it('handles negatives, zero and invalid input', () => {
    expect(formatINR(-50)).toBe('-₹50');
    expect(formatINR(-1234.5)).toBe('-₹1,234.5');
    expect(formatINR(-0.001)).toBe('₹0');
    expect(formatINR(null)).toBe('₹0');
    expect(formatINR(undefined)).toBe('₹0');
    expect(formatINR('abc')).toBe('₹0');
    expect(formatINR(Number.NaN, { fallback: '—' })).toBe('—');
  });
  it('formatNumber', () => {
    expect(formatNumber(1234567.5)).toBe('12,34,567.5');
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(-1500)).toBe('-1,500');
    expect(formatNumber('x', { fallback: '-' })).toBe('-');
    expect(formatNumber(3, { decimals: 1 })).toBe('3.0');
  });
});

describe('parseMoney / validateMoney', () => {
  it('accepts positive amounts', () => {
    expect(parseMoney('500')).toBe(500);
    expect(parseMoney('1,500.50')).toBe(1500.5);
    expect(parseMoney('₹250')).toBe(250);
    expect(parseMoney(12.34)).toBe(12.34);
  });
  it('rejects NaN, negatives, empty and zero by default', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney(-5)).toBeNull();
    expect(parseMoney(Number.NaN)).toBeNull();
    expect(parseMoney('0')).toBeNull();
    expect(parseMoney(0)).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });
  it('allows zero when asked', () => {
    expect(parseMoney('0', { allowZero: true })).toBe(0);
  });
  it('limits decimals and bounds', () => {
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('1.234', { maxDecimals: 3 })).toBe(1.234);
    expect(parseMoney(0.1 + 0.2)).toBe(0.1 + 0.2); // float noise is not a 3rd decimal
    expect(parseMoney('101', { max: 100 })).toBeNull();
    expect(parseMoney('100', { max: 100 })).toBe(100);
    expect(parseMoney('4', { min: 5 })).toBeNull();
  });
  it('validateMoney returns user-facing messages', () => {
    expect(validateMoney('', 'Rate')).toBe('Rate is required');
    expect(validateMoney('abc', 'Rate')).toBe('Rate must be a number');
    expect(validateMoney('-1', 'Rate')).toBe('Rate cannot be negative');
    expect(validateMoney('0', 'Rate')).toBe('Rate must be greater than zero');
    expect(validateMoney('1.234', 'Rate')).toBe('Rate can have at most 2 decimal places');
    expect(validateMoney('150', 'Rate', { max: 100 })).toBe('Rate cannot exceed 100');
    expect(validateMoney('50', 'Rate')).toBeNull();
    expect(validateMoney('0', 'Bonus', { allowZero: true })).toBeNull();
  });
});

describe('integers & rounding', () => {
  it('parseIntSafe', () => {
    expect(parseIntSafe('12')).toBe(12);
    expect(parseIntSafe('12.5')).toBeNull();
    expect(parseIntSafe('-1')).toBeNull();
    expect(parseIntSafe('-1', { allowNegative: true })).toBe(-1);
    expect(parseIntSafe('5', { min: 6 })).toBeNull();
    expect(parseIntSafe('50', { max: 10 })).toBeNull();
    expect(parseIntSafe('abc')).toBeNull();
  });
  it('numberOr / roundTo', () => {
    expect(numberOr('x', 7)).toBe(7);
    expect(numberOr('3')).toBe(3);
    expect(roundTo(1.005)).toBe(1.01);
    expect(roundTo(2.5, 0)).toBe(3);
    expect(roundTo(Number.NaN)).toBe(0);
  });
});

describe('phone', () => {
  it('maskPhone keeps first and last two digits', () => {
    expect(maskPhone('9876543210')).toBe('98******10');
    expect(maskPhone('+91 98765 43210')).toBe('98******10');
    expect(maskPhone('1234')).toBe('****');
    expect(maskPhone('')).toBe('');
    expect(maskPhone(null)).toBe('');
  });
  it('normalizeMobile / formatPhone / validation', () => {
    expect(normalizeMobile('+91 98765-43210')).toBe('9876543210');
    expect(normalizeMobile('09876543210')).toBe('9876543210');
    expect(normalizeMobile('9876543210')).toBe('9876543210');
    expect(formatPhone('9876543210')).toBe('98765 43210');
    expect(formatPhone('12345')).toBe('12345');
    expect(isValidMobile('9876543210')).toBe(true);
    expect(isValidMobile('987654321')).toBe(false);
    expect(isValidMobile('98765432100')).toBe(false);
    expect(isValidMobile('abcdefghij')).toBe(false);
    expect(digitsOnly('a1b2-3')).toBe('123');
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('text helpers', () => {
  it('initials', () => {
    expect(initials('Ravi Kumar')).toBe('RK');
    expect(initials('  ravi   kumar  singh ')).toBe('RK');
    expect(initials('madonna')).toBe('M');
    expect(initials('A B C', 3)).toBe('ABC');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });
  it('pluralize', () => {
    expect(pluralize(0, 'day')).toBe('0 days');
    expect(pluralize(1, 'day')).toBe('1 day');
    expect(pluralize(2, 'day')).toBe('2 days');
    expect(pluralize(2, 'person', 'people')).toBe('2 people');
    expect(pluralize(1200, 'lead')).toBe('1,200 leads');
    expect(pluralWord(1, 'staff', 'staff')).toBe('staff');
    expect(pluralWord(3, 'branch', 'branches')).toBe('branches');
  });
  it('titleCase / truncate', () => {
    expect(titleCase('shift_change')).toBe('Shift Change');
    expect(titleCase('device-change')).toBe('Device Change');
    expect(titleCase(null)).toBe('');
    expect(truncate('hello world', 20)).toBe('hello world');
    expect(truncate('hello world', 6)).toBe('hello…');
  });
});

describe('durations', () => {
  it('formatDuration(h, m)', () => {
    expect(formatDuration(1, 5)).toBe('1h 5m');
    expect(formatDuration(0, 30)).toBe('30m');
    expect(formatDuration(2, 0)).toBe('2h');
    expect(formatDuration(0, 0)).toBe('—');
    expect(formatDuration(0, 65)).toBe('1h 5m');
    expect(formatDuration(1.5)).toBe('1h 30m');
    expect(formatDuration(0, 0, { zero: '0m' })).toBe('0m');
    expect(formatDuration(Number.NaN, Number.NaN)).toBe('—');
  });
  it('formatDurationMinutes', () => {
    expect(formatDurationMinutes(65)).toBe('1h 5m');
    expect(formatDurationMinutes(0)).toBe('—');
    expect(formatDurationMinutes(-4)).toBe('—');
  });
  it('decimal hours', () => {
    expect(decimalHoursToHM('8.5')).toEqual({ hours: 8, minutes: 30 });
    expect(decimalHoursToHM(0.25)).toEqual({ hours: 0, minutes: 15 });
    expect(decimalHoursToHM('x')).toEqual({ hours: 0, minutes: 0 });
    expect(formatClockHours('8.5')).toBe('08:30');
    expect(formatClockHours('07:15')).toBe('07:15');
    expect(formatClockHours(null)).toBe('00:00');
    expect(formatHoursMinutesLabel(480)).toBe('8:00 hrs');
    expect(formatHoursMinutesLabel(65)).toBe('1:05 hrs');
    expect(formatHoursMinutesLabel(-5)).toBe('0:00 hrs');
  });
  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(-1)).toBe('0 B');
  });
});
