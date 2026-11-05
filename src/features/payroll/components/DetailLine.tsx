import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';
import { Text } from '@/components/ui';

/** `Label: value` row of a template card (value emphasised). */
export function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      <Text variant="callout" color="textSecondary">{`${label}:`}</Text>
      <Text variant="callout" weight="semibold">
        {value}
      </Text>
    </View>
  );
}
