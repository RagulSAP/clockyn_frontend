/**
 * Report exporter — produces REAL files on every platform.
 *
 *  - pdf  : native → expo-print (true PDF file); web → print-to-PDF via hidden iframe (`uri` undefined)
 *  - xlsx : real OOXML workbook built with the `xlsx` package
 *  - csv  : UTF-8 BOM + RFC-4180 quoting (+ spreadsheet-formula neutralising)
 *  - doc  : HTML in a `.doc` container (opens in Word)
 *
 * All table values are HTML-escaped. The returned `mimeType`/`filename` carry the real extension so the
 * saved-report history can open the file correctly.
 */
import { buildCsv, buildTableHtml, buildWordHtml, ensureHtmlDocument, type ExportColumn, type ExportRow, type Orientation } from './exportFormats';
import { buildXlsxBytes } from './exportXlsx';
import { FORMAT_META, fileNameForFormat, type ExportFormat } from './fileNames';
import { saveAndShareFile } from './files';
import { exportPdf } from './pdf';

export type { ExportFormat } from './fileNames';
export type { ExportColumn, ExportRow, Orientation } from './exportFormats';

export type ExportResult = { uri?: string; filename: string; mimeType: string };

export type ExportTableOptions = {
  title: string;
  filename: string;
  columns: { key: string; title: string }[];
  rows: Record<string, unknown>[];
  format: ExportFormat;
  subtitle?: string;
  orientation?: Orientation;
  /** Deliver the file after creating it (native share sheet / web download or print dialog). Default true. */
  share?: boolean;
};

export type ExportHtmlOptions = {
  /** Caller-built HTML. The caller is responsible for escaping any dynamic values (use `escapeHtml`). */
  html: string;
  filename: string;
  format: 'pdf' | 'doc';
  /** Used as the document title when `html` is a fragment. */
  title?: string;
  orientation?: Orientation;
  share?: boolean;
};

export { escapeHtml } from './exportFormats';

export async function exportTable(opts: ExportTableOptions): Promise<ExportResult> {
  const { format } = opts;
  const filename = fileNameForFormat(opts.filename, format);
  const { mimeType } = FORMAT_META[format];
  const share = opts.share !== false;
  const columns: ExportColumn[] = opts.columns;
  const rows: ExportRow[] = opts.rows;

  switch (format) {
    case 'csv': {
      const saved = await saveAndShareFile({ filename, mimeType: `${mimeType};charset=utf-8`, data: buildCsv(columns, rows), share });
      return { uri: saved.uri, filename, mimeType };
    }
    case 'xlsx': {
      const bytes = await buildXlsxBytes({ sheetName: opts.title, columns, rows });
      const saved = await saveAndShareFile({ filename, mimeType, data: bytes, share });
      return { uri: saved.uri, filename, mimeType };
    }
    case 'doc': {
      const html = buildTableHtml({ title: opts.title, subtitle: opts.subtitle, columns, rows, orientation: opts.orientation });
      const saved = await saveAndShareFile({
        filename,
        mimeType,
        data: buildWordHtml(html, opts.title, opts.orientation),
        share,
      });
      return { uri: saved.uri, filename, mimeType };
    }
    case 'pdf': {
      const html = buildTableHtml({ title: opts.title, subtitle: opts.subtitle, columns, rows, orientation: opts.orientation });
      const { uri } = await exportPdf({ html, filename, orientation: opts.orientation, share });
      return { uri, filename, mimeType };
    }
    default: {
      const never: never = format;
      throw new Error(`Unsupported export format: ${String(never)}`);
    }
  }
}

export async function exportHtml(opts: ExportHtmlOptions): Promise<ExportResult> {
  const filename = fileNameForFormat(opts.filename, opts.format);
  const { mimeType } = FORMAT_META[opts.format];
  const share = opts.share !== false;
  const title = opts.title ?? filename.replace(/\.[^.]+$/, '');

  if (opts.format === 'pdf') {
    const html = ensureHtmlDocument(opts.html, title, opts.orientation);
    const { uri } = await exportPdf({ html, filename, orientation: opts.orientation, share });
    return { uri, filename, mimeType };
  }
  const saved = await saveAndShareFile({
    filename,
    mimeType,
    data: buildWordHtml(opts.html, title, opts.orientation),
    share,
  });
  return { uri: saved.uri, filename, mimeType };
}
