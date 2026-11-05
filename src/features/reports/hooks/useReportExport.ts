/** Export hook shared by the table reports: real files via `exportTable`, then a history entry with the real mime type. */
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { exportTable } from '@/lib/platform/exporter';
import { useOrgId } from '@/store/auth';
import type { ExportColumnDef, ReportFormat } from '../types';
import { exportFailureMessage, exportFileBase, historyName } from '../utils/exportLabels';
import { recordSavedReport } from '../utils/history';

export interface UseReportExportOptions {
  /** Report title (PDF/DOC heading, sheet name). */
  title: string;
  /** File name prefix, e.g. `staff_report` → `staff_report_Oct_2026.pdf`. */
  filePrefix: string;
  /** History label prefix, e.g. `Staff Report`; omit to not record history (salary sheet, as in v1). */
  historyLabel?: string;
  subtitle?: string;
  columns: ExportColumnDef[];
  rows: Record<string, unknown>[];
  year: number;
  month: number;
  orientation?: 'portrait' | 'landscape';
}

export function useReportExport(options: UseReportExportOptions) {
  const toast = useToast();
  const orgId = useOrgId();
  const [exporting, setExporting] = useState(false);
  const { title, filePrefix, historyLabel, subtitle, columns, rows, year, month, orientation } = options;

  const exportAs = useCallback(
    async (format: ReportFormat): Promise<void> => {
      if (exporting) return;
      setExporting(true);
      try {
        const result = await exportTable({
          title,
          subtitle,
          filename: exportFileBase(filePrefix, year, month),
          columns,
          rows,
          format,
          orientation,
        });
        // The web PDF export prints through the browser (no file) — nothing to record then.
        if (historyLabel && result.uri) {
          try {
            await recordSavedReport(orgId, {
              name: historyName(historyLabel, year, month, format),
              uri: result.uri,
              filename: result.filename,
              mimeType: result.mimeType,
            });
          } catch (e) {
            console.warn('Could not add the report to the history', e);
          }
        }
      } catch (e) {
        toast.error(getErrorMessage(e, exportFailureMessage(format)));
      } finally {
        setExporting(false);
      }
    },
    [exporting, title, subtitle, filePrefix, historyLabel, columns, rows, year, month, orientation, orgId, toast],
  );

  return { exporting, exportAs };
}
