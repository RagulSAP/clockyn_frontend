/** Names, file names and messages of report exports (v1 wording). */
import { MONTH_NAMES_SHORT } from '@/lib/datetime';
import type { ReportFormat } from '../types';

/** Menu order of the export sheet: PDF, DOC, Excel, CSV. */
export const EXPORT_FORMATS: ReportFormat[] = ['pdf', 'doc', 'xlsx', 'csv'];

export const FORMAT_LABEL: Record<ReportFormat, string> = { pdf: 'PDF', doc: 'DOC', xlsx: 'Excel', csv: 'CSV' };

/** `Download as PDF` … */
export const formatMenuLabel = (format: ReportFormat): string => `Download as ${FORMAT_LABEL[format]}`;

/** `staff_report_Oct_2026` (the exporter appends the real extension). */
export function exportFileBase(prefix: string, year: number, month: number): string {
  return `${prefix}_${MONTH_NAMES_SHORT[month - 1] ?? month}_${year}`;
}

/** History label: `Staff Report Oct 2026 (CSV)`. */
export function historyName(label: string, year: number, month: number, format: ReportFormat): string {
  return `${label} ${MONTH_NAMES_SHORT[month - 1] ?? month} ${year} (${FORMAT_LABEL[format]})`;
}

/** Fallback error text of a failed export: `Failed to generate PDF`, `Failed to download CSV`, … */
export function exportFailureMessage(format: ReportFormat): string {
  return format === 'pdf' ? 'Failed to generate PDF' : `Failed to download ${FORMAT_LABEL[format]}`;
}
