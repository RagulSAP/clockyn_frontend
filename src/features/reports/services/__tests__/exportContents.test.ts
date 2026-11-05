/**
 * What the report exports really put into the file: real mime/extension per format, CSV BOM + RFC-4180, a real xlsx
 * workbook, escaped HTML for PDF / DOC. (`saveAndShareFile` / `exportPdf` are the platform seams.)
 */
import * as XLSX from 'xlsx';
import { exportHtml, exportTable } from '@/lib/platform/exporter';
import { saveAndShareFile } from '@/lib/platform/files';
import { exportPdf } from '@/lib/platform/pdf';
import { buildProfileHtml } from '../../utils/employeeProfile';
import { exportFileBase, historyName } from '../../utils/exportLabels';
import { buildStaffDetailedRow, STAFF_DETAILED_EXPORT_COLUMNS, toStaffDetailedExportRows } from '../../utils/staffDetailed';
import { reportMonth } from '../../utils/monthRange';
import { day, month, staff } from '../../testing/fixtures';

jest.mock('@/lib/platform/files', () => ({
  saveAndShareFile: jest.fn(async (o: { filename: string }) => ({ uri: `file:///saved/${o.filename}`, filename: o.filename })),
}));
jest.mock('@/lib/platform/pdf', () => ({ exportPdf: jest.fn(async () => ({ uri: 'file:///saved/x.pdf' })) }));

const save = saveAndShareFile as jest.Mock;
const pdf = exportPdf as jest.Mock;

const evil = staff({ userId: 'e', name: 'Eve <script>alert(1)</script> "Q", & Co', empId: '=SUM(A1)' });
const row = buildStaffDetailedRow({
  staff: evil,
  attendance: month([day({ totalHours: 8.5 })]),
  workingDays: 26,
  requests: [],
  month: reportMonth(2026, 10),
});
const columns = STAFF_DETAILED_EXPORT_COLUMNS;
const rows = toStaffDetailedExportRows([row]);
const base = exportFileBase('staff_report', 2026, 10);

beforeEach(() => {
  save.mockClear();
  pdf.mockClear();
});

describe('report exports', () => {
  it('uses the report file name with the REAL extension and mime type of each format (what the history stores)', async () => {
    const out = await Promise.all((['csv', 'xlsx', 'doc', 'pdf'] as const).map((format) => exportTable({ title: 'Staff Detailed Report', filename: base, columns, rows, format })));
    expect(out.map((o) => [o.filename, o.mimeType])).toEqual([
      ['staff_report_Oct_2026.csv', 'text/csv'],
      ['staff_report_Oct_2026.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['staff_report_Oct_2026.doc', 'application/msword'],
      ['staff_report_Oct_2026.pdf', 'application/pdf'],
    ]);
    expect(out.every((o) => o.uri)).toBe(true);
    expect(historyName('Staff Report', 2026, 10, 'xlsx')).toBe('Staff Report Oct 2026 (Excel)');
  });

  it('CSV: BOM, header + quoted fields (RFC-4180), formula-looking text neutralised', async () => {
    await exportTable({ title: 'T', filename: base, columns, rows, format: 'csv' });
    const { data } = save.mock.calls[0][0] as { data: string };
    expect(data.startsWith('﻿')).toBe(true);
    const lines = data.slice(1).trimEnd().split('\r\n');
    expect(lines[0].split(',')).toHaveLength(22);
    expect(lines[1]).toContain('"Eve <script>alert(1)</script> ""Q"", & Co"');
    expect(lines[1]).toContain("'=SUM(A1)");
  });

  it('xlsx: a real workbook whose header is the 22 export columns', async () => {
    await exportTable({ title: 'Staff Detailed Report', filename: base, columns, rows, format: 'xlsx' });
    const { data } = save.mock.calls[0][0] as { data: Uint8Array };
    expect([...data.slice(0, 2)]).toEqual([0x50, 0x4b]);
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(sheet[0]).toEqual(columns.map((c) => c.title));
    expect(sheet[1][0]).toBe(evil.name);
  });

  it('PDF and DOC: HTML-escaped values (no markup injection), report title and subtitle present', async () => {
    await exportTable({ title: 'Staff Detailed Report', subtitle: 'Acme | October 2026', filename: base, columns, rows, format: 'pdf', orientation: 'landscape' });
    const html = (pdf.mock.calls[0][0] as { html: string }).html;
    expect(html).toContain('Staff Detailed Report');
    expect(html).toContain('Acme | October 2026');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('size:A4 landscape');

    await exportTable({ title: 'Staff Detailed Report', subtitle: 'Acme | October 2026', filename: base, columns, rows, format: 'doc' });
    const doc = (save.mock.calls[0][0] as { data: string }).data;
    expect(doc).toContain('&lt;script&gt;');
    expect(doc).not.toContain('<script>alert(1)');
  });

  it('employee profile: PDF goes through the real PDF seam and DOC through a .doc file, with every value escaped', async () => {
    const profile = {
      userId: 'p', name: 'Eve <b>Bold</b>', empId: 'E1', department: 'R&D', branch: 'HQ', roleName: 'Staff',
      mobile: '9999999999', email: 'a"b@x.com',
    } as unknown as Parameters<typeof buildProfileHtml>[0];
    const html = buildProfileHtml(profile, 'Acme <Co>');
    const pdfOut = await exportHtml({ html, filename: 'Eve_report', format: 'pdf', title: 'Eve - Employee Report' });
    expect(pdfOut).toMatchObject({ filename: 'Eve_report.pdf', mimeType: 'application/pdf' });
    expect((pdf.mock.calls[0][0] as { html: string }).html).toContain('Eve &lt;b&gt;Bold&lt;/b&gt;');
    const docOut = await exportHtml({ html, filename: 'Eve_report', format: 'doc' });
    expect(docOut).toMatchObject({ filename: 'Eve_report.doc', mimeType: 'application/msword' });
    expect((save.mock.calls[0][0] as { data: string }).data).toContain('Acme &lt;Co&gt;');
  });
});
