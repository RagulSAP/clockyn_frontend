/** Worked examples taken from the §14 acceptance checklists of the reports specs (06_admin_reports). */
import { day, month, request, staff } from '../../testing/fixtures';
import type { SavedReport } from '../../types';
import { countRequests } from '../attendanceMath';
import { addToHistory } from '../history';
import { reportMonth } from '../monthRange';
import { computePayTotals, rowsFromMonthlyList, unpaidIds } from '../monthlySalary';
import { formatOtAmount, mergeOvertime, toOvertimeExportRows } from '../overtime';
import { applySalaryTypes, formatCountCell, formatMoneyCell, salaryTypeLabel, zeroRowFromStaff } from '../salarySheet';
import { assignedCount, groupStaffByShift } from '../shiftReport';
import { buildStaffDetailedRow } from '../staffDetailed';

describe('staff detailed report (spec §14 examples)', () => {
  const m = reportMonth(2026, 10);

  it('combines every counter rule in one row', () => {
    const row = buildStaffDetailedRow({
      staff: staff({ userId: 'u1' }),
      attendance: month(
        [
          day({ date: '2026-10-05', status: 'present', totalHours: undefined, rawExtra: { total_hours: '08:30' } }),
          day({ date: '2026-10-06', status: 'late', totalHours: undefined, rawExtra: { total_hours: '08:30' } }),
          day({ date: '2026-10-07', status: 'half_day' }),
          day({ date: '2026-10-08', status: 'half_day' }),
        ],
        { presentDays: 20, lateDays: 1 },
      ),
      workingDays: 26,
      requests: [
        request({
          type: 'leave',
          dateStatuses: { '2026-10-03': { status: 'approved' }, '2026-10-04': { status: 'rejected' }, '2026-11-01': { status: 'approved' } },
        }),
        request({ type: 'leave', id: 'r2', dateStatuses: { '2026-10-09': { status: 'approved' }, '2026-10-10': { status: 'approved' } } }),
        request({ type: 'shift_change', id: 'r3', shiftChangeDate: '2026-10-12', raw: { request_type: 'shift_change' } }),
      ],
      month: m,
    });
    expect(row.workingDays).toBe(26);
    expect(row.present).toBe(20);
    expect(row.leave).toBe(3); // approved leave DATES inside the month (the November date is ignored)
    expect(row.absent).toBe(3); // 26 - 20 - 3
    expect(row.halfDay).toBe(2);
    expect(row.hoursWorked).toBe('17h 0m'); // "08:30" on two days
    expect(row).toMatchObject({ leaveApproved: 3, leaveRejected: 1, leavePending: 0, shiftPending: 1, shiftApproved: 0 });
  });

  it('absent never goes negative', () => {
    const row = buildStaffDetailedRow({ staff: staff(), attendance: month([], { presentDays: 30 }), workingDays: 26, requests: [], month: m });
    expect(row.absent).toBe(0);
  });

  it('a request without a request-level status counts as pending (it is not derived from the per-date decisions)', () => {
    const permission = request({
      type: 'permission',
      status: 'approved', // DTO status derived from the date decisions
      raw: { request_type: 'permission' },
      dateStatuses: { '2026-10-07': { status: 'approved' } },
    });
    expect(countRequests([permission], '2026-10').permission).toEqual({ approved: 0, rejected: 0, pending: 1 });
    const shift = request({ type: 'shift_change', status: 'pending', raw: { request_type: 'shift_change' }, shiftChangeDate: '2026-10-12' });
    expect(countRequests([shift], '2026-10').shift.pending).toBe(1);
  });

  it('IST month math: 2026-10 has 31 days / 4 Sundays; Feb 2028 is a leap month', () => {
    expect(m).toMatchObject({ days: 31, sundays: 4, start: '2026-10-01', end: '2026-10-31', prefix: '2026-10' });
    expect(reportMonth(2028, 2)).toMatchObject({ days: 29, end: '2028-02-29' });
  });
});

describe('overtime report (spec §14 examples)', () => {
  it('150 min / 3 days / Rs 900 give 3, 2h 30m, ₹900 with the OT flag; others are dashes', () => {
    const rows = mergeOvertime(
      [staff({ userId: 'a', name: 'A' }), staff({ userId: 'b', name: 'B' })],
      [{ userId: 'a', otDays: 3, otMinutes: 150, otAmount: 900 }],
    );
    expect(rows[0]).toMatchObject({ otDays: 3, otHours: '2h 30m', hasOt: true });
    expect(formatOtAmount(rows[0].otAmount)).toBe('₹900');
    const exported = toOvertimeExportRows(rows);
    expect(exported[0]).toMatchObject({ days: 3, otHours: '2h 30m', amount: '₹900' });
    expect(exported[1]).toMatchObject({ days: '—', otHours: '—', amount: '—' });
  });
});

