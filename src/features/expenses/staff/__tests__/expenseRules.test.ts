import type { Expense, OdometerReading } from '@/types/api/expenses';

import {
  canGoNext,
  clampToToday,
  expensesOnDate,
  nextDate,
  odometerMode,
  openReading,
  parseExpenseAmount,
  prevDate,
  roundedTotal,
  submitExpenseWithPhoto,
  submitOdometerReading,
  totalAmount,
  validateExpenseAmount,
  validateOdometerKm,
} from '../utils/expenseRules';

const TODAY = '2026-10-18';

const expense = (amount: number, date = TODAY): Expense => ({ id: String(amount), expenseId: String(amount), date, type: 'travel', amount, status: 'pending', raw: {} });
const reading = (over: Partial<OdometerReading>): OdometerReading => ({ id: 'r', readingId: 'r', date: TODAY, status: 'pending', raw: {}, ...over });

describe('date navigation', () => {
  it('previous day crosses month boundaries', () => {
    expect(prevDate('2026-10-01')).toBe('2026-09-30');
  });

  it('next day is clamped to today', () => {
    expect(nextDate('2026-10-17', TODAY)).toBe(TODAY);
    expect(nextDate(TODAY, TODAY)).toBe(TODAY);
    expect(nextDate('2026-10-30', TODAY)).toBe(TODAY);
    expect(canGoNext('2026-10-17', TODAY)).toBe(true);
    expect(canGoNext(TODAY, TODAY)).toBe(false);
  });

  it('a picked future date is clamped', () => {
    expect(clampToToday('2026-12-01', TODAY)).toBe(TODAY);
    expect(clampToToday('2026-10-01', TODAY)).toBe('2026-10-01');
  });
});

describe('amount and reading validation', () => {
  it('amounts must be positive with at most 2 decimals', () => {
    expect(validateExpenseAmount('150.5')).toBeNull();
    expect(validateExpenseAmount('0')).not.toBeNull();
    expect(validateExpenseAmount('-5')).not.toBeNull();
    expect(validateExpenseAmount('abc')).not.toBeNull();
    expect(validateExpenseAmount('1.234')).not.toBeNull();
    expect(validateExpenseAmount('.')).not.toBeNull();
    expect(parseExpenseAmount('150.50')).toBe(150.5);
    expect(parseExpenseAmount('12abc')).toBeNull();
  });

  it('odometer readings: numeric, non-negative, stop not below start', () => {
    expect(validateOdometerKm('12000', 'start')).toBeNull();
    expect(validateOdometerKm('abc', 'start')).toBe('Enter a valid odometer reading');
    expect(validateOdometerKm('-1', 'start')).toBe('Enter a valid odometer reading');
    expect(validateOdometerKm('11999', 'stop', 12000)).toBe('Stop reading cannot be less than the start reading');
    expect(validateOdometerKm('12000', 'stop', 12000)).toBeNull();
    expect(validateOdometerKm('12040.5', 'stop', 12000)).toBeNull();
    expect(validateOdometerKm('5', 'stop')).toBeNull();
  });
});

describe('totals', () => {
  it('rounds the total to whole rupees, rows stay raw', () => {
    const list = [expense(100), expense(50.5)];
    expect(totalAmount(list)).toBe(150.5);
    expect(roundedTotal(list)).toBe(151);
    expect(roundedTotal([])).toBe(0);
  });

  it('keeps only the rows of the date', () => {
    expect(expensesOnDate([expense(1, TODAY), expense(2, '2026-10-17')], TODAY)).toHaveLength(1);
  });
});

describe('odometer mode', () => {
  it('is stop while a reading has a start but no stop', () => {
    expect(odometerMode([], TODAY)).toBe('start');
    expect(odometerMode([reading({ startKm: 100 })], TODAY)).toBe('stop');
    expect(odometerMode([reading({ startKm: 100, stopKm: 140 })], TODAY)).toBe('start');
  });

  it('finds an open trip even when an earlier trip of the day is complete (v1 only looked at the first)', () => {
    const readings = [reading({ id: 'a', startKm: 100, stopKm: 140 }), reading({ id: 'b', startKm: 150 })];
    expect(openReading(readings, TODAY)?.id).toBe('b');
    expect(odometerMode(readings, TODAY)).toBe('stop');
  });

  it('treats a start of 0 as recorded and ignores other dates', () => {
    expect(odometerMode([reading({ startKm: 0 })], TODAY)).toBe('stop');
    expect(odometerMode([reading({ startKm: 100, date: '2026-10-17' })], TODAY)).toBe('start');
  });
});

describe('submitExpenseWithPhoto (record first, then photo)', () => {
  it('creates the record and then uploads its photo', async () => {
    const calls: string[] = [];
    const out = await submitExpenseWithPhoto({
      create: async () => {
        calls.push('create');
        return { expenseId: 'E1' };
      },
      upload: async (id) => {
        calls.push(`upload:${id}`);
      },
    });
    expect(calls).toEqual(['create', 'upload:E1']);
    expect(out).toEqual({ status: 'ok', expenseId: 'E1' });
  });

  it('a failing create throws and uploads nothing', async () => {
    const upload = jest.fn();
    await expect(
      submitExpenseWithPhoto({
        create: async () => {
          throw new Error('Failed to submit expense');
        },
        upload,
      }),
    ).rejects.toThrow('Failed to submit expense');
    expect(upload).not.toHaveBeenCalled();
  });

  it('a failing upload is reported with the record id (no silent orphan) and a retry only re-uploads', async () => {
    const create = jest.fn(async () => ({ expenseId: 'E7' }));
    const failing = jest.fn(async () => {
      throw new Error('Upload timed out');
    });
    const first = await submitExpenseWithPhoto({ create, upload: failing });
    expect(first.status).toBe('photo_failed');
    expect(first.expenseId).toBe('E7');

    const upload = jest.fn(async () => undefined);
    const retry = await submitExpenseWithPhoto({ create, upload }, first.expenseId);
    expect(retry).toEqual({ status: 'ok', expenseId: 'E7' });
    expect(create).toHaveBeenCalledTimes(1); // no duplicate record
    expect(upload).toHaveBeenCalledWith('E7');
  });

  it('refuses to upload when the server returned no expense id', async () => {
    const upload = jest.fn();
    await expect(submitExpenseWithPhoto({ create: async () => ({ expenseId: '' }), upload })).rejects.toThrow(/expense id/);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('submitOdometerReading (photo first, then record)', () => {
  it('uploads the photo before writing the record', async () => {
    const calls: string[] = [];
    const result = await submitOdometerReading({
      uploadPhoto: async () => {
        calls.push('photo');
      },
      record: async () => {
        calls.push('record');
        return 42;
      },
    });
    expect(calls).toEqual(['photo', 'record']);
    expect(result).toBe(42);
  });

  it('writes no record when the photo upload fails and surfaces the message', async () => {
    const record = jest.fn();
    await expect(
      submitOdometerReading({
        uploadPhoto: async () => {
          throw new Error('Upload timed out');
        },
        record,
      }),
    ).rejects.toThrow('Upload timed out');
    expect(record).not.toHaveBeenCalled();
  });
});
