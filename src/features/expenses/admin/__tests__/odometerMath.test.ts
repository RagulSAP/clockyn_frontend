import { filterByDate, recordsLabel } from '../utils/recordFilter';
import { DEFAULT_RATE_PER_KM, effectiveRate, parseRate, readingAmount, readingDistance } from '../utils/odometerMath';

const reading = (over: { distanceKm?: number; startKm?: number; stopKm?: number }) => over;

describe('readingDistance', () => {
  it('prefers the server distance', () => {
    expect(readingDistance(reading({ distanceKm: 12.5, startKm: 0, stopKm: 99 }))).toBe(12.5);
  });
  it('falls back to stop - start', () => {
    expect(readingDistance(reading({ startKm: 100, stopKm: 150 }))).toBe(50);
  });
  it('a start of 0 km is a real reading', () => {
    expect(readingDistance(reading({ startKm: 0, stopKm: 20 }))).toBe(20);
  });
  it('incomplete or inverted readings are 0', () => {
    expect(readingDistance(reading({ startKm: 100 }))).toBe(0);
    expect(readingDistance(reading({ startKm: 150, stopKm: 100 }))).toBe(0);
    expect(readingDistance(reading({}))).toBe(0);
  });
});

describe('readingAmount = distance x current rate', () => {
  it('matches the spec examples', () => {
    expect(readingAmount(reading({ distanceKm: 12.5 }), 3)).toBe(37.5);
    expect(readingAmount(reading({ startKm: 100, stopKm: 150 }), 3)).toBe(150);
  });
  it('re-prices when the rate changes and rounds to paise', () => {
    expect(readingAmount(reading({ distanceKm: 12.5 }), 4)).toBe(50);
    expect(readingAmount(reading({ distanceKm: 3.333 }), 3)).toBe(10);
  });
});

describe('rate input', () => {
  it('accepts whole rupees', () => {
    expect(parseRate('4')).toEqual({ ok: true, value: 4, rounded: false });
    expect(parseRate(' 12 ')).toEqual({ ok: true, value: 12, rounded: false });
  });
  it('rounds decimals to a whole number (backend takes an int)', () => {
    expect(parseRate('3.5')).toEqual({ ok: true, value: 4, rounded: true });
    expect(parseRate('3.4')).toEqual({ ok: true, value: 3, rounded: true });
  });
  it('rejects empty, non numeric, zero and negative', () => {
    for (const bad of ['', 'abc', '0', '-1', '0.4', '1e3', '--']) {
      expect(parseRate(bad)).toEqual({ ok: false, error: 'Please enter a valid rate' });
    }
  });
  it('shows the default until the server returns a positive rate', () => {
    expect(effectiveRate(undefined)).toBe(DEFAULT_RATE_PER_KM);
    expect(effectiveRate(0)).toBe(DEFAULT_RATE_PER_KM);
    expect(effectiveRate(5)).toBe(5);
  });
});

describe('date filter', () => {
  const rows = [{ date: '2025-01-05' }, { date: '2025-01-06' }, { date: '2025-01-05' }];
  it('compares IST calendar dates', () => {
    expect(filterByDate(rows, '2025-01-05')).toHaveLength(2);
    expect(filterByDate(rows, '')).toHaveLength(3);
    expect(filterByDate(rows, '2025-02-01')).toHaveLength(0);
    expect(recordsLabel(2, 3)).toBe('2 of 3 records');
  });
});
