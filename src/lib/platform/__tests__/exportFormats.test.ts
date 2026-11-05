import * as XLSX from 'xlsx';
import {
  CSV_BOM,
  buildCsv,
  buildTableHtml,
  buildWordHtml,
  cellText,
  csvField,
  ensureHtmlDocument,
  escapeHtml,
  neutraliseFormula,
  sanitizeSheetName,
} from '../exportFormats';
import { buildXlsxBytes } from '../exportXlsx';

const columns = [
  { key: 'name', title: 'Name' },
  { key: 'note', title: 'Note, "quoted"' },
  { key: 'hours', title: 'Hours' },
];

describe('escapeHtml', () => {
  it('escapes markup characters and quotes', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
  });
  it('handles non-strings', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(12.5)).toBe('12.5');
  });
});

describe('cellText', () => {
  it('formats primitives and objects', () => {
    expect(cellText(true)).toBe('Yes');
    expect(cellText(false)).toBe('No');
    expect(cellText(NaN)).toBe('');
    expect(cellText(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z');
    expect(cellText({ a: 1 })).toBe('{"a":1}');
  });
});

describe('csv', () => {
  it('quotes fields containing commas, quotes and line breaks (RFC 4180)', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField('cr\rlf')).toBe('"cr\rlf"');
  });

  it('neutralises spreadsheet formulas but leaves numbers and phone numbers alone', () => {
    expect(neutraliseFormula('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(neutraliseFormula('@cmd')).toBe("'@cmd");
    expect(neutraliseFormula('-cmd')).toBe("'-cmd");
    expect(neutraliseFormula('+91 98765 43210')).toBe('+91 98765 43210');
    expect(neutraliseFormula('-5')).toBe('-5');
    expect(neutraliseFormula('-')).toBe('-');
    expect(csvField(-5)).toBe('-5');
  });

  it('starts with a UTF-8 BOM, uses CRLF and one header row', () => {
    const csv = buildCsv(columns, [
      { name: 'Ann', note: 'hello, "world"', hours: 8.5 },
      { name: 'Bob', note: null, hours: 0 },
    ]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Name,"Note, ""quoted""",Hours');
    expect(lines[1]).toBe('Ann,"hello, ""world""",8.5');
    expect(lines[2]).toBe('Bob,,0');
    expect(lines[3]).toBe('');
  });

  it('keeps non-latin text intact', () => {
    expect(buildCsv([{ key: 'n', title: 'நாம்' }], [{ n: 'राज' }])).toContain('நாம்\r\nराज');
  });
});

describe('html tables', () => {
  it('escapes every dynamic value (title, subtitle, headers, cells)', () => {
    const html = buildTableHtml({
      title: '<script>alert(1)</script>',
      subtitle: 'a & b',
      columns: [{ key: 'x', title: '<b>col</b>' }],
      rows: [{ x: '<img src=x onerror=alert(1)>' }],
    });
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>col</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('sets the page orientation and right-aligns numbers', () => {
    const html = buildTableHtml({ title: 'T', columns, rows: [{ name: 'A', hours: 3 }], orientation: 'landscape' });
    expect(html).toContain('A4 landscape');
    expect(html).toContain('<td class="num">3</td>');
  });

  it('renders a placeholder row when there is no data', () => {
    expect(buildTableHtml({ title: 'T', columns, rows: [] })).toContain('No data');
  });

  it('ensureHtmlDocument wraps fragments only', () => {
    expect(ensureHtmlDocument('<p>x</p>', 'My <T>')).toContain('<title>My &lt;T&gt;</title>');
    const doc = '<html><body>x</body></html>';
    expect(ensureHtmlDocument(doc)).toBe(doc);
  });

  it('buildWordHtml carries Office namespaces, page setup and the body content', () => {
    const word = buildWordHtml(buildTableHtml({ title: 'T', columns, rows: [{ name: 'Z' }] }), 'T', 'landscape');
    expect(word).toContain('urn:schemas-microsoft-com:office:word');
    expect(word).toContain('mso-page-orientation:landscape');
    expect(word).toContain('<td>Z</td>');
    expect(word.match(/<html/g)).toHaveLength(1);
  });
});

describe('xlsx', () => {
  it('sanitises sheet names', () => {
    expect(sanitizeSheetName('Late: report/2026?')).toBe('Late report 2026');
    expect(sanitizeSheetName('')).toBe('Sheet1');
    expect(sanitizeSheetName('x'.repeat(50))).toHaveLength(31);
  });

  it('writes a real OOXML workbook with typed cells', async () => {
    const bytes = await buildXlsxBytes({
      sheetName: 'Attendance',
      columns,
      rows: [{ name: 'Ann', note: '=1+1', hours: 8.5 }],
    });
    // zip local-file-header signature "PK\x03\x04"
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Attendance']);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Attendance, { header: 1 });
    expect(rows[0]).toEqual(['Name', 'Note, "quoted"', 'Hours']);
    expect(rows[1]).toEqual(['Ann', '=1+1', 8.5]);
    expect(wb.Sheets.Attendance.C2.t).toBe('n'); // number stays a number
    expect(wb.Sheets.Attendance.B2.t).toBe('s'); // formula-looking text stays text
  });
});
