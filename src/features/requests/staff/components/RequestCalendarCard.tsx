import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Button, Calendar, Card, Spinner, Text, type MarkedDate } from '@/components/ui';
import { currentMonthIST, formatDate, todayIST } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';

import { dateBlockReason, sundaysOfMonth, type StatusMap } from '../utils/requestRules';

export type RequestCalendarCardProps = {
  year: number;
  month: number;
  onMonthChange: (v: { year: number; month: number }) => void;
  /** Dates picked by the user (leave: many, permission: one). */
  selected: readonly string[];
  /** A pickable date was tapped. */
  onPick: (date: string) => void;
  /** Existing requests of this kind for the displayed month. */
  statuses: StatusMap;
  /** Spinner over the grid while the month loads. */
  loading: boolean;
  /** Month data not known yet: taps are ignored so an already-requested date can not be picked. */
  unresolved: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  testID?: string;
};

function Dot({ color }: { color: string }) {
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />;
}

/** Month grid for the leave / permission screens: Monday first, Sundays + past days + requested dates not pickable. */
export function RequestCalendarCard({ year, month, onMonthChange, selected, onPick, statuses, loading, unresolved, loadFailed, onRetry, testID }: RequestCalendarCardProps) {
  const { colors } = useTheme();
  const today = todayIST();
  const { year: thisYear } = currentMonthIST();

  const marked = useMemo(() => {
    const out: Record<string, MarkedDate> = {};
    for (const d of sundaysOfMonth(year, month)) out[d] = { color: colors.statusWeekOff };
    for (const [date, status] of Object.entries(statuses)) {
      out[date] =
        status === 'approved'
          ? { color: colors.statusPresent, label: 'Appr' }
          : status === 'rejected'
            ? { color: colors.statusAbsent, label: 'Rej' }
            : { color: colors.statusLate, label: 'Pend' };
    }
    return out;
  }, [colors.statusAbsent, colors.statusLate, colors.statusPresent, colors.statusWeekOff, month, statuses, year]);

  const sundays = useMemo(() => sundaysOfMonth(year, month), [month, year]);

  const legend: { label: string; color: string }[] = [
    { label: 'Selected', color: colors.primary },
    { label: 'Sunday', color: colors.statusWeekOff },
    { label: 'Approved', color: colors.statusPresent },
    { label: 'Rejected', color: colors.statusAbsent },
    { label: 'Pending', color: colors.statusLate },
  ];

  return (
    <Card testID={testID} padding={spacing.lg} style={{ gap: spacing.md }}>
      <View>
        <Calendar
          month={month}
          year={year}
          onMonthChange={onMonthChange}
          weekStartsOn={1}
          yearRange={[thisYear - 5, thisYear + 5]}
          markedDates={marked}
          selectedDates={[...selected]}
          disabledDates={sundays}
          minDate={today}
          onDayPress={(date) => {
            if (unresolved) return;
            if (dateBlockReason(date, today, statuses) !== null) return;
            onPick(date);
          }}
        />
        {loading ? (
          <View
            testID="calendar-loading"
            pointerEvents="auto"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: radii.md,
              backgroundColor: colors.surface,
              opacity: 0.78,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spinner size="large" />
          </View>
        ) : null}
      </View>

      {loadFailed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Text variant="caption" color="danger" style={{ flex: 1 }}>
            Could not load your existing requests for {formatDate(`${year}-${String(month).padStart(2, '0')}-01`, 'MMMM yyyy')}.
          </Text>
          <Button title="Retry" size="sm" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' }}>
        {legend.map((l) => (
          <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Dot color={l.color} />
            <Text variant="caption" color="textSecondary">
              {l.label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
