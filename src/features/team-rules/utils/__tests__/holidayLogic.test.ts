import type { Holiday } from '@/types/api/system';

import { describeBatchFailure, runBatch } from '../batch';
import {
  computeEditDiff,
  dayOfMonth,
  filterHolidays,
  groupHolidays,
  holidayDateLabel,
  holidayYearRange,
  inMonth,
  isWeeklyOffDate,
  offDayDates,
  offDaysSummary,
  offDaysSubtitle,
  selectedDateLabel,
  splitDuplicateDates,
  toggleDate,
  toggleOffDay,
} from '../holidayLogic';

let nextId = 1;
const h = (date: string, name: string, extra: Partial<Holiday> = {}): Holiday => ({
  id: nextId++,
  name,
  date,
  branchName: null,
  deptName: null,
  blockAttendance: true,
  ...extra,
});

describe('weekly offs and calendar dates', () => {
  it('uses Monday = 0 ... Sunday = 6', () => {
    // 2026-10-18 is a Sunday, 2026-10-19 a Monday.
    expect(isWeeklyOffDate('2026-10-18', [6])).toBe(true);
    expect(isWeeklyOffDate('2026-10-19', [6])).toBe(false);
    expect(isWeeklyOffDate('2026-10-19', [0])).toBe(true);
    expect(isWeeklyOffDate('not-a-date', [0, 1, 2, 3, 4, 5, 6])).toBe(false);
  });

  it('lists every off day of a month', () => {
    expect(offDayDates(2026, 10, [6])).toEqual(['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
    expect(offDayDates(2026, 10, [])).toEqual([]);
    // Saturdays + Sundays in February 2028 (leap year, 29 days)
    expect(offDayDates(2028, 2, [5, 6])).toHaveLength(8);
  });

  it('parses date-only strings without day shifts (the date is the date in every time zone)', () => {
    expect(dayOfMonth('2026-03-01')).toBe(1);
    expect(dayOfMonth('2026-12-31')).toBe(31);
    expect(holidayDateLabel('2026-03-01')).toBe('01 Mar 2026');
    expect(selectedDateLabel('2026-12-05')).toBe('05 December 2026');
    expect(inMonth('2026-03-31', 2026, 3)).toBe(true);
    expect(inMonth('2026-04-01', 2026, 3)).toBe(false);
  });

  it('keeps a multi-date selection sorted and toggles dates', () => {
    expect(toggleDate(['2026-10-05'], '2026-10-02')).toEqual(['2026-10-02', '2026-10-05']);
    expect(toggleDate(['2026-10-02', '2026-10-05'], '2026-10-02')).toEqual(['2026-10-05']);
  });

  it('offers the previous year to four years ahead (6 values)', () => {
    const [from, to] = holidayYearRange(2026);
    expect(from).toBe(2025);
    expect(to).toBe(2030);
    expect(to - from + 1).toBe(6);
  });

  it('describes the off days', () => {
    expect(offDaysSummary([])).toBe('No off days — all days are working days');
    expect(offDaysSummary([6, 5])).toBe('Off: Sat, Sun');
    expect(offDaysSubtitle([])).toBe('No off days set');
    expect(offDaysSubtitle([6])).toBe('Sun');
    expect(toggleOffDay([6], 5)).toEqual([5, 6]);
    expect(toggleOffDay([5, 6], 6)).toEqual([5]);
  });
});

describe('filterHolidays', () => {
  const list = [
    h('2026-10-02', 'Org wide'),
    h('2026-10-03', 'Pune only', { branchName: 'Pune' }),
    h('2026-10-04', 'Sales only', { deptName: 'Sales' }),
    h('2026-10-05', 'Mumbai sales', { branchName: 'Mumbai', deptName: 'Sales' }),
  ];

  it('shows everything without filters', () => {
    expect(filterHolidays(list, '', '')).toHaveLength(4);
  });

  it('always keeps organisation-wide holidays and matches the chosen scope', () => {
    expect(filterHolidays(list, 'Pune', '').map((x) => x.name)).toEqual(['Org wide', 'Pune only', 'Sales only']);
    // 'Pune only' has no department, so it is organisation-wide for the department filter.
    expect(filterHolidays(list, '', 'Sales').map((x) => x.name)).toEqual(['Org wide', 'Pune only', 'Sales only', 'Mumbai sales']);
    expect(filterHolidays(list, '', 'Ops').map((x) => x.name)).toEqual(['Org wide', 'Pune only']);
    expect(filterHolidays(list, 'Mumbai', 'Sales').map((x) => x.name)).toEqual(['Org wide', 'Sales only', 'Mumbai sales']);
  });
});

describe('groupHolidays', () => {
  it('groups per-date rows by name, scope and punch policy, ordered by earliest date', () => {
    const rows = [
      h('2026-10-20', 'Diwali'),
      h('2026-10-02', 'Gandhi Jayanti'),
      h('2026-10-21', 'Diwali'),
      h('2026-10-19', 'Diwali', { branchName: 'Pune' }),
      h('2026-10-22', 'Diwali', { blockAttendance: false }),
    ];
    const groups = groupHolidays(rows);
    expect(groups.map((g) => [g.name, g.branchName, g.entries.length, g.blockAttendance])).toEqual([
      ['Gandhi Jayanti', null, 1, true],
      ['Diwali', 'Pune', 1, true],
      ['Diwali', null, 2, true],
      ['Diwali', null, 1, false],
    ]);
    expect(groups[2].entries.map((e) => e.date)).toEqual(['2026-10-20', '2026-10-21']);
    expect(groups[2].firstDate).toBe('2026-10-20');
  });
});

describe('computeEditDiff', () => {
  it('splits records into update / delete / add (edit-as-diff)', () => {
    const entries = [h('2026-10-05', 'X'), h('2026-10-06', 'X')];
    const diff = computeEditDiff(entries, ['2026-10-05', '2026-10-07']);
    expect(diff.toUpdate.map((e) => e.date)).toEqual(['2026-10-05']);
    expect(diff.toDelete.map((e) => e.date)).toEqual(['2026-10-06']);
    expect(diff.toAdd).toEqual(['2026-10-07']);
  });
});

describe('splitDuplicateDates', () => {
  const existing = [h('2026-10-05', 'Diwali'), h('2026-10-06', 'Diwali', { branchName: 'Pune' })];

  it('flags dates that already carry the same holiday with the same scope', () => {
    const r = splitDuplicateDates(['2026-10-05', '2026-10-06', '2026-10-07'], existing, { name: ' diwali ', branchName: null, deptName: null });
    expect(r.duplicates).toEqual(['2026-10-05']);
    expect(r.fresh).toEqual(['2026-10-06', '2026-10-07']);
  });
});

describe('batch results (no success toast when the server rejected a request)', () => {
  it('reports every outcome', async () => {
    const result = await runBatch([
      { label: '05 Oct 2026', run: () => Promise.resolve('ok') },
      { label: '06 Oct 2026', run: () => Promise.reject(new Error('Holiday already exists')) },
    ]);
    expect(result).toMatchObject({ total: 2, succeeded: 1 });
    expect(result.failures).toEqual([{ label: '06 Oct 2026', message: 'Holiday already exists' }]);
    expect(describeBatchFailure(result, 'Update')).toBe('Update: 1 of 2 succeeded. 06 Oct 2026: Holiday already exists');
  });

  it('returns null when everything succeeded and the server message when everything failed', async () => {
    const ok = await runBatch([{ label: 'a', run: () => Promise.resolve(1) }]);
    expect(describeBatchFailure(ok, 'Delete')).toBeNull();
    const bad = await runBatch([{ label: 'a', run: () => Promise.reject(new Error('Not allowed')) }]);
    expect(describeBatchFailure(bad, 'Delete')).toBe('Not allowed');
    const two = await runBatch([
      { label: 'a', run: () => Promise.reject(new Error('Nope')) },
      { label: 'b', run: () => Promise.reject(new Error('Nope')) },
    ]);
    expect(describeBatchFailure(two, 'Delete')).toBe('Delete failed: Nope');
  });
});
