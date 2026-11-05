import React from 'react';
import { View } from 'react-native';

import { DateField, IconButton } from '@/components/ui';
import { spacing } from '@/theme';

import { canGoNext, clampToToday, nextDate, prevDate } from '../utils/expenseRules';

export type DateNavigatorProps = {
  /** Selected IST date, `YYYY-MM-DD`. */
  date: string;
  /** IST today; the next arrow and the picker stop here. */
  today: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  testID?: string;
};

/** Previous / next day arrows around a date picker pill. Future dates are not reachable (arrows are clamped too). */
export function DateNavigator({ date, today, onChange, disabled, testID }: DateNavigatorProps) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <IconButton icon="chevron-left" variant="tonal" accessibilityLabel="Previous day" onPress={() => onChange(prevDate(date))} disabled={disabled} testID={`${testID ?? 'date'}-prev`} />
      <View style={{ flex: 1 }}>
        <DateField value={date} onChange={(v) => onChange(clampToToday(v, today))} maxDate={today} disabled={disabled} testID={`${testID ?? 'date'}-field`} />
      </View>
      <IconButton
        icon="chevron-right"
        variant="tonal"
        accessibilityLabel="Next day"
        onPress={() => onChange(nextDate(date, today))}
        disabled={disabled || !canGoNext(date, today)}
        testID={`${testID ?? 'date'}-next`}
      />
    </View>
  );
}
