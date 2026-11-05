import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { radii, spacing, useTheme, type ColorTokens } from '@/theme';

import { calendarWeeks, type DayCell, type EffectiveStatus } from '../../utils/attendanceDerive';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Fill colour of a day cell (functional status colours, shared with the legend). */
export function cellFill(colors: ColorTokens, status: EffectiveStatus, offSunday: boolean): string | null {
  if (offSunday) return colors.statusWeekOff;
  switch (status) {
    case 'present':
      return colors.statusPresent;
    case 'half_day':
      return colors.statusHalfDay;
    case 'absent':
      return colors.statusAbsent;
    case 'leave':
      return colors.statusLeave;
    default:
      return null;
  }
}

export interface AttendanceCalendarGridProps {
  cells: readonly DayCell[];
  selectedDate: string | null;
  onSelect: (cell: DayCell) => void;
}

/** Monday-first month grid: colour = attendance class, micro label = LATE / HALF, orange ring = today, high-contrast (text colour) ring = selected. */
export function AttendanceCalendarGrid({ cells, selectedDate, onSelect }: AttendanceCalendarGridProps) {
  const { colors } = useTheme();
  const weeks = calendarWeeks(cells);

  return (
    <View testID="attendance-calendar" accessibilityLabel="Attendance calendar">
      <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
        {WEEKDAYS.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.xs }}>
            <Text variant="micro" color="textMuted">
              {d.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((cell, di) => {
            if (!cell) return <View key={di} style={{ flex: 1, minHeight: 54 }} />;
            const fill = cellFill(colors, cell.status, cell.offSunday);
            const selected = cell.date === selectedDate;
            const ring = selected ? colors.text : cell.isToday ? colors.warning : 'transparent';
            const textColor = fill ? colors.textInverse : colors.text;
            const label = cell.showHalf ? 'HALF' : cell.showLate ? 'LATE' : null;
            return (
              <View key={di} style={{ flex: 1, minHeight: 54, padding: 2 }}>
                <Pressable
                  onPress={() => onSelect(cell)}
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${cell.day}${label ? `, ${label}` : ''}${cell.status ? `, ${cell.status.replace('_', ' ')}` : ''}`}
                  testID={`cal-day-${cell.day}`}
                  style={{
                    flex: 1,
                    borderRadius: radii.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: fill ?? colors.surfaceMuted,
                    borderWidth: 2,
                    borderColor: ring,
                    opacity: cell.isFuture ? 0.6 : 1,
                  }}
                >
                  <Text variant="callout" weight="bold" color={textColor}>
                    {String(cell.day)}
                  </Text>
                  {label ? (
                    <View
                      style={{
                        marginTop: 1,
                        paddingHorizontal: 4,
                        borderRadius: radii.xs,
                        backgroundColor: label === 'LATE' ? colors.warning : 'transparent',
                      }}
                    >
                      <Text variant="micro" color={colors.textInverse} style={{ fontSize: 8, lineHeight: 11 }}>
                        {label}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
