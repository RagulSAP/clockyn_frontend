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
import { useOvertimeReport } from '../hooks/useReportQueries';
import { useReportSubtitle } from '../hooks/useReportSubtitle';
import { reportMonth } from '../utils/monthRange';
import {
  countWithOvertime,
  formatOtAmount,
  OT_NONE,
  OVERTIME_EXPORT_COLUMNS,
  toOvertimeExportRows,
  type OvertimeRow,
} from '../utils/overtime';

function useColumns(): DataTableColumn<OvertimeRow>[] {
  const { colors } = useTheme();
  const employeeWidth = useEmployeeColumnWidth();
  return useMemo(() => {
    const text = (key: 'branch' | 'dept', title: string, width: number): DataTableColumn<OvertimeRow> => ({
      key,
      title,
      width,
      render: (r) => (
        <Text variant="callout" color="textMuted" numberOfLines={1}>
          {r[key] || OT_NONE}
        </Text>
      ),
    });
    const ot = (key: string, title: string, value: (r: OvertimeRow) => string, color: string): DataTableColumn<OvertimeRow> => ({
      key,
      title,
      width: 120,
      render: (r) => (
        <Text variant="callout" weight={r.hasOt ? 'bold' : 'medium'} style={{ color: r.hasOt ? color : colors.textMuted }}>
          {r.hasOt ? value(r) : OT_NONE}
        </Text>
      ),
    });
    return [
      {
        key: 'employee',
        title: 'Employee',
        width: employeeWidth,
        frozen: true,
        render: (r) => <EmployeeCell name={r.name} line2={r.empId} photoUrl={r.photoUrl} badge={r.hasOt ? 'OT' : undefined} />,
      },
      text('branch', 'Branch', 130),
      text('dept', 'Department', 140),
      ot('otDays', 'OT Days', (r) => String(r.otDays), colors.primary),
      ot('otHours', 'OT Hours', (r) => r.otHours, colors.primary),
      // Amount is shown whenever non-zero (grey when the row has no overtime minutes).
      {
        key: 'otAmount',
        title: 'OT Amount',
        width: 130,
        render: (r) => (
          <Text variant="callout" weight={r.hasOt ? 'bold' : 'medium'} style={{ color: r.hasOt ? colors.success : colors.textMuted }}>
            {formatOtAmount(r.otAmount)}
          </Text>
        ),
      },
    ];
  }, [colors, employeeWidth]);
}

export default function OvertimeReportScreen() {
  const [{ year, month }, setPeriod] = useState(() => currentMonthIST());
  const m = useMemo(() => reportMonth(year, month), [year, month]);
  const { isDesktop, height } = useBreakpoint();
  const report = useOvertimeReport(year, month);
  const columns = useColumns();
  const rows = useMemo(() => report.data?.rows ?? [], [report.data]);
  const subtitle = useReportSubtitle(m.label);
  const exportRows = useMemo(() => toOvertimeExportRows(rows), [rows]);
  const { exporting, exportAs } = useReportExport({
    title: 'Overtime Report',
    subtitle,
    filePrefix: 'overtime_report',
    historyLabel: 'Overtime Report',
    columns: OVERTIME_EXPORT_COLUMNS,
    rows: exportRows,
    year,
    month,
  });

  const loading = report.isLoading;
  const error = report.isError && !report.data ? getErrorMessage(report.error, 'Failed to load overtime report') : null;

  return (
    <ReportScaffold
      title="Overtime Report"
      year={year}
      month={month}
      onMonthChange={setPeriod}
      summary={`${countWithOvertime(rows)} with OT`}
      onExport={(f) => void exportAs(f)}
      exportDisabled={loading || rows.length === 0}
      exporting={exporting}
      warnings={report.data?.warnings}
      refreshing={report.isRefetching}
      onRefresh={() => void report.refetch()}
      testID="overtime-report"
    >
      <ReportBody
        loading={loading}
        loadingText="Loading..."
        error={error}
        onRetry={() => void report.refetch()}
        empty={rows.length === 0 ? { icon: 'timer', title: 'No staff found', message: `No data for ${m.label}` } : null}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="userId"
          rowHeight={60}
          maxHeight={isDesktop ? Math.max(420, height - 300) : undefined}
          testID="overtime-table"
        />
      </ReportBody>
    </ReportScaffold>
  );
}
