import * as XLSX from 'xlsx';
import { buildCsv, CSV_BOM } from '@/lib/platform/exportFormats';
import { buildXlsxBytes } from '@/lib/platform/exportXlsx';
import { day, month, request, staff } from '../../testing/fixtures';
import { buildStaffDetailedRow, STAFF_DETAILED_COLUMNS, STAFF_DETAILED_EXPORT_COLUMNS, staffDetailedHeaderGroups, toStaffDetailedExportRows } from '../staffDetailed';
import { reportMonth } from '../monthRange';
import { countWithOvertime, mergeOvertime, OVERTIME_EXPORT_COLUMNS, toOvertimeExportRows } from '../overtime';
import { SALARY_EXPORT_COLUMNS, toSalaryExportRows, zeroRowFromStaff } from '../salarySheet';

describe('overtime merge', () => {
  const people = [staff({ userId: 'a', name: 'Bea' }), staff({ userId: 'b', name: 'Al' }), staff({ userId: 'c', name: 'Cy', branch: '', department: '' })];

  it('keeps every staff member, looks overtime up by user id and drops unknown users', () => {
    const rows = mergeOvertime(people, [
      { userId: 'a', otDays: 3, otMinutes: 150, otAmount: 900 },
      { userId: 'zzz', otDays: 9, otMinutes: 999, otAmount: 1 },
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['a', 'b', 'c']);
    expect(rows[0]).toMatchObject({ otDays: 3, otMinutes: 150, otAmount: 900, otHours: '2h 30m', hasOt: true });
    expect(rows[1]).toMatchObject({ otDays: 0, otHours: '—', hasOt: false });
    expect(rows[2]).toMatchObject({ branch: '—', dept: '—' });
    expect(countWithOvertime(rows)).toBe(1);
  });

  it('sorts by overtime minutes desc then name', () => {
    const rows = mergeOvertime(people, [
      { userId: 'b', otDays: 1, otMinutes: 45, otAmount: 0 },
      { userId: 'c', otDays: 1, otMinutes: 45, otAmount: 0 },
      { userId: 'a', otDays: 1, otMinutes: 120, otAmount: 0 },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Bea', 'Al', 'Cy']);
    expect(rows.map((r) => r.otHours)).toEqual(['2h', '45m', '45m']);
  });

  it('exports 7 columns with locale-independent amounts and "—" for no overtime', () => {
    const rows = mergeOvertime(people.slice(0, 2), [{ userId: 'a', otDays: 3, otMinutes: 150, otAmount: 1234567 }]);
    const exportRows = toOvertimeExportRows(rows);
    expect(OVERTIME_EXPORT_COLUMNS.map((c) => c.title)).toEqual(['Name', 'Emp ID', 'Branch', 'Department', 'OT Days', 'OT Hours', 'OT Amount']);
    expect(OVERTIME_EXPORT_COLUMNS.map((c) => exportRows[0][c.key])).toEqual(['Bea', 'E001', 'HQ', 'Sales', 3, '2h 30m', '₹12,34,567']);
    expect(OVERTIME_EXPORT_COLUMNS.map((c) => exportRows[1][c.key]).slice(4)).toEqual(['—', '—', '—']);
  });
});

describe('staff detailed table & export glue', () => {
  const m = reportMonth(2026, 10);
  const row = buildStaffDetailedRow({
    staff: staff({ name: 'Q "Quote", Jr', roleId: 2 }),
    attendance: month([day({ status: 'present', totalHours: 8.5 }), day({ date: '2026-10-06', status: 'late', totalHours: 7.75 })]),
    workingDays: 26,
    requests: [request({ type: 'leave', dateStatuses: { '2026-10-03': { status: 'approved' } } })],
    month: m,
  });

  it('derives the row (present includes late; absent subtracts approved leave; hours are decimal)', () => {
    expect(row).toMatchObject({ workingDays: 26, present: 2, late: 1, leave: 1, absent: 23, sundays: 4, hoursWorked: '16h 15m', roleName: 'Manager', halfDay: 0 });
  });

  it('has 17 data columns in 4 groups (8/3/3/3) and a spacer for the frozen column', () => {
    expect(STAFF_DETAILED_COLUMNS).toHaveLength(17);
    expect(staffDetailedHeaderGroups()).toEqual([
      { title: '', span: 1 },
      { title: 'Attendance', span: 8 },
      { title: 'Leave Requests', span: 3 },
      { title: 'Permission Requests', span: 3 },
      { title: 'Shift Change', span: 3 },
    ]);
  });

  it('maps 22 export columns to CSV with BOM and RFC-4180 escaping', () => {
    expect(STAFF_DETAILED_EXPORT_COLUMNS).toHaveLength(22);
    const csv = buildCsv(STAFF_DETAILED_EXPORT_COLUMNS, toStaffDetailedExportRows([row]));
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0].split(',')).toHaveLength(22);
    expect(lines[1]).toContain('"Q ""Quote"", Jr"');
    expect(lines[1]).toContain('16h 15m');
  });

  it('maps the same columns to a real .xlsx workbook', async () => {
    const bytes = await buildXlsxBytes({ sheetName: 'Staff Detailed Report', columns: STAFF_DETAILED_EXPORT_COLUMNS, rows: toStaffDetailedExportRows([row]) });
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]); // zip signature "PK"
    const wb = XLSX.read(bytes, { type: 'array' });
    const data = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(data[0]).toHaveLength(22);
    expect(data[1][5]).toBe(26); // Working Days stays numeric
    expect(data[1][12]).toBe('16h 15m');
  });
});

describe('salary export glue', () => {
  it('has the 18 v1 columns and exports raw numbers with the type label', () => {
    expect(SALARY_EXPORT_COLUMNS).toHaveLength(18);
    const base = zeroRowFromStaff(staff({ userId: 's1', name: 'Sam', roleId: 2 }));
    const [out] = toSalaryExportRows([{ ...base, salaryType: 'DAILY_WAGES', basicSalary: 25000, netSalary: 24000.5 }]);
    expect(SALARY_EXPORT_COLUMNS.map((c) => out[c.key])).toEqual(['Sam', 'E001', 'Manager', 'HQ', 'Daily', 25000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24000.5]);
  });
});
