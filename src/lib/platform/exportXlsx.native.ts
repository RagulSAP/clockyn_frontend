import * as XLSX from 'xlsx';
import { buildWorkbookBytes, type XlsxBuildOptions } from './exportXlsxCore';

/** Native (and Jest): builds a real .xlsx workbook with a static `xlsx` import. */
export async function buildXlsxBytes(opts: XlsxBuildOptions): Promise<Uint8Array> {
  return buildWorkbookBytes(XLSX, opts);
}
