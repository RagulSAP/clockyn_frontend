import React from 'react';
import { View } from 'react-native';

import { FilterChips, Text } from '@/components/ui';
import { spacing } from '@/theme';

import { radiusChoices } from '../utils/branchForm';

type Props = {
  value: number;
  onChange: (radius: number) => void;
};

/** Attendance radius chips (100 / 250 / 500 / 750 / 1000 m). */
export function RadiusSelector({ value, onChange }: Props) {
  return (
    <View style={{ gap: spacing.sm }} testID="radius-selector">
      <Text variant="callout" weight="semibold" color="textSecondary">
        Attendance Radius *
      </Text>
      <FilterChips<number> scroll={false} options={radiusChoices(value).map((r) => ({ label: `${r}m`, value: r }))} value={value} onChange={onChange} />
      <Text variant="caption" color="textMuted">
        Staff can punch in within this distance of the branch location.
      </Text>
    </View>
  );
}
