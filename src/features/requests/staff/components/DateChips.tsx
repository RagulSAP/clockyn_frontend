import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';

type ChipProps = {
  label: string;
  onRemove: () => void;
  icon?: IconName;
  testID?: string;
};

export function DateChip({ label, onRemove, icon, testID }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label}`}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs + 2,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: colors.primarySoft,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={14} color="primary" /> : null}
      <Text variant="callout" weight="semibold" color="primary">
        {label}
      </Text>
      <Icon name="x" size={14} color="primary" />
    </Pressable>
  );
}

/** Selected leave dates, ascending. Each chip removes its own date (v1 resolved the day against the displayed month). */
export function SelectedDateChips({ dates, onRemove }: { dates: readonly string[]; onRemove: (date: string) => void }) {
  if (dates.length === 0) return null;
  return (
    <View testID="selected-dates" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {[...dates].sort().map((d) => (
        <DateChip key={d} testID={`chip-${d}`} label={formatDate(d, 'dd MMM')} onRemove={() => onRemove(d)} />
      ))}
    </View>
  );
}
