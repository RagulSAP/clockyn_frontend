import type { StaffProfile } from '@/types/api/staff';
import type { Shift } from '@/types/api/shifts';
import { staff } from '../../testing/fixtures';
import { REPORT_CATALOGUE, routeFor } from '../catalogue';
import { buildProfileHtml, filterDirectory, hasValue, profileErrorMessage, profileSections } from '../employeeProfile';
import {
  allUnpaidSelected,
  computePayTotals,
  dedupeByUserId,
  isPaid,
  pruneSelection,
  rowsFromMonthlyList,
  rowsFromStaff,
  unpaidIds,
} from '../monthlySalary';
import { applySalaryTypes, formatCountCell, formatMoneyCell, salarySubline, salaryTypeLabel, zeroRowFromStaff } from '../salarySheet';
import { assignedCount, filterShiftStaff, groupStaffByShift, shiftDuration, shiftTimeRange } from '../shiftReport';

const NONE = new Set<string>();

describe('monthly salary model', () => {
  const people = [staff({ userId: 'a', name: 'A' }), staff({ userId: 'b', name: 'B', isActive: false }), staff({ userId: 'a', name: 'A dup' })];

  it('de-duplicates rows by user id (counts and list agree)', () => {
    expect(dedupeByUserId(people).map((p) => p.name)).toEqual(['A', 'B']);
    expect(rowsFromStaff(people, null)).toHaveLength(2);
  });

  it('derives paid state from the server list when available', () => {
    const rows = rowsFromMonthlyList([
      { userId: 'a', name: 'A', empId: 'E1', deptName: 'Ops', branchName: '', salaryType: '', basicSalary: 100, netSalary: 90, paid: true, paidDate: null },
      { userId: 'b', name: 'B', empId: 'E2', deptName: '', branchName: '', salaryType: '', basicSalary: 100, netSalary: 60, paid: false, paidDate: null },
    ]);
    expect(isPaid(rows[0], NONE)).toBe(true);
    expect(isPaid(rows[1], NONE)).toBe(false);
    expect(isPaid(rows[1], new Set(['b']))).toBe(true); // marked in this session
    const t = computePayTotals(rows, NONE, true);
    expect(t).toMatchObject({ total: 2, paid: 1, unpaid: 1, paidPct: 50, totalAmount: 150, unpaidAmount: 60 });
  });

  it('computes totals from the salary breakdown when only the staff list is available', () => {
    const rows = rowsFromStaff(people.slice(0, 2), [{ userId: 'a', netSalary: 1000 } as never, { userId: 'b', netSalary: 500 } as never]);
    expect(rows.map((r) => r.net)).toEqual([1000, 500]);
    expect(computePayTotals(rows, new Set(['a']), true)).toMatchObject({ totalAmount: 1500, unpaidAmount: 500, paid: 1 });
  });

  it('reports amounts as unavailable (null) only when no source exists', () => {
    const rows = rowsFromStaff(people.slice(0, 2), null);
    expect(computePayTotals(rows, NONE, false)).toMatchObject({ totalAmount: null, unpaidAmount: null });
    expect(computePayTotals([], NONE, true)).toMatchObject({ paidPct: 0, total: 0, totalAmount: 0 });
  });

  it('Pay All sends every unpaid id once; a row paid on its own leaves the selection', () => {
    const rows = rowsFromStaff(people, null);
    const local = new Set(['a']);
    expect(unpaidIds(rows, local)).toEqual(['b']);
    expect([...pruneSelection(new Set(['a', 'b']), rows, local)]).toEqual(['b']);
    expect(allUnpaidSelected(rows, local, new Set(['b']))).toBe(true);
    expect(allUnpaidSelected(rows, new Set(['a', 'b']), new Set())).toBe(false);
  });
});

describe('salary sheet helpers', () => {
  it('labels salary types and shows unknown keys raw', () => {
    expect(salaryTypeLabel('MONTHLY_FIXED')).toBe('Monthly');
    expect(salaryTypeLabel('DAILY_WAGES')).toBe('Daily');
    expect(salaryTypeLabel('CUSTOM')).toBe('CUSTOM');
    expect(salaryTypeLabel('')).toBe('—');
  });

  it('formats cells: ₹ with Indian grouping, plain counts, — for zero', () => {
    expect(formatMoneyCell(123456)).toBe('₹1,23,456');
    expect(formatMoneyCell(0)).toBe('—');
    expect(formatCountCell(12)).toBe('12');
    expect(formatCountCell(0)).toBe('—');
  });

  it('applies per-row and all-staff type overrides without touching amounts', () => {
    const a = { ...zeroRowFromStaff(staff({ userId: 'a' })), netSalary: 500 };
    const b = zeroRowFromStaff(staff({ userId: 'b' }));
    const out = applySalaryTypes([a, b], { a: 'HOURLY' }, null);
    expect(out.map((r) => r.salaryType)).toEqual(['HOURLY', 'MONTHLY_FIXED']);
    expect(out[0].netSalary).toBe(500);
    expect(applySalaryTypes([a, b], {}, 'WEEKLY').map((r) => r.salaryType)).toEqual(['WEEKLY', 'WEEKLY']);
  });

  it('builds the zero-row fallback and the sub-line', () => {
    const z = zeroRowFromStaff(staff({ roleId: 2, branch: 'HQ' }));
    expect(z).toMatchObject({ salaryType: 'MONTHLY_FIXED', roleName: 'Manager', netSalary: 0, basicSalary: 0 });
    expect(salarySubline({ roleName: '', branchName: '', empId: '' })).toBe('—');
    expect(salarySubline({ roleName: '', branchName: 'HQ', empId: 'E1' })).toBe('HQ');
  });
});

