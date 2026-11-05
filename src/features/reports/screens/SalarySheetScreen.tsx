import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useBreakpoint } from '@/components/layout';
import { Button, DataTable, Icon, Text, toneColors, type DataTableColumn } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { currentMonthIST, monthKey } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';
import { AdvanceSheet, type AdvanceTarget } from '../components/AdvanceSheet';
import { EmployeeCell, useEmployeeColumnWidth } from '../components/EmployeeCell';
import { ReportBody } from '../components/ReportBody';
import { ReportScaffold } from '../components/ReportScaffold';
import { SalaryTypeSheet } from '../components/SalaryTypeSheet';
import { useReportExport } from '../hooks/useReportExport';
import { useSalarySheet } from '../hooks/useReportQueries';
import { useReportSubtitle } from '../hooks/useReportSubtitle';
import { reportMonth } from '../utils/monthRange';
import {
  applySalaryTypes,
  formatCountCell,
  formatMoneyCell,
  SALARY_COLUMNS,
  SALARY_EXPORT_COLUMNS,
  SALARY_HEADER_GROUPS,
  salarySubline,
  salaryTypeLabel,
  toSalaryExportRows,
  type SalarySheetRow,
  type SalaryTypeKey,
} from '../utils/salarySheet';

const EXPORT_FORMATS = ['pdf', 'doc', 'xlsx'] as const;

interface TypeState {
  /** Overrides belong to ONE period and are dropped when month/year changes. */
  key: string;
  byUser: Record<string, string>;
  all: SalaryTypeKey | null;
}

