import React, { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { IconButton } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { MONTH_NAMES, MONTH_SHORT } from './internal/dates';
import { haptic } from './internal/haptics';
import { Touchable } from './internal/Touchable';

export type MonthYear = { month: number; year: number };

export type MonthYearPickerProps = {
  /** 1-12 */
  month: number;
  year: number;
  onChange: (value: MonthYear) => void;
  /** Inclusive [from, to] years that can be chosen. Defaults to [2020, current year + 2]. */
  yearRange?: [number, number];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function shift(value: MonthYear, delta: number): MonthYear {
  const idx = value.year * 12 + (value.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Compact `< October 2026 >` stepper; tapping the label opens a month/year grid. */
export function MonthYearPicker({ month, year, onChange, yearRange, style, testID }: MonthYearPickerProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [sheetYear, setSheetYear] = useState(year);
  const [from, to] = yearRange ?? [2020, new Date().getFullYear() + 2];

  const inRange = (v: MonthYear) => v.year >= from && v.year <= to;
  const prev = shift({ month, year }, -1);
  const next = shift({ month, year }, 1);

  const openSheet = () => {
    setSheetYear(year);
    setOpen(true);
  };

  return (
    <View testID={testID} style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, style]}>
      <IconButton icon="chevron-left" variant="tonal" size="sm" accessibilityLabel="Previous month" disabled={!inRange(prev)} onPress={() => onChange(prev)} />
      <Touchable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={`${MONTH_NAMES[month - 1]} ${year}, choose month and year`}
        hoverStyle={{ backgroundColor: colors.surfaceMuted }}
        radius={radii.pill}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, minHeight: 40 }}
      >
        <Text variant="title3">{`${MONTH_NAMES[month - 1]} ${year}`}</Text>
        <Icon name="chevron-down" size={18} color="textMuted" />
      </Touchable>
      <IconButton icon="chevron-right" variant="tonal" size="sm" accessibilityLabel="Next month" disabled={!inRange(next)} onPress={() => onChange(next)} />

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Select month" size="sm">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <IconButton icon="chevron-left" variant="tonal" size="sm" accessibilityLabel="Previous year" disabled={sheetYear <= from} onPress={() => setSheetYear((y) => y - 1)} />
          <Text variant="title2">{String(sheetYear)}</Text>
          <IconButton icon="chevron-right" variant="tonal" size="sm" accessibilityLabel="Next year" disabled={sheetYear >= to} onPress={() => setSheetYear((y) => y + 1)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {MONTH_SHORT.map((name, i) => {
            const selected = sheetYear === year && i + 1 === month;
            return (
              <Touchable
                key={name}
                onPress={() => {
                  haptic('selection');
                  onChange({ month: i + 1, year: sheetYear });
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${MONTH_NAMES[i]} ${sheetYear}`}
                accessibilityState={{ selected }}
                radius={radii.md}
                hoverStyle={{ backgroundColor: selected ? colors.primary : colors.surfaceMuted }}
                style={{
                  width: '31.5%',
                  height: 48,
                  borderRadius: radii.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                }}
              >
                <Text variant="bodyStrong" color={selected ? 'onPrimary' : 'text'}>
                  {name}
                </Text>
              </Touchable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