describe('employee shift report (spec §14 examples)', () => {
  const shifts = [1, 2, 3].map((id) => ({ id, name: `S${id}`, startTime: '09:00', endTime: '18:00', isActive: true, raw: {} }));
  const people = Array.from({ length: 20 }, (_, i) => staff({ userId: `u${i}` }));

  it('3 shifts and 20 staff of which 15 have valid shift ids give 3 / 15 / 5', () => {
    const map = new Map<string, number | undefined>();
    people.slice(0, 15).forEach((p, i) => map.set(p.userId, (i % 3) + 1));
    people.slice(15, 17).forEach((p) => map.set(p.userId, 99)); // unknown shift id
    const data = groupStaffByShift(shifts, people, map);
    expect(data.groups).toHaveLength(3);
    expect(assignedCount(data)).toBe(15);
    expect(data.unassigned).toHaveLength(5);
  });

  it('a duplicated staff id is listed and counted once', () => {
    const data = groupStaffByShift(
      shifts,
      [people[0], people[0], people[1]],
      new Map([
        ['u0', 1],
        ['u1', 1],
      ]),
    );
    expect(data.groups[0].staff.map((s) => s.userId)).toEqual(['u0', 'u1']);
  });
});

describe('salary sheet / monthly salary (spec §14 examples)', () => {
  it('formats cells like v1: en-IN grouping, dash for zero, plain count', () => {
    expect(formatMoneyCell(123456)).toBe('₹1,23,456');
    expect(formatMoneyCell(0)).toBe('—');
    expect(formatMoneyCell(null)).toBe('—');
    expect(formatCountCell(3)).toBe('3');
    expect(formatCountCell(0)).toBe('—');
  });

  it('"All Types" override changes every row, a later per-row override wins, labels follow the v1 map', () => {
    const base = ['a', 'b'].map((id) => zeroRowFromStaff(staff({ userId: id })));
    const all = applySalaryTypes(base, {}, 'HOURLY');
    expect(all.map((r) => r.salaryType)).toEqual(['HOURLY', 'HOURLY']);
    const mixed = applySalaryTypes(base, { a: 'WEEKLY' }, 'HOURLY');
    expect(mixed.map((r) => salaryTypeLabel(r.salaryType))).toEqual(['Weekly', 'Hourly']);
    expect(mixed[0].netSalary).toBe(base[0].netSalary); // amounts are never recomputed
    expect(salaryTypeLabel('CUSTOM_X')).toBe('CUSTOM_X');
  });

  it('progress is round(paid/total*100); Pay All sends every unpaid id once in list order', () => {
    const rows = rowsFromMonthlyList(
      ['a', 'b', 'c'].map((id, i) => ({
        userId: id,
        name: id,
        empId: id,
        deptName: '',
        branchName: '',
        salaryType: 'MONTHLY_FIXED',
        basicSalary: 0,
        netSalary: (i + 1) * 1000,
        paid: id === 'a',
        paidDate: null,
      })),
    );
    const totals = computePayTotals(rows, new Set(), true);
    expect(totals).toMatchObject({ total: 3, paid: 1, unpaid: 2, paidPct: 33, totalAmount: 6000, unpaidAmount: 5000 });
    expect(unpaidIds(rows, new Set())).toEqual(['b', 'c']);
    expect(computePayTotals([], new Set(), true).paidPct).toBe(0);
  });
});

describe('saved-report history (web blob URLs)', () => {
  const entry = (n: number, over: Partial<SavedReport> = {}): SavedReport => ({
    id: `id${n}`,
    name: `R${n}`,
    uri: `blob:http://x/${n}`,
    filename: 'staff_report_Oct_2026.csv',
    mimeType: 'text/csv',
    date: new Date(2026, 0, 1, 0, n).toISOString(),
    ...over,
  });

  it('re-exporting the same file name replaces the older entry even though the blob URL is new', () => {
    const { list, evicted } = addToHistory([entry(1), entry(2, { filename: 'other.csv' })], entry(3));
    expect(list.map((e) => e.id)).toEqual(['id3', 'id2']);
    expect(evicted.map((e) => e.id)).toEqual(['id1']);
  });
});
