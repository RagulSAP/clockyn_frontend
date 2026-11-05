import { cellText, sanitizeSheetName, xlsxCellValue, type ExportColumn, type ExportRow } from './exportFormats';

export type XlsxModule = typeof import('xlsx');
export type XlsxBuildOptions = { sheetName: string; columns: ExportColumn[]; rows: ExportRow[] };

/** Builds a real .xlsx workbook (OOXML zip) with the given `xlsx` module and returns its bytes. */
export function buildWorkbookBytes(XLSX: XlsxModule, opts: XlsxBuildOptions): Uint8Array {
  const header = opts.columns.map((c) => c.title);
  const body = opts.rows.map((r) => opts.columns.map((c) => xlsxCellValue(r[c.key])));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body], { cellDates: true });
  sheet['!cols'] = opts.columns.map((c) => {
    let max = c.title.length;
    for (const r of opts.rows) max = Math.max(max, cellText(r[c.key]).length);
    return { wch: Math.min(Math.max(max + 2, 8), 60) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(opts.sheetName));
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer | number[];
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}
