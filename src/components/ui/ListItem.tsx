import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { toneColors, type Tone } from './Badge';
import { Divider } from './Divider';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { Touchable } from './internal/Touchable';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Leading node (Avatar, custom icon…). */
  left?: React.ReactNode;
  /** Convenience: a tinted rounded icon tile as the leading element (ignored when `left` is set). */
  icon?: IconName;
  iconTone?: Tone;
  /** Trailing node (Badge, Switch, value text…). */
  right?: React.ReactNode;
  onPress?: () => void;
  /** Show a trailing chevron (default: true when `onPress` is set and `right` is not). */
  chevron?: boolean;
  destructive?: boolean;
  /** Hairline divider under the row. */
  divider?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export function ListItem({
  title,
  subtitle,
  left,
  icon,
  iconTone,
  right,
  onPress,
  chevron,
  destructive,
  divider,
  disabled,
  style,
  testID,
  accessibilityLabel,
}: ListItemProps) {
  const { colors } = useTheme();
  const tone = toneColors(destructive ? 'danger' : (iconTone ?? 'primary'), colors);
  const showChevron = chevron ?? (!!onPress && !right);

  const content = (
    <>
      {left ?? (icon ? (
        <View style={{ width: 40, height: 40, borderRadius: radii.sm + 2, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={tone.fg} />
        </View>
      ) : null)}
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="bodyStrong" weight="medium" color={destructive ? 'danger' : 'text'} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={2} style={{ marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {showChevron ? <Icon name="chevron-right" size={18} color="textMuted" /> : null}
    </>
  );

  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  };

  return (
    <View style={style}>
      {onPress ? (
        <Touchable
          testID={testID}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
          accessibilityState={{ disabled: !!disabled }}
          hoverStyle={{ backgroundColor: colors.surfaceMuted }}
          pressedStyle={{ backgroundColor: colors.surfaceMuted, opacity: 1 }}
          style={[rowStyle, disabled ? { opacity: 0.5 } : null]}
        >
          {content}
        </Touchable>
      ) : (
        <View testID={testID} style={rowStyle}>
          {content}
        </View>
      )}
      {divider ? <Divider inset={spacing.lg} /> : null}
    </View>
  );
}
