import React from 'react';
import { View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export type InfoRowProps = { icon: IconName; label: string; value: string; testID?: string };

/** Icon tile + uppercase label + value (company profile rows). */
export function InfoRow({ icon, label, value, testID }: InfoRowProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ width: 38, height: 38, borderRadius: radii.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color="primary" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="micro" color="textMuted">
          {label.toUpperCase()}
        </Text>
        <Text variant="body" selectable>
          {value || '-'}
        </Text>
      </View>
    </View>
  );
}
