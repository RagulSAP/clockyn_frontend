import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { resolveAttendanceReport } from '@/api/reports';
import { Screen } from '@/components/layout';
import { Button, Card, ErrorState, Icon, MonthYearPicker, Spinner, Text, useToast } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { currentMonthIST } from '@/lib/datetime';
import { downloadAndOpen, openFile } from '@/lib/platform/files';
import { spacing } from '@/theme';
import { StaffPickerSheet, type StaffSelection } from '../components/StaffPickerSheet';
import { useReportStaffOptions } from '../hooks/useReportStaffOptions';
import { recordSavedReport } from '../utils/history';
import { reportMonth, yearRangeFor } from '../utils/monthRange';

export default function MonthlyAttendanceReportScreen() {
  const toast = useToast();
  const [{ year, month }, setPeriod] = useState(() => currentMonthIST());
  const [selected, setSelected] = useState<StaffSelection>('all');
  const [picker, setPicker] = useState(false);
  const staff = useReportStaffOptions();
  const m = useMemo(() => reportMonth(year, month), [year, month]);

  const { run: generate, loading: generating } = useAsyncAction(
    async () => {
      const target = resolveAttendanceReport(
        staff.isManager
          ? {
              scope: 'manager',
              managerId: staff.managerId,
              year,
              month,
              staff: selected === 'all' ? 'all' : { userId: selected.userId, empId: selected.empId, isSelf: selected.isSelf },
            }
          : {
              scope: 'admin',
              orgId: staff.orgId,
              year,
              month,
              staff: selected === 'all' ? 'all' : { userId: selected.userId, empId: selected.empId },
            },
      );
      // Only a successful download becomes a file and a history entry (v1 could keep an error body as a "report").
      const saved = await downloadAndOpen({ url: target.url, filename: target.filename, mimeType: target.mimeType, open: false });
      if (!saved.uri) throw new Error('The report could not be saved.');
      const label = selected === 'all' ? 'All Staff' : selected.name;
      try {
        await recordSavedReport(staff.orgId, {
          name: `${label} — ${m.fullName} ${year}`,
          uri: saved.uri,
          filename: saved.filename,
          mimeType: saved.mimeType,
          size: saved.size,
        });
      } catch (e) {
        console.warn('Could not add the report to the history', e);
      }
      try {
        await openFile({ uri: saved.uri, mimeType: saved.mimeType, filename: saved.filename, dialogTitle: label });
      } catch (e) {
        // The file is saved and in the history; only the viewer failed (e.g. no PDF viewer installed).
        toast.error(getErrorMessage(e, 'Could not open the report. It was saved to View Reports.'));
      }
    },
    { errorMessage: 'Failed to generate report.' },
  );

  const selectedLabel = selected === 'all' ? 'All Staff' : `${selected.name}  (${selected.empId})`;
  const selectedDept = selected === 'all' ? '' : selected.department;

  return (
    <Screen
      title="Monthly Report"
      maxWidth={720}
      testID="monthly-attendance-report"
      footer={<Button title="Generate & View PDF" icon="file-text" size="lg" fullWidth loading={generating} disabled={generating || !staff.orgId} onPress={() => void generate()} testID="generate-pdf" />}
    >
      <View style={{ gap: spacing.lg }}>
        <Card variant="muted">
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Icon name="file-text" size={22} color="primary" />
            <Text variant="callout" color="textSecondary" style={{ flex: 1 }}>
              Generate a Monthly Attendance Summary PDF for any staff member.
            </Text>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Text variant="title3">Select Staff</Text>
          {staff.isError ? (
            <ErrorState compact message={getErrorMessage(staff.error, 'Failed to load staff')} onRetry={() => void staff.refetch()} />
          ) : (
            <Card onPress={() => setPicker(true)} accessibilityLabel="Select staff" testID="staff-picker">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {selectedLabel}
                  </Text>
                  {selectedDept ? (
                    <Text variant="caption" color="textMuted">
                      {selectedDept}
                    </Text>
                  ) : null}
                </View>
                {staff.isLoading ? <Spinner /> : <Icon name="chevron-down" size={20} color="textMuted" />}
              </View>
            </Card>
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="title3">Select Period</Text>
          <Card padding={spacing.md}>
            <MonthYearPicker month={month} year={year} onChange={setPeriod} yearRange={yearRangeFor('attendancePdf')} testID="period" />
          </Card>
        </View>
      </View>
      <StaffPickerSheet visible={picker} onClose={() => setPicker(false)} options={staff.data ?? []} selected={selected} onSelect={setSelected} />
    </Screen>
  );
}
