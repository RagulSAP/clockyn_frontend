import React from 'react';
import { View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { spacing } from '@/theme';

export interface InfoRowProps {
  icon?: IconName;
  label: string;
  value: string;
  /** Allow several lines (remarks). */
  multiline?: boolean;
  testID?: string;
}

/** Small label + value row (optionally with a leading icon) used in lead details. */
export function InfoRow({ icon, label, value, multiline, testID }: InfoRowProps) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
      {icon ? (
        <View style={{ paddingTop: 2 }}>
          <Icon name={icon} size={16} color="textMuted" />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="micro" color="textMuted">
          {label.toUpperCase()}
        </Text>
        <Text variant="callout" numberOfLines={multiline ? 4 : 2}>
          {value}
        </Text>
      </View>
    </View>
  );
}
