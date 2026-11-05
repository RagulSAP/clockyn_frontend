import React from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, radii, spacing, useTheme, type ColorTokens } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { haptic } from './internal/haptics';
import { Touchable, type TouchState } from './internal/Touchable';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  /** Skip the haptic tick on press (default: haptics for primary/danger/success). */
  noHaptic?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 46, lg: 54 };
const PAD_X: Record<ButtonSize, number> = { sm: spacing.md, md: spacing.xl, lg: spacing.xxl };
const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

/** `edge` is the darker lower lip of the raised (CRED / NeoPOP-style) button; it flattens when pressed. */
type Palette = { bg: string; bgHover: string; fg: string; border?: string; shadow?: boolean; edge?: string };

function palette(variant: ButtonVariant, c: ColorTokens, isDark: boolean): Palette {
  switch (variant) {
    case 'secondary':
      return { bg: c.primarySoft, bgHover: c.surfaceMuted, fg: c.primary };
    case 'ghost':
      return { bg: 'transparent', bgHover: c.surfaceMuted, fg: c.primary };
    case 'danger':
      return { bg: c.danger, bgHover: c.danger, fg: c.textInverse, shadow: true, edge: 'rgba(0,0,0,0.32)' };
    case 'success':
      return { bg: c.success, bgHover: c.success, fg: c.textInverse, shadow: true, edge: 'rgba(0,0,0,0.3)' };
    default:
      return { bg: c.primary, bgHover: c.primaryPressed, fg: c.onPrimary, shadow: true, edge: isDark ? '#8A8A8A' : '#5C5C5C' };
  }
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  iconRight,
  fullWidth,
  noHaptic,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  // Disabled reads as an inert, flat control (not a dimmed live one): muted fill, muted ink, no lip or shadow.
  const live = palette(variant, colors, isDark);
  const p: Palette = disabled
    ? { bg: variant === 'ghost' ? 'transparent' : colors.surfaceMuted, bgHover: variant === 'ghost' ? 'transparent' : colors.surfaceMuted, fg: colors.textMuted }
    : live;
  const inactive = !!disabled || !!loading;
  const height = HEIGHT[size];

  const handlePress = () => {
    if (inactive) return;
    if (!noHaptic && (variant === 'primary' || variant === 'danger' || variant === 'success')) haptic('light');
    onPress?.();
  };

  return (
    <Touchable
      testID={testID}
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      hitSlop={size === 'sm' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
      radius={radii.md}
      pressedStyle={p.edge ? { transform: [{ translateY: 2 }], borderBottomWidth: 1 } : { opacity: 0.86, transform: [{ scale: 0.985 }] }}
      style={(s: TouchState) => [
        {
          height,
          paddingHorizontal: PAD_X[size],
          borderRadius: radii.md,
          backgroundColor: s.hovered && !inactive ? p.bgHover : p.bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: 1,
        },
        p.edge && !disabled ? { borderBottomWidth: 3, borderBottomColor: p.edge } : null,
        p.shadow && !disabled ? elevation.sm(colors.shadow) : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.fg} />
      ) : icon ? (
        <Icon name={icon} size={ICON_SIZE[size]} color={p.fg} />
      ) : null}
      <Text variant={size === 'sm' ? 'callout' : 'bodyStrong'} weight="semibold" color={p.fg} numberOfLines={1}>
        {title}
      </Text>
      {iconRight && !loading ? <Icon name={iconRight} size={ICON_SIZE[size]} color={p.fg} /> : null}
    </Touchable>
  );
}

export type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  variant?: 'plain' | 'tonal' | 'filled';
  size?: ButtonSize;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Colour token / raw colour for the glyph (plain & tonal). */
  color?: keyof ColorTokens | (string & {});
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const IB_SIZE: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };

export function IconButton({
  icon,
  onPress,
  variant = 'plain',
  size = 'md',
  accessibilityLabel,
  disabled,
  color,
  style,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme();
  const dim = IB_SIZE[size];
  const glyph = size === 'sm' ? 18 : size === 'md' ? 22 : 24;
  const fg =
    variant === 'filled'
      ? colors.onPrimary
      : color
        ? (color in colors ? colors[color as keyof ColorTokens] : color)
        : variant === 'tonal'
          ? colors.primary
          : colors.text;
  const bg = variant === 'filled' ? colors.primary : variant === 'tonal' ? colors.primarySoft : 'transparent';

  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={size === 'sm' ? 4 : 0}
      radius={dim / 2}
      hoverStyle={{ backgroundColor: variant === 'filled' ? colors.primaryPressed : colors.surfaceMuted }}
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <View pointerEvents="none">
        <Icon name={icon} size={glyph} color={fg} />
      </View>
    </Touchable>
  );
}
