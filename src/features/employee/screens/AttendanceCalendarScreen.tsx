import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout';
import { Button, Calendar, Card, ErrorState, Skeleton, Spinner, Text, type DayRenderInfo } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { currentMonthIST, todayIST } from '@/lib/datetime';
import { useSession } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';

import { DayDetailSheet } from '../components/DayDetailSheet';
import { BonusSheet, PayslipSheet } from '../components/RecordSheets';
import { useAdvances, useAttendanceMonth, useDaySessions, usePayslip, useShiftContext } from '../hooks/useAttendanceData';
import { LEGEND, STATUS_COLOR, deriveDay, shiftForDate, type DayView } from '../utils/attendanceCalendar';

function Legend() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }} testID="calendar-legend">
      {LEGEND.map((l) => (
        <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={[
              { width: 12, height: 12, borderRadius: 4, backgroundColor: colors[STATUS_COLOR[l.key]] },
              STATUS_COLOR[l.key] === 'statusWeekOff' ? { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderStrong } : null,
            ]}
          />
          <Text variant="caption" color="textSecondary">
            {l.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Monthly attendance calendar (Monday first) with a day sheet, payslip and bonus / advance sheets. */
export default function AttendanceCalendarScreen() {
  const { colors } = useTheme();
  const { isWide } = useBreakpoint();
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = session?.orgId ?? '';
  const initial = currentMonthIST();
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [selected, setSelected] = useState<string | null>(null);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);

  const monthQuery = useAttendanceMonth(userId, orgId, year, month);
  const shiftCtx = useShiftContext(userId, orgId);
  const sessions = useDaySessions(userId, selected);
  const payslip = usePayslip(orgId, userId, payslipOpen);
  const advances = useAdvances(orgId, userId, bonusOpen);

  const today = todayIST();
  const records = useMemo(() => new Map((monthQuery.data ?? []).map((r) => [r.date, r])), [monthQuery.data]);
  const viewOf = (date: string): DayView => deriveDay(date, records.get(date), today);
  const selectedView = selected ? viewOf(selected) : null;

  const renderDay = (info: DayRenderInfo) => {
    const v = viewOf(info.date);
    const color = v.color ? colors[v.color] : null;
    // The weekly off is quiet (muted tile) so the meaningful statuses (present / absent / leave) carry the colour.
    const quiet = v.color === 'statusWeekOff';
    const ink = quiet ? 'textMuted' : color ? 'textInverse' : 'text';
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.cell,
          color ? { backgroundColor: color } : null,
          quiet ? { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border } : null,
        ]}
        testID={`day-${info.date}`}
      >
        <Text variant="callout" weight={color || info.isToday ? 'bold' : 'medium'} color={ink}>
          {String(info.day)}
        </Text>
        {v.caption ? (
          <Text variant="micro" color={ink} style={{ fontSize: 9, lineHeight: 11 }}>
            {v.caption}
          </Text>
        ) : null}
      </View>
    );
  };

  const onDayPress = (date: string) => {
    if (viewOf(date).displayRecord) setSelected(date);
  };

  const calendar = (
    <Card style={{ gap: spacing.lg }}>
      {monthQuery.isError ? (
        <ErrorState message="Could not load your attendance for this month." onRetry={() => void monthQuery.refetch()} />
      ) : (
        <View>
          <Calendar
            month={month}
            year={year}
            onMonthChange={(v) => {
              setMonth(v.month);
              setYear(v.year);
            }}
            weekStartsOn={1}
            yearRange={[initial.year - 5, initial.year + 4]}
            renderDay={renderDay}
            onDayPress={onDayPress}
            testID="attendance-calendar"
          />
          {monthQuery.isPending ? (
            <View style={[StyleSheet.absoluteFill, styles.loading, { backgroundColor: colors.surface }]} testID="calendar-loading">
              <Spinner />
              <Text variant="caption" color="textMuted">
                Loading attendance...
              </Text>
            </View>
          ) : null}
        </View>
      )}
      <Legend />
    </Card>
  );

  const actions = (
    <View style={{ gap: spacing.md }}>
      <Button title="Advance Salary" icon="wallet" variant="secondary" onPress={() => setBonusOpen(true)} fullWidth testID="open-bonus" />
      <Button title="Payslip" icon="receipt" onPress={() => setPayslipOpen(true)} fullWidth testID="open-payslip" />
    </View>
  );

  return (
    <Screen title="Attendance Calendar" testID="attendance-screen">
      {!session ? (
        <Skeleton height={320} />
      ) : isWide ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.6 }}>{calendar}</View>
          <View style={{ flex: 1 }}>{actions}</View>
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {calendar}
          {actions}
        </View>
      )}

      <DayDetailSheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        view={selectedView}
        employeeName={shiftCtx.employeeName}
        companyName={session?.orgName ?? ''}
        shift={selectedView ? shiftForDate(selectedView.date, selectedView.record, shiftCtx.current, shiftCtx.history) : undefined}
        sessions={sessions.data}
        sessionsLoading={sessions.isLoading}
      />
      <PayslipSheet
        visible={payslipOpen}
        onClose={() => setPayslipOpen(false)}
        loading={payslip.isLoading}
        error={payslip.isError}
        onRetry={() => void payslip.refetch()}
        payslip={payslip.data}
      />
      <BonusSheet
        visible={bonusOpen}
        onClose={() => setBonusOpen(false)}
        loading={advances.isLoading}
        error={advances.isError}
        onRetry={() => void advances.refetch()}
        employeeName={shiftCtx.employeeName}
        advances={advances.data}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cell: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  loading: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, opacity: 0.92 },
});
