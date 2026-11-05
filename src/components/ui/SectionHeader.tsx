import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './internal/Touchable';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SectionHeader({ title, subtitle, action, style, testID }: SectionHeaderProps) {
  return (
    <View testID={testID} style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }, style]}>
      <View style={{ flex: 1 }}>
        <Text variant="title3" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Touchable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          radius={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 28 }}
        >
          <Text variant="callout" weight="semibold" color="primary">
            {action.label}
          </Text>
          <Icon name="chevron-right" size={16} color="primary" />
        </Touchable>
      ) : null}
    </View>
  );
}
