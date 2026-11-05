import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { MonthYearPicker, type MonthYear } from './MonthYearPicker';
import { Text } from './Text';
import { withAlpha } from './internal/color';
import { MONTH_NAMES, WEEKDAY_SHORT, daysInMonth, firstWeekday, isOutOfRange, localTodayStr, toDateStr } from './internal/dates';
import { Touchable } from './internal/Touchable';

export type MarkedDate = {
  /** Tint for the day cell (e.g. an attendance status colour). */
  color?: string;
  /** Tiny caption under the number, e.g. `P`, `A`, `L`. */
  label?: string;
  /** Up to 3 dots under the number. */
  dots?: string[];
};

export type DayRenderInfo = {
  date: string;
  day: number;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  marked?: MarkedDate;
};

export type CalendarProps = {
  /** 1-12 */
  month: number;
  year: number;
  onMonthChange: (value: MonthYear) => void;
  /** Replace the default day content. The cell press target / sizing stays the same. */
  renderDay?: (info: DayRenderInfo) => React.ReactNode;
  markedDates?: Record<string, MarkedDate>;
  selectedDates?: string[];
  onDayPress?: (date: string) => void;
  disabledDates?: string[];
  minDate?: string;
  maxDate?: string;
  /** 0 = Sunday (default), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Inclusive [from, to] years offered by the month picker. */
  yearRange?: [number, number];
  hideHeader?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Month grid with attendance-style markers. Pure presentation: the screen owns the month and the data. */
export function Calendar({
  month,
  year,
  onMonthChange,
  renderDay,
  markedDates,
  selectedDates,
  onDayPress,
  disabledDates,
  minDate,
  maxDate,
  weekStartsOn = 0,
  yearRange,
  hideHeader,
  style,
  testID,
}: CalendarProps) {
  const { colors } = useTheme();
  const today = localTodayStr();

  const weeks = useMemo(() => {
    const total = daysInMonth(year, month);
    const lead = (firstWeekday(year, month) - weekStartsOn + 7) % 7;
    const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month, weekStartsOn]);

  const headers = useMemo(() => Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(i + weekStartsOn) % 7]), [weekStartsOn]);

  return (
    <View testID={testID} accessibilityLabel={`${MONTH_NAMES[month - 1]} ${year} calendar`} style={[{ alignSelf: 'stretch' }, style]}>
      {hideHeader ? null : <MonthYearPicker month={month} year={year} onChange={onMonthChange} yearRange={yearRange} style={{ marginBottom: spacing.md }} />}
      <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
        {headers.map((h) => (
          <View key={h} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.xs }}>
            <Text variant="micro" color="textMuted">
              {h.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={{ flex: 1, minHeight: 52 }} />;
            const date = toDateStr(year, month, day);
            const marked = markedDates?.[date];
            const isSelected = !!selectedDates?.includes(date);
            const isDisabled = isOutOfRange(date, minDate, maxDate) || !!disabledDates?.includes(date);
            const isToday = date === today;
            const info: DayRenderInfo = { date, day, isToday, isSelected, isDisabled, marked };
            const tint = marked?.color;
            return (
              <View key={di} style={{ flex: 1, minHeight: 52, padding: 2 }}>
                <Touchable
                  onPress={onDayPress ? () => onDayPress(date) : undefined}
                  disabled={isDisabled || !onDayPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${day} ${MONTH_NAMES[month - 1]} ${year}${marked?.label ? `, ${marked.label}` : ''}${isToday ? ', today' : ''}`}
                  accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                  radius={radii.md}
                  hoverStyle={onDayPress && !isDisabled ? { backgroundColor: colors.surfaceMuted } : undefined}
                  style={{
                    flex: 1,
                    borderRadius: radii.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? colors.primary : tint ? withAlpha(tint, 0.14) : 'transparent',
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: colors.primary,
                    opacity: isDisabled ? 0.35 : 1,
                  }}
                >
                  {renderDay ? (
                    renderDay(info)
                  ) : (
                    <>
                      <Text
                        variant="callout"
                        weight={isSelected || isToday || tint ? 'bold' : 'medium'}
                        color={isSelected ? 'onPrimary' : (tint ?? 'text')}
                      >
                        {String(day)}
                      </Text>
                      {marked?.label ? (
                        <Text variant="micro" color={isSelected ? 'onPrimary' : (tint ?? 'textMuted')} style={{ fontSize: 9, lineHeight: 11 }}>
                          {marked.label}
                        </Text>
                      ) : null}
                      {marked?.dots?.length ? (
                        <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
                          {marked.dots.slice(0, 3).map((c, i) => (
                            <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isSelected ? colors.onPrimary : c }} />
                          ))}
                        </View>
                      ) : null}
                    </>
                  )}
                </Touchable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
