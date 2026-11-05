import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';

export type GradientDirection = 'diagonal' | 'horizontal' | 'vertical';

export type GradientViewProps = {
  /** Two or more colours. Defaults to the brand gradient of the active theme. */
  colors?: readonly [string, string, ...string[]];
  direction?: GradientDirection;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const POINTS: Record<GradientDirection, { start: { x: number; y: number }; end: { x: number; y: number } }> = {
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  horizontal: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  vertical: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
};

/** Brand gradient surface (graphite by default; use `onGradient` for text on it). Works on native and web. */
export function GradientView({ colors, direction = 'diagonal', children, style, testID }: GradientViewProps) {
  const theme = useTheme();
  const stops = colors ?? ([theme.colors.gradientStart, theme.colors.gradientEnd] as const);
  const { start, end } = POINTS[direction];
  return (
    <LinearGradient colors={stops} start={start} end={end} style={style} testID={testID}>
      {children}
    </LinearGradient>
  );
}
