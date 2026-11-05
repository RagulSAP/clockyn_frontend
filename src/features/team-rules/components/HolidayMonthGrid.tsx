import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Calendar, Text, type MarkedDate } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { isWeeklyOffDate, offDayDates } from '../utils/holidayLogic';

export type HolidayMonthGridProps = {
  year: number;
  month: number;
  /** Month / year navigation (omit together with `hideHeader` for the fixed-month mini calendars). */
  onMonthChange?: (value: { month: number; year: number }) => void;
  yearRange?: [number, number];
  hideHeader?: boolean;
  /** Weekly off days (Monday = 0 ... Sunday = 6): greyed, labelled OFF and never selectable. */
  offDays: readonly number[];
  /** Dates that already carry a holiday (tinted). */
  holidayDates: readonly string[];
  /** Holiday dates that cannot be picked (the "Add Dates" dialog). */
  lockedDates?: readonly string[];
  selected: readonly string[];
  onToggle: (date: string) => void;
  testID?: string;
};

/**
 * Monday-first month grid for holidays. Colours carry meaning: holiday (pink status colour), weekly off (grey "OFF"),
 * selected (primary fill) and today (outlined, drawn by the calendar).
 */
export function HolidayMonthGrid({
  year,
  month,
  onMonthChange,
  yearRange,
  hideHeader,
  offDays,
  holidayDates,
  lockedDates,
  selected,
  onToggle,
  testID,
}: HolidayMonthGridProps) {
  const { colors } = useTheme();

  const { marked, disabled } = useMemo(() => {
    const m: Record<string, MarkedDate> = {};
    const holidaySet = new Set(holidayDates);
    const off = offDayDates(year, month, offDays);
    for (const d of off) m[d] = { color: colors.statusWeekOff, label: 'OFF' };
    for (const d of holidaySet) m[d] = { color: colors.statusHoliday };
    const dis = new Set<string>(off.filter((d) => !holidaySet.has(d)));
    for (const d of lockedDates ?? []) dis.add(d);
    return { marked: m, disabled: [...dis] };
  }, [year, month, offDays, holidayDates, lockedDates, colors.statusWeekOff, colors.statusHoliday]);

  const press = (date: string) => {
    if (isWeeklyOffDate(date, offDays)) return; // off days can never be holidays
    onToggle(date);
  };

  return (
    <Calendar
      month={month}
      year={year}
      onMonthChange={onMonthChange ?? (() => {})}
      hideHeader={hideHeader}
      yearRange={yearRange}
      weekStartsOn={1}
      markedDates={marked}
      disabledDates={disabled}
      selectedDates={[...selected]}
      onDayPress={press}
      testID={testID}
    />
  );
}

export function CalendarLegend() {
  const { colors } = useTheme();
  const items = [
    { label: 'Holiday', color: colors.statusHoliday, outline: false },
    { label: 'Off Day', color: colors.statusWeekOff, outline: false },
    { label: 'Selected', color: colors.primary, outline: false },
    { label: 'Today', color: colors.primary, outline: true },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: radii.xs,
              backgroundColor: i.outline ? 'transparent' : i.color,
              borderWidth: i.outline ? 1.5 : 0,
              borderColor: i.color,
            }}
          />
          <Text variant="caption" color="textSecondary">
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
