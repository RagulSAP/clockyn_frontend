import { base64ToBytes, fileNameForFormat, mimeFromFileName, sanitizeFileName, utiForMime } from '../fileNames';

describe('sanitizeFileName', () => {
  it('replaces path separators and reserved characters', () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j.pdf')).toBe('a_b_c_d_e_f_g_h_i_j.pdf');
  });
  it('keeps unicode letters (v1 turned them into underscores)', () => {
    expect(sanitizeFileName('राज कुमार report.pdf')).toBe('राज कुमार report.pdf');
    expect(sanitizeFileName('José Núñez.csv')).toBe('José Núñez.csv');
  });
  it('strips leading dots/spaces and prevents traversal', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('etc_passwd');
    expect(sanitizeFileName('  ..hidden.txt')).toBe('hidden.txt');
  });
  it('falls back for empty input and reserved device names', () => {
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName('???', 'report')).toBe('report');
    expect(sanitizeFileName('CON.txt')).toBe('_CON.txt');
  });
  it('caps very long base names but preserves the extension', () => {
    const out = sanitizeFileName(`${'x'.repeat(300)}.xlsx`);
    expect(out.endsWith('.xlsx')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(126);
  });
  it('lower-cases the extension and collapses whitespace', () => {
    expect(sanitizeFileName('My   Report.PDF')).toBe('My Report.pdf');
  });
});

describe('fileNameForFormat', () => {
  it('forces the extension of the format', () => {
    expect(fileNameForFormat('attendance', 'pdf')).toBe('attendance.pdf');
    expect(fileNameForFormat('attendance.pdf', 'xlsx')).toBe('attendance.xlsx');
    expect(fileNameForFormat('late/report.html', 'doc')).toBe('late_report.doc');
  });
  it('does not mistake a dotted title for an extension', () => {
    expect(fileNameForFormat('Report v1.2', 'csv')).toBe('Report v1.2.csv');
  });
});

describe('mime helpers', () => {
  it('maps extensions to mime types', () => {
    expect(mimeFromFileName('a.PDF')).toBe('application/pdf');
    expect(mimeFromFileName('a.csv')).toBe('text/csv');
    expect(mimeFromFileName('a.unknown')).toBe('application/octet-stream');
  });
  it('maps mime types to iOS UTIs (ignoring parameters)', () => {
    expect(utiForMime('application/pdf')).toBe('com.adobe.pdf');
    expect(utiForMime('text/csv; charset=utf-8')).toBe('public.comma-separated-values-text');
    expect(utiForMime('application/x-nothing')).toBeUndefined();
  });
});

describe('base64ToBytes', () => {
  it('decodes padded and unpadded input', () => {
    expect(Array.from(base64ToBytes('SGVsbG8='))).toEqual([72, 101, 108, 108, 111]);
    expect(Array.from(base64ToBytes('SGVsbG8'))).toEqual([72, 101, 108, 108, 111]);
    expect(Array.from(base64ToBytes('data:text/plain;base64,SGk='))).toEqual([72, 105]);
    expect(base64ToBytes('').length).toBe(0);
  });
});