function TypeBadge({ type, onPress }: { type: string; onPress: () => void }) {
  const { colors } = useTheme();
  const c = toneColors('primary', colors);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Salary type ${salaryTypeLabel(type)}, change`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: c.bg }}
    >
      <Text variant="caption" weight="semibold" style={{ color: c.fg }} numberOfLines={1}>
        {salaryTypeLabel(type)}
      </Text>
      <Icon name="chevron-down" size={12} color={c.fg} />
    </Pressable>
  );
}

export default function SalarySheetScreen() {
  const { colors } = useTheme();
  const { isDesktop, height } = useBreakpoint();
  const [{ year, month }, setPeriod] = useState(() => currentMonthIST());
  const periodKey = monthKey(year, month);
  const m = useMemo(() => reportMonth(year, month), [year, month]);
  const sheet = useSalarySheet(year, month);

  const [typeState, setTypeState] = useState<TypeState>({ key: periodKey, byUser: {}, all: null });
  const types = typeState.key === periodKey ? typeState : { key: periodKey, byUser: {}, all: null };
  const [typePickerUser, setTypePickerUser] = useState<string | null>(null);
  const [allPicker, setAllPicker] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<AdvanceTarget | null>(null);

  const rows = useMemo(() => applySalaryTypes(sheet.data?.rows ?? [], types.byUser, types.all), [sheet.data, types.byUser, types.all]);
  const setUserType = useCallback(
    (userId: string, key: SalaryTypeKey) => setTypeState({ key: periodKey, all: types.all, byUser: { ...types.byUser, [userId]: key } }),
    [periodKey, types.all, types.byUser],
  );

  const employeeWidth = useEmployeeColumnWidth(200);
  const columns = useMemo<DataTableColumn<SalarySheetRow>[]>(() => {
    const amountCols = SALARY_COLUMNS.map<DataTableColumn<SalarySheetRow>>((c) => ({
      key: c.key,
      title: c.title,
      width: 100,
      align: 'center',
      render: (r) => {
        const v = r[c.key];
        const text = c.kind === 'count' ? formatCountCell(v) : formatMoneyCell(v);
        const color = !v ? colors.borderStrong : c.emphasis === 'fine' ? colors.danger : c.emphasis === 'net' ? colors.success : colors.text;
        return (
          <Text variant="callout" weight={c.emphasis === 'net' && v ? 'bold' : 'medium'} style={{ color }} numberOfLines={1}>
            {text}
          </Text>
        );
      },
    }));
    const [basic, daily, hourly, ...rest] = amountCols;
    return [
      {
        key: 'employee',
        title: 'Employee',
        width: employeeWidth,
        frozen: true,
        render: (r) => <EmployeeCell name={r.name} line2={salarySubline(r)} photoUrl={r.photoUrl} />,
      },
      {
        key: 'salaryType',
        title: 'Type',
        width: 110,
        align: 'center',
        render: (r) => <TypeBadge type={r.salaryType} onPress={() => setTypePickerUser(r.userId)} />,
      },
      basic,
      daily,
      hourly,
      ...rest,
    ];
  }, [colors, employeeWidth]);

  const subtitle = useReportSubtitle(m.label);
  const exportRows = useMemo(() => toSalaryExportRows(rows), [rows]);
  // v1 did not record the salary sheet in the saved-report history: no `historyLabel`.
  const { exporting, exportAs } = useReportExport({
    title: 'Staff Salary',
    subtitle,
    filePrefix: 'salary',
    columns: SALARY_EXPORT_COLUMNS,
    rows: exportRows,
    year,
    month,
    orientation: 'landscape',
  });

  const loading = sheet.isLoading;
  const error = sheet.isError && !sheet.data ? getErrorMessage(sheet.error, 'Failed to load salary data') : null;
  const warnings = sheet.data?.fallbackReason
    ? [`The salary breakdown could not be loaded (${sheet.data.fallbackReason}). Showing staff with zero amounts.`]
    : [];
  const pickerRow = rows.find((r) => r.userId === typePickerUser);

  return (
    <ReportScaffold
      title="Staff Salary"
      year={year}
      month={month}
      onMonthChange={setPeriod}
      summary={`${rows.length} staff`}
      onExport={(f) => void exportAs(f)}
      exportFormats={EXPORT_FORMATS}
      exportDisabled={loading || rows.length === 0}
      exporting={exporting}
      warnings={warnings}
      refreshing={sheet.isRefetching}
      onRefresh={() => void sheet.refetch()}
      testID="salary-sheet"
    >
      <View style={{ flexDirection: 'row' }}>
        <Button
          title={types.all ? salaryTypeLabel(types.all) : 'All Types'}
          icon="wallet"
          size="sm"
          variant="secondary"
          onPress={() => setAllPicker(true)}
          testID="all-types"
        />
      </View>
      <ReportBody
        loading={loading}
        loadingText="Loading salary data..."
        error={error}
        onRetry={() => void sheet.refetch()}
        empty={rows.length === 0 ? { icon: 'wallet', title: 'No salary data', message: `No records for ${m.label}` } : null}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="userId"
          headerGroups={SALARY_HEADER_GROUPS}
          rowHeight={64}
          maxHeight={isDesktop ? Math.max(420, height - 340) : undefined}
          onRowPress={(r) => setAdvanceTarget({ userId: r.userId, name: r.name })}
          testID="salary-table"
        />
      </ReportBody>

      <SalaryTypeSheet
        visible={typePickerUser !== null}
        title="Select Salary Type"
        subtitle={pickerRow?.name}
        current={pickerRow?.salaryType ?? null}
        onClose={() => setTypePickerUser(null)}
        onPick={(key) => typePickerUser && setUserType(typePickerUser, key)}
      />
      <SalaryTypeSheet
        visible={allPicker}
        title="Set Type for All Staff"
        subtitle="Applies to every employee"
        current={types.all}
        onClose={() => setAllPicker(false)}
        onPick={(key) => setTypeState({ key: periodKey, byUser: {}, all: key })}
      />
      <AdvanceSheet target={advanceTarget} orgId={sheet.orgId} onClose={() => setAdvanceTarget(null)} />
    </ReportScaffold>
  );
}
