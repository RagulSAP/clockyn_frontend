import React from 'react';
import { View } from 'react-native';

import { Card, ErrorState, MonthYearPicker, Skeleton, Text, type MonthYear } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { MonthAttendance } from '../../hooks/useMonthAttendance';
import type { DayCell } from '../../utils/attendanceDerive';
import { AttendanceCalendarGrid } from './AttendanceCalendarGrid';

export interface PeriodProps {
  period: MonthYear;
  onPeriodChange: (value: MonthYear) => void;
  yearRange: [number, number];
}

function LegendItem({ color, label, text }: { color: string; label: string; text?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 130, paddingVertical: 2 }}>
      <View style={{ width: 18, height: 18, borderRadius: radii.xs, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        {text ? (
          <Text variant="micro" color="textInverse" style={{ fontSize: 9 }}>
            {text}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

/** Colour legend of the attendance calendar. */
export function AttendanceLegend() {
  const { colors } = useTheme();
  return (
    <Card variant="outlined" padding={spacing.md} testID="attendance-legend">
      <Text variant="callout" weight="semibold" style={{ marginBottom: spacing.sm }}>
        Legend
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg }}>
        <LegendItem color={colors.statusPresent} label="Present" />
        <LegendItem color={colors.statusPresent} label="Late (text)" text="L" />
        <LegendItem color={colors.statusHalfDay} label="Half Day" />
        <LegendItem color={colors.statusAbsent} label="Absent" />
        <LegendItem color={colors.statusLeave} label="Leave" />
        <LegendItem color={colors.statusWeekOff} label="Sunday (Off)" />
      </View>
    </Card>
  );
}

export interface CalendarTabProps extends PeriodProps {
  attendance: MonthAttendance;
  selectedDate: string | null;
  onSelectDay: (cell: DayCell) => void;
}

/** Month calendar with attendance colour coding, legend and month / year selection. */
export function CalendarTab({ attendance, period, onPeriodChange, yearRange, selectedDate, onSelectDay }: CalendarTabProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <MonthYearPicker month={period.month} year={period.year} onChange={onPeriodChange} yearRange={yearRange} />
      {attendance.isError ? (
        <ErrorState compact message={attendance.errorMessage} onRetry={() => void attendance.refetch()} />
      ) : attendance.isLoading ? (
        <Skeleton height={320} />
      ) : (
        <>
          <Card padding={spacing.md}>
            <AttendanceCalendarGrid cells={attendance.cells} selectedDate={selectedDate} onSelect={onSelectDay} />
            {attendance.leavesFailed ? (
              <Text variant="caption" color="warning" style={{ marginTop: spacing.sm }}>
                Approved leaves could not be loaded; leave days may show as absent.
              </Text>
            ) : null}
          </Card>
          <AttendanceLegend />
        </>
      )}
    </View>
  );
}
