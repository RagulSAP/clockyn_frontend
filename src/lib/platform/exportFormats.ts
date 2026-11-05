/**
 * Pure builders for the export formats (CSV / HTML table / Word-flavoured HTML).
 * No platform imports — unit-tested in `__tests__/exportFormats.test.ts`.
 */

export type ExportColumn = { key: string; title: string };
export type ExportRow = Record<string, unknown>;
export type Orientation = 'portrait' | 'landscape';

/** Escapes a value for safe interpolation into HTML text or a double-quoted attribute. */
export function escapeHtml(value: unknown): string {
  return cellText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Display text for a cell value (null/undefined → empty, Date → ISO, objects → JSON). */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

/**
 * Spreadsheet applications evaluate cells that start with = + - @ as formulas ("CSV injection").
 * Text that merely looks like a number/phone (`-5`, `+91 98…`) is left untouched.
 */
export function neutraliseFormula(text: string): string {
  if (/^[=@\t\r]/.test(text) || /^[+-][^0-9.\s]/.test(text)) return `'${text}`;
  return text;
}

/** RFC-4180 field: quoted when it contains a comma, quote, CR or LF; quotes are doubled. */
export function csvField(value: unknown): string {
  const text = typeof value === 'string' ? neutraliseFormula(value) : cellText(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_BOM = '﻿';

/** CSV with a UTF-8 BOM (so Excel detects the encoding) and CRLF record separators. */
export function buildCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  const lines: string[] = [columns.map((c) => csvField(c.title)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvField(row[c.key])).join(','));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

const BASE_CSS = `
  *{box-sizing:border-box}
  body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111827;margin:0;padding:24px;font-size:12px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#6b7280;font-size:12px;margin:0 0 16px}
  table{border-collapse:collapse;width:100%}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top;word-break:break-word}
  th{background:#0D0D0D;color:#ffffff;font-weight:600}
  tbody tr:nth-child(even) td{background:#f9fafb}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .empty{color:#6b7280;text-align:center;padding:16px}
`;

function tableMarkup(columns: ExportColumn[], rows: ExportRow[]): string {
  const head = columns.map((c) => `<th>${escapeHtml(c.title)}</th>`).join('');
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${columns
              .map((c) => {
                const v = row[c.key];
                return `<td${typeof v === 'number' ? ' class="num"' : ''}>${escapeHtml(v)}</td>`;
              })
              .join('')}</tr>`,
        )
        .join('')
    : `<tr><td class="empty" colspan="${Math.max(columns.length, 1)}">No data</td></tr>`;
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export type TableHtmlOptions = {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  orientation?: Orientation;
};

/** A complete, print-ready HTML document for a table (all dynamic values are HTML-escaped). */
export function buildTableHtml(opts: TableHtmlOptions): string {
  const orientation = opts.orientation ?? 'portrait';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>@page{size:A4 ${orientation};margin:12mm}${BASE_CSS}</style></head>
<body><h1>${escapeHtml(opts.title)}</h1>${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ''}
${tableMarkup(opts.columns, opts.rows)}</body></html>`;
}

/** Wraps an HTML fragment (caller-escaped) into a full printable document when it is not one already. */
export function ensureHtmlDocument(html: string, title = 'Report', orientation: Orientation = 'portrait'): string {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>@page{size:A4 ${orientation};margin:12mm}${BASE_CSS}</style></head><body>${html}</body></html>`;
}

/**
 * Word opens HTML saved as `.doc`; this adds the Office namespaces + page setup so it opens in print layout.
 * (A real .docx is out of scope — the file is honestly an HTML document with a .doc extension.)
 */
export function buildWordHtml(html: string, title = 'Report', orientation: Orientation = 'portrait'): string {
  const size = orientation === 'landscape' ? '841.9pt 595.3pt' : '595.3pt 841.9pt';
  const hasBody = /<body[\s>]/i.test(html);
  const inner = hasBody ? html.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '') : html;
  // Keep the caller's own <style> blocks (they live in <head> of a full document), minus @page rules Word ignores.
  const ownStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1].replace(/@page\s*\{[^}]*\}/gi, '')).join('\n');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page Section1{size:${size};mso-page-orientation:${orientation};margin:36pt}div.Section1{page:Section1}${hasBody ? ownStyles : BASE_CSS}</style></head>
<body><div class="Section1">${inner}</div></body></html>`;
}

/** Excel sheet names: max 31 chars, none of  [ ] : * ? / \  */
export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '');
  return (cleaned || 'Sheet1').slice(0, 31);
}

/** Cell values for an .xlsx sheet: numbers/booleans/dates stay typed, everything else becomes text. */
export function xlsxCellValue(value: unknown): string | number | boolean | Date {
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value;
  return cellText(value);
}
