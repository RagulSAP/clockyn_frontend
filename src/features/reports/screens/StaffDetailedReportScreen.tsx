import React, { useMemo, useState } from 'react';
import { DataTable, Text, type DataTableColumn } from '@/components/ui';
import { useBreakpoint } from '@/components/layout';
import { getErrorMessage } from '@/lib/api/errors';
import { useTheme } from '@/theme';
import { EmployeeCell, useEmployeeColumnWidth } from '../components/EmployeeCell';
import { ReportBody } from '../components/ReportBody';
import { ReportScaffold } from '../components/ReportScaffold';
import { useReportExport } from '../hooks/useReportExport';
import { useReportSubtitle } from '../hooks/useReportSubtitle';
import { useStaffDetailedReport } from '../hooks/useReportQueries';
import { reportMonth, type ReportMonth } from '../utils/monthRange';
import {
  isDimmedValue,
  STAFF_DETAILED_COLUMNS,
  STAFF_DETAILED_EXPORT_COLUMNS,
  staffDetailedHeaderGroups,
  toStaffDetailedExportRows,
  type StaffDetailedRow,
} from '../utils/staffDetailed';
import { currentMonthIST } from '@/lib/datetime';

const HEADER_GROUPS = staffDetailedHeaderGroups();

function useColumns(): DataTableColumn<StaffDetailedRow>[] {
  const { colors } = useTheme();
  const employeeWidth = useEmployeeColumnWidth();
  return useMemo(() => {
    const employee: DataTableColumn<StaffDetailedRow> = {
      key: 'employee',
      title: 'Employee',
      width: employeeWidth,
      frozen: true,
      render: (r) => <EmployeeCell name={r.name} line2={`${r.empId} · ${r.roleName}`} line3={r.branch} photoUrl={r.photoUrl} />,
    };
    const data = STAFF_DETAILED_COLUMNS.map<DataTableColumn<StaffDetailedRow>>((c) => ({
      key: c.key,
      title: c.title,
      width: c.key === 'hoursWorked' ? 100 : 92,
      align: 'center',
      render: (r) => {
        const value = r[c.key];
        return (
          <Text variant="callout" weight="semibold" style={{ color: isDimmedValue(value) ? colors.borderStrong : colors[c.tone] }}>
            {value === null || value === undefined ? '—' : String(value)}
          </Text>
        );
      },
    }));
    return [employee, ...data];
  }, [colors, employeeWidth]);
}

export default function StaffDetailedReportScreen() {
  const [{ year, month }, setPeriod] = useState(() => currentMonthIST());
  const m: ReportMonth = useMemo(() => reportMonth(year, month), [year, month]);
  const { isDesktop, height } = useBreakpoint();
  const report = useStaffDetailedReport(year, month);
  const columns = useColumns();
  const rows = useMemo(() => report.data?.rows ?? [], [report.data]);

  const subtitle = useReportSubtitle(m.label);
  const exportRows = useMemo(() => toStaffDetailedExportRows(rows), [rows]);
  const { exporting, exportAs } = useReportExport({
    title: 'Staff Detailed Report',
    subtitle,
    filePrefix: 'staff_report',
    historyLabel: 'Staff Report',
    columns: STAFF_DETAILED_EXPORT_COLUMNS,
    rows: exportRows,
    year,
    month,
    orientation: 'landscape',
  });

  const loading = report.isLoading;
  const error = report.isError && !report.data ? getErrorMessage(report.error, 'Failed to load report data') : null;

  return (
    <ReportScaffold
      title="Staff Detailed Report"
      year={year}
      month={month}
      onMonthChange={setPeriod}
      summary={`${rows.length} staff`}
      onExport={(f) => void exportAs(f)}
      exportDisabled={loading || rows.length === 0}
      exporting={exporting}
      warnings={report.data?.warnings}
      refreshing={report.isRefetching}
      onRefresh={() => void report.refetch()}
      testID="staff-detailed-report"
    >
      <ReportBody
        loading={loading}
        loadingText={report.progress}
        error={error}
        onRetry={() => void report.refetch()}
        empty={rows.length === 0 ? { icon: 'file-text', title: 'No data', message: `No staff found for ${m.label}` } : null}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="userId"
          headerGroups={HEADER_GROUPS}
          rowHeight={60}
          maxHeight={isDesktop ? Math.max(420, height - 300) : undefined}
          testID="staff-detailed-table"
        />
      </ReportBody>
    </ReportScaffold>
  );
}
