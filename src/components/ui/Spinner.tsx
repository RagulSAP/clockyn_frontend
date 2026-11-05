import React from 'react';
import { ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { resolveColor, type ColorProp } from './Text';

export type SpinnerProps = {
  size?: 'small' | 'large' | number;
  color?: ColorProp;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Spinner({ size = 'small', color, style, testID }: SpinnerProps) {
  const { colors } = useTheme();
  return (
    <ActivityIndicator
      size={size}
      color={resolveColor(colors, color, 'primary')}
      style={style}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    />
  );
}
