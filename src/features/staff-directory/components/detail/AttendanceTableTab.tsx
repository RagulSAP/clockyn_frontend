import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Card, ErrorState, MonthYearPicker, Skeleton, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

import type { MonthAttendance } from '../../hooks/useMonthAttendance';
import { buildDayRow, type DayRow } from '../../utils/attendanceDerive';
import type { PeriodProps } from './CalendarTab';

export interface AttendanceTableTabProps extends PeriodProps {
  attendance: MonthAttendance;
  selectedDate: string | null;
  onEdit: (row: DayRow, field: 'in' | 'out') => void;
}

function HeaderCell({ title, flex, align }: { title: string; flex: number; align?: 'center' | 'right' }) {
  return (
    <Text variant="micro" color="textMuted" style={{ flex, textAlign: align ?? 'left' }}>
      {title.toUpperCase()}
    </Text>
  );
}

/** Day-wise table: one row per day (tap a punch time to correct it). */
export function AttendanceTableTab({ attendance, period, onPeriodChange, yearRange, selectedDate, onEdit }: AttendanceTableTabProps) {
  const { colors } = useTheme();
  const rows = useMemo(() => attendance.cells.map(buildDayRow), [attendance.cells]);

  return (
    <View style={{ gap: spacing.lg }}>
      <MonthYearPicker month={period.month} year={period.year} onChange={onPeriodChange} yearRange={yearRange} />
      {attendance.isError ? (
        <ErrorState compact message={attendance.errorMessage} onRetry={() => void attendance.refetch()} />
      ) : attendance.isLoading ? (
        <Skeleton height={320} />
      ) : (
        <Card padding={0} testID="attendance-table">
          <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <HeaderCell title="Date" flex={1.1} />
            <HeaderCell title="Punch In" flex={1.3} />
            <HeaderCell title="Punch Out" flex={1.5} />
            <HeaderCell title="Work Hours" flex={1} align="right" />
          </View>
          {rows.map((row) => {
            const selected = row.date === selectedDate;
            const tint = row.offSunday ? colors.statusWeekOff : row.half ? colors.statusHalfDay : row.late ? colors.statusLate : null;
            const textColor = row.offSunday ? colors.textSecondary : colors.text;
            return (
              <View
                key={row.date}
                testID={`day-row-${row.date}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 48,
                  paddingRight: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: row.offSunday ? colors.surfaceMuted : selected ? colors.surfaceMuted : tint ? `${tint}1F` : 'transparent',
                }}
              >
                <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: selected ? colors.text : (tint ?? 'transparent'), marginRight: spacing.sm }} />
                <Text variant="callout" color={textColor} style={{ flex: 1.1, paddingRight: spacing.sm }}>
                  {row.dateLabel}
                </Text>
                <Pressable
                  disabled={!row.editable}
                  onPress={() => onEdit(row, 'in')}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit punch in for ${row.dateLabel}`}
                  testID={`edit-in-${row.date}`}
                  style={{ flex: 1.3, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', paddingVertical: spacing.sm }}
                >
                  <Text variant="callout" color={row.half ? 'statusHalfDay' : row.late ? 'statusLate' : textColor}>
                    {row.punchIn}
                  </Text>
                  {row.punchIn !== '-' && row.half ? <Badge label="HALF" tone="primary" size="sm" /> : null}
                  {row.punchIn !== '-' && row.late && !row.half ? <Badge label="LATE" tone="warning" size="sm" /> : null}
                </Pressable>
                <Pressable
                  disabled={!row.editable}
                  onPress={() => onEdit(row, 'out')}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit punch out for ${row.dateLabel}`}
                  testID={`edit-out-${row.date}`}
                  style={{ flex: 1.5, paddingVertical: spacing.sm }}
                >
                  <Text variant={row.punchOutIsShiftEnd ? 'caption' : 'callout'} color={row.punchOutIsShiftEnd ? 'warning' : textColor}>
                    {row.punchOut}
                  </Text>
                </Pressable>
                <Text variant="callout" color={textColor} align="right" style={{ flex: 1 }}>
                  {row.hours}
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}
