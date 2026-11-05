import React from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { iconMap, type IconName } from './icons';
import { resolveColor, type ColorProp } from './Text';

export type IconProps = {
  name: IconName;
  size?: number;
  /** Colour token name or raw colour. Defaults to `text`. */
  color?: ColorProp;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  /** When set the icon is announced to screen readers; otherwise it is decorative. */
  accessibilityLabel?: string;
  testID?: string;
};

export function Icon({ name, size = 20, color, strokeWidth = 2, style, accessibilityLabel, testID }: IconProps) {
  const { colors } = useTheme();
  const Glyph = iconMap[name] ?? iconMap.circle;
  const decorative = !accessibilityLabel;
  const resolvedColor = resolveColor(colors, color);
  // Web: the glyph renders a DOM <svg>, which must not receive React Native accessibility props (React DOM warns
  // about unknown props) — use the matching ARIA attributes instead.
  const a11yProps: Record<string, unknown> =
    Platform.OS === 'web'
      ? decorative
        ? // no `focusable: false` here: react-native-svg turns it into tabindex="-1", which the Modal focus trap then picks as the
          // first focus target (a focus ring around the decorative icon of every dialog that opens with one)
          { 'aria-hidden': true, 'data-testid': testID }
        : { role: 'img', 'aria-label': accessibilityLabel, 'data-testid': testID }
      : {
          testID,
          accessible: !decorative,
          accessibilityRole: decorative ? undefined : 'image',
          accessibilityLabel,
          importantForAccessibility: decorative ? 'no' : 'auto',
          accessibilityElementsHidden: decorative,
        };
  return <Glyph size={size} color={resolvedColor} strokeWidth={strokeWidth} style={style} {...a11yProps} />;
}

export type { IconName } from './icons';
