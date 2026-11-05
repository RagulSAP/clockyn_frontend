import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, radii, spacing, useTheme } from '@/theme';
import { GradientView } from './GradientView';
import { Touchable } from './internal/Touchable';

export type CardVariant = 'default' | 'outlined' | 'gradient' | 'muted';

export type CardProps = {
  children?: React.ReactNode;
  /** Inner padding in px (default 16). Pass 0 for edge-to-edge content such as lists. */
  padding?: number;
  onPress?: () => void;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
};

/** Raised surface: hairline border with a lit top edge (CRED-style bevel). `gradient` is the graphite hero surface (use `onGradient` text). */
export function Card({ children, padding = spacing.lg, onPress, variant = 'default', style, testID, accessibilityLabel, disabled }: CardProps) {
  const { colors } = useTheme();

  const surface: ViewStyle =
    variant === 'muted'
      ? { backgroundColor: colors.surfaceMuted }
      : variant === 'outlined'
        ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
        : variant === 'gradient'
          ? {}
          : {
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.border,
              borderTopColor: colors.highlight,
              ...elevation.md(colors.shadow),
            };

  const base: ViewStyle = { borderRadius: radii.lg, overflow: variant === 'gradient' ? 'hidden' : 'visible' };
  const inner = variant === 'gradient' ? (
    <GradientView style={{ padding }}>{children}</GradientView>
  ) : (
    children
  );
  const padStyle: ViewStyle | null = variant === 'gradient' ? null : { padding };
  // Edge-to-edge content (lists): clip rows so hover/press tints follow the rounded corners.
  const content =
    padding === 0 && variant !== 'gradient' ? <View style={{ borderRadius: radii.lg - 1, overflow: 'hidden' }}>{inner}</View> : inner;

  if (onPress) {
    return (
      <Touchable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        radius={radii.lg}
        hoverStyle={variant === 'gradient' ? undefined : { borderColor: colors.borderStrong }}
        pressedStyle={{ opacity: 0.92, transform: [{ scale: 0.992 }] }}
        style={[base, surface, padStyle, style]}
      >
        {content}
      </Touchable>
    );
  }
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[base, surface, padStyle, style]}>
      {content}
    </View>
  );
}
