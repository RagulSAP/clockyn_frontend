import React, { useMemo, useState } from 'react';
import { DataTable, Text, type DataTableColumn } from '@/components/ui';
import { useBreakpoint } from '@/components/layout';
import { getErrorMessage } from '@/lib/api/errors';
import { currentMonthIST } from '@/lib/datetime';
import { useTheme } from '@/theme';
import { EmployeeCell, useEmployeeColumnWidth } from '../components/EmployeeCell';
import { ReportBody } from '../components/ReportBody';
import { ReportScaffold } from '../components/ReportScaffold';
import { useReportExport } from '../hooks/useReportExport';
import { useLateReport } from '../hooks/useReportQueries';
import { useReportSubtitle } from '../hooks/useReportSubtitle';
import { LATE_EXPORT_COLUMNS, toLateExportRows, type LateRow } from '../utils/lateRule';
import { reportMonth } from '../utils/monthRange';

const SHIFT_NOTE = 'Shift times are not provided by the server yet, so the shift columns and "Late By" are not available. Late days are still listed.';

function useColumns(): DataTableColumn<LateRow>[] {
  const { colors } = useTheme();
  const employeeWidth = useEmployeeColumnWidth();
  return useMemo(() => {
    const plain = (key: keyof LateRow, title: string, width: number, color?: string, bold?: boolean): DataTableColumn<LateRow> => ({
      key,
      title,
      width,
      render: (r) => (
        <Text variant="callout" weight={bold ? 'bold' : undefined} numberOfLines={1} style={color ? { color } : undefined}>
          {String(r[key] ?? '—')}
        </Text>
      ),
    });
    return [
      {
        key: 'employee',
        title: 'Employee',
        width: employeeWidth,
        frozen: true,
        render: (r) => <EmployeeCell name={r.name} line2={r.empId} line3={r.branch} photoUrl={r.photoUrl} />,
      },
      plain('branch', 'Branch', 120),
      plain('dept', 'Department', 130),
      plain('dateLabel', 'Date', 120),
      plain('shiftStart', 'Shift Start', 110, colors.primary),
      plain('shiftEnd', 'Shift End', 110, colors.primary),
      plain('punchIn', 'Punch In', 110, colors.warning),
      plain('lateBy', 'Late By', 110, colors.danger, true),
    ];
  }, [colors, employeeWidth]);
}

export default function LateReportScreen() {
  const [{ year, month }, setPeriod] = useState(() => currentMonthIST());
  const m = useMemo(() => reportMonth(year, month), [year, month]);
  const { isDesktop, height } = useBreakpoint();
  const report = useLateReport(year, month);
  const columns = useColumns();
  const rows = useMemo(() => report.data?.rows ?? [], [report.data]);
  const subtitle = useReportSubtitle(m.label);
  const exportRows = useMemo(() => toLateExportRows(rows), [rows]);
  const { exporting, exportAs } = useReportExport({
    title: 'Late Report',
    subtitle,
    filePrefix: 'late_report',
    historyLabel: 'Late Report',
    columns: LATE_EXPORT_COLUMNS,
    rows: exportRows,
    year,
    month,
    orientation: 'landscape',
  });

  const loading = report.isLoading;
  const error = report.isError && !report.data ? getErrorMessage(report.error, 'Failed to load late report') : null;
  const warnings = [...(report.data?.warnings ?? []), ...(report.data?.shiftTimesMissing ? [SHIFT_NOTE] : [])];

  return (
    <ReportScaffold
      title="Late Report"
      year={year}
      month={month}
      onMonthChange={setPeriod}
      summary={`${rows.length} late entries`}
      summaryTone="danger"
      onExport={(f) => void exportAs(f)}
      exportDisabled={loading || rows.length === 0}
      exporting={exporting}
      warnings={warnings}
      refreshing={report.isRefetching}
      onRefresh={() => void report.refetch()}
      testID="late-report"
    >
      <ReportBody
        loading={loading}
        loadingText={report.progress}
        error={error}
        onRetry={() => void report.refetch()}
        empty={rows.length === 0 ? { icon: 'check-circle', title: 'No late entries', message: `All staff were on time in ${m.label}` } : null}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="key"
          rowHeight={60}
          maxHeight={isDesktop ? Math.max(420, height - 300) : undefined}
          testID="late-table"
        />
      </ReportBody>
    </ReportScaffold>
  );
}
