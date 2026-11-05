import { day, month, staff } from '../../testing/fixtures';
import { buildLateRows, evaluateLateDay, formatLateBy, LATE_EXPORT_COLUMNS, punchInMinutes, toLateExportRows } from '../lateRule';

describe('formatLateBy', () => {
  it('formats minutes, hours and unknown values', () => {
    expect(formatLateBy(12)).toBe('12 min');
    expect(formatLateBy(75)).toBe('1h 15m');
    expect(formatLateBy(60)).toBe('1h 0m');
    expect(formatLateBy(0)).toBe('—');
    expect(formatLateBy(null)).toBe('—');
  });
});

describe('late rule', () => {
  const shift = { shift_start_time: '09:00AM', shift_end_time: '06:00PM' };

  it('is late when punch-in is more than one minute after the shift start', () => {
    const ev = evaluateLateDay(day({ punchIn: '09:12', rawExtra: shift }));
    expect(ev.isLate).toBe(true);
    expect(ev.lateMinutes).toBe(12);
    // spec: times that already carry AM/PM are displayed unchanged
    expect(ev.shiftStart).toBe('09:00AM');
    expect(ev.shiftEnd).toBe('06:00PM');
    expect(ev.punchIn).toBe('09:12 AM');
  });

  it('formats 24h shift times as hh:mm AM/PM and shows ISO punch-ins in IST', () => {
    const ev = evaluateLateDay(day({ punchIn: undefined, rawExtra: { punch_in: '2026-10-05T04:00:00Z', shift_start_time: '09:00:00', shift_end_time: '18:00:00' } }));
    expect(ev.shiftStart).toBe('09:00 AM');
    expect(ev.shiftEnd).toBe('06:00 PM');
    expect(ev.punchIn).toBe('09:30 AM');
    expect(ev.lateMinutes).toBe(30);
  });

  it('spec examples: 75 min late = 1h 15m, exactly 60 = 1h 0m', () => {
    expect(evaluateLateDay(day({ punchIn: '10:15', rawExtra: shift })).lateMinutes).toBe(75);
    expect(formatLateBy(75)).toBe('1h 15m');
    expect(formatLateBy(60)).toBe('1h 0m');
  });

  it('tolerates a one-minute difference unless the server says late', () => {
    expect(evaluateLateDay(day({ punchIn: '09:01', rawExtra: shift })).isLate).toBe(false);
    expect(evaluateLateDay(day({ punchIn: '09:01', status: 'late', rawExtra: shift })).isLate).toBe(true);
    expect(evaluateLateDay(day({ punchIn: '09:02', rawExtra: shift })).isLate).toBe(true);
  });

  it('understands 24h shift times and ISO punch-in timestamps (IST)', () => {
    const ev = evaluateLateDay(day({ punchIn: undefined, rawExtra: { punch_in: '2026-10-05T09:30:00+05:30', shift_start_time: '09:00:00' } }));
    expect(ev.isLate).toBe(true);
    expect(ev.lateMinutes).toBe(30);
  });

  it('without shift times only `late` days qualify and "Late By" / shift cells are "—" (v1 printed the punch clock as a duration)', () => {
    const late = evaluateLateDay(day({ punchIn: '09:12', status: 'late' }));
    expect(late.isLate).toBe(true);
    expect(late.lateMinutes).toBeNull();
    expect(formatLateBy(late.lateMinutes)).toBe('—');
    expect(late.shiftStart).toBe('—');
    expect(late.shiftEnd).toBe('—');
    expect(evaluateLateDay(day({ punchIn: '09:12' })).isLate).toBe(false);
  });

  it('a missing punch-in shows --:-- and has no minutes', () => {
    const ev = evaluateLateDay(day({ punchIn: undefined, status: 'late', rawExtra: shift }));
    expect(ev.punchIn).toBe('--:--');
    expect(ev.lateMinutes).toBeNull();
  });

  it('punchInMinutes reads HH:mm', () => {
    expect(punchInMinutes(day({ punchIn: '14:05' }))).toBe(14 * 60 + 5);
    expect(punchInMinutes(day({ punchIn: undefined }))).toBeNull();
  });
});

describe('buildLateRows', () => {
  const a = staff({ userId: 'a', name: 'Zed', empId: 'E2' });
  const b = staff({ userId: 'b', name: 'Amy', empId: 'E3', branch: '', department: '' });
  const shift = { shift_start_time: '09:00AM' };

  it('creates one row per late day, sorted by real date then name (not by the formatted label)', () => {
    const rows = buildLateRows(
      [a, b],
      new Map([
        ['a', month([day({ date: '2026-10-12', punchIn: '09:30', rawExtra: shift }), day({ date: '2026-10-02', punchIn: '09:10', rawExtra: shift })])],
        ['b', month([day({ date: '2026-10-02', punchIn: '09:45', rawExtra: shift }), day({ date: '2026-10-03', punchIn: '08:55', rawExtra: shift })])],
      ]),
    );
    expect(rows.map((r) => `${r.date}|${r.name}`)).toEqual(['2026-10-02|Amy', '2026-10-02|Zed', '2026-10-12|Zed']);
    expect(rows[0].dateLabel).toBe('02-Oct-2026');
    expect(rows[0].branch).toBe('-');
    expect(rows[0].lateBy).toBe('45 min');
  });

  it('skips staff without attendance and maps the 9 export columns', () => {
    const rows = buildLateRows([a], new Map());
    expect(rows).toEqual([]);
    expect(LATE_EXPORT_COLUMNS.map((c) => c.title)).toEqual(['Name', 'Emp ID', 'Branch', 'Dept', 'Date', 'Shift Start', 'Shift End', 'Punch In', 'Late By']);
    const [row] = toLateExportRows(buildLateRows([a], new Map([['a', month([day({ status: 'late', punchIn: '09:20' })])]])));
    expect(LATE_EXPORT_COLUMNS.map((c) => row[c.key])).toEqual(['Zed', 'E2', 'HQ', 'Sales', '05-Oct-2026', '—', '—', '09:20 AM', '—']);
  });
});
