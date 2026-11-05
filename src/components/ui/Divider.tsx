import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing as spacingTokens, useTheme } from '@/theme';

export type DividerProps = {
  vertical?: boolean;
  /** Indent from the start edge (px). */
  inset?: number;
  strong?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Divider({ vertical, inset = 0, strong, style, testID }: DividerProps) {
  const { colors } = useTheme();
  const color = strong ? colors.borderStrong : colors.border;
  return (
    <View
      testID={testID}
      accessibilityRole="none"
      style={[
        vertical
          ? { width: 1, alignSelf: 'stretch', backgroundColor: color, marginTop: inset }
          : { height: 1, alignSelf: 'stretch', backgroundColor: color, marginLeft: inset },
        style,
      ]}
    />
  );
}

export type SpacerProps = {
  /** Pixels or a spacing token name. Defaults to `md`. */
  size?: number | keyof typeof spacingTokens;
  horizontal?: boolean;
  /** Grow to fill remaining space (ignores `size`). */
  flex?: boolean;
  testID?: string;
};

export function Spacer({ size = 'md', horizontal, flex, testID }: SpacerProps) {
  if (flex) return <View testID={testID} style={{ flex: 1 }} />;
  const px = typeof size === 'number' ? size : spacingTokens[size];
  return <View testID={testID} style={horizontal ? { width: px } : { height: px }} />;
}