describe('employee profile report', () => {
  const profile: StaffProfile = {
    userId: 'u1',
    name: 'Tom <script>alert(1)</script>',
    empId: 'E7',
    mobile: '9999999999',
    email: '-',
    department: 'Ops',
    branch: '',
    roleName: 'Staff',
    dob: '2000-01-05',
    aadhaarNo: '1234',
    raw: {},
  };

  it('hides empty and "-" fields and drops sections without any field', () => {
    expect(hasValue('-')).toBe(false);
    expect(hasValue(' x ')).toBe(true);
    const sections = profileSections(profile);
    expect(sections.map((s) => s.title)).toEqual(['Contact Information', 'Personal Information', 'Identity Documents']);
    expect(sections[0].fields).toEqual([{ label: 'Mobile', value: '9999999999' }]);
    expect(sections[1].fields).toEqual([{ label: 'Date of Birth', value: '05 Jan 2000' }]);
  });

  it('escapes every dynamic value in the printable HTML', () => {
    const html = buildProfileHtml(profile, 'Acme & Co');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Tom &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Acme &amp; Co');
    expect(html).not.toContain('Bank Details');
  });

  it('shows a friendly message for inactive staff and a generic one otherwise', () => {
    expect(profileErrorMessage({ name: 'Ann', isActive: false }, '500 Failed to get staff profile')).toBe(
      'Ann is inactive. Profile details are only available for active staff.',
    );
    expect(profileErrorMessage({ name: 'Ann', isActive: true })).toBe('Failed to load employee details');
    expect(profileErrorMessage({ name: 'Ann', isActive: true }, 'Network request failed')).toBe('Network request failed');
  });

  it('searches name, id, department and branch (case-insensitive) and sorts A to Z', () => {
    const list = [staff({ userId: '1', name: 'Zoe', empId: 'A1' }), staff({ userId: '2', name: 'Abe', empId: 'B2', department: 'Finance' })];
    expect(filterDirectory(list, '').map((s) => s.name)).toEqual(['Abe', 'Zoe']);
    expect(filterDirectory(list, 'fin').map((s) => s.name)).toEqual(['Abe']);
    expect(filterDirectory(list, 'HQ').map((s) => s.name)).toEqual(['Abe', 'Zoe']);
    expect(filterDirectory(list, 'nobody')).toEqual([]);
  });
});

describe('shift report', () => {
  const shift = (id: number, startTime: string, endTime: string): Shift => ({ id, name: `S${id}`, startTime, endTime, isActive: true, raw: {} });
  const shifts = [shift(1, '09:00', '18:00'), shift(2, '22:00', '06:00')];
  const people = [staff({ userId: 'a' }), staff({ userId: 'b' }), staff({ userId: 'c' }), staff({ userId: 'd' })];

  it('groups staff by shift id; unknown ids, no shift and failed lookups are Unassigned', () => {
    const data = groupStaffByShift(shifts, people, new Map([['a', 1], ['b', 2], ['c', 99]]), new Set(['d']));
    expect(data.groups.map((g) => g.staff.map((s) => s.userId))).toEqual([['a'], ['b']]);
    expect(data.unassigned.map((s) => s.userId)).toEqual(['c', 'd']);
    expect(data.unknownCount).toBe(1);
    expect(assignedCount(data)).toBe(2);
  });

  it('formats time ranges and durations incl. overnight shifts', () => {
    expect(shiftTimeRange(shifts[0])).toBe('09:00 AM – 06:00 PM');
    expect(shiftDuration(shifts[0])).toBe('9h');
    expect(shiftDuration(shifts[1])).toBe('8h');
    expect(shiftDuration(shift(3, '09:00', '17:30'))).toBe('8h 30m');
    expect(shiftDuration(shift(4, '', '17:30'))).toBe('');
  });

  it('filters staff inside a card without changing counts', () => {
    const list = [staff({ userId: 'a', name: 'Ann' }), staff({ userId: 'b', name: 'Bob', department: 'Ops' })];
    expect(filterShiftStaff(list, 'ops').map((s) => s.name)).toEqual(['Bob']);
    expect(filterShiftStaff(list, '')).toHaveLength(2);
  });
});

describe('report catalogue', () => {
  it('has the 4 categories in order with the v1 enabled set for admins', () => {
    expect(REPORT_CATALOGUE.map((c) => c.title)).toEqual(['Attendance Reports', 'Salary Reports', 'Employee Reports', 'CRM']);
    const enabled = REPORT_CATALOGUE.flatMap((c) => c.rows.filter((r) => routeFor(r, 'admin')).map((r) => r.label));
    expect(enabled).toEqual([
      'Monthly Summary',
      'Staff-wise Detailed Report',
      'Late Report',
      'Overtime Report',
      'Monthly Salary',
      'View Staff Salary',
      'Employee Details',
      'Employee Shift / Timing',
    ]);
  });

  it('enables exactly 4 rows for the manager variant', () => {
    const enabled = REPORT_CATALOGUE.flatMap((c) => c.rows.filter((r) => routeFor(r, 'manager')).map((r) => r.label));
    expect(enabled).toEqual(['Monthly Summary', 'Late Report', 'Monthly Salary', 'View Staff Salary']);
  });
});
