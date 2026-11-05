import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { elevation, radii, spacing, useTheme } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { haptic } from './internal/haptics';
import { useInsets } from './internal/insets';
import { Touchable } from './internal/Touchable';

export type FABProps = {
  icon: IconName;
  onPress: () => void;
  /** Adds a text label (extended FAB). Also used as the accessibility label. */
  label?: string;
  /** Distance from the bottom edge, e.g. to clear a tab bar (safe-area is added automatically). Default 20. */
  bottomOffset?: number;
  /** Render in normal flow instead of floating at the bottom-right. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export function FAB({ icon, onPress, label, bottomOffset = 20, inline, style, testID, accessibilityLabel }: FABProps) {
  const { colors } = useTheme();
  const insets = useInsets();
  return (
    <Touchable
      testID={testID}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? icon}
      radius={radii.pill}
      hoverStyle={{ backgroundColor: colors.primaryPressed }}
      pressedStyle={{ opacity: 0.9, transform: [{ scale: 0.96 }] }}
      style={[
        {
          height: 56,
          minWidth: 56,
          paddingHorizontal: label ? spacing.xl : 0,
          borderRadius: radii.pill,
          backgroundColor: colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          ...elevation.lg(colors.primary),
        },
        inline
          ? { alignSelf: 'flex-start' }
          : { position: 'absolute', right: spacing.xl, bottom: bottomOffset + insets.bottom, zIndex: 50 },
        style,
      ]}
    >
      <Icon name={icon} size={24} color="onPrimary" />
      {label ? (
        <Text variant="bodyStrong" weight="semibold" color="onPrimary">
          {label}
        </Text>
      ) : null}
    </Touchable>
  );
}
