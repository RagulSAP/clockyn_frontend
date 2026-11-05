import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { contentMaxWidth, spacing } from '@/theme';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export type ResponsiveContainerProps = {
  children?: React.ReactNode;
  /** Max content width in px (default `contentMaxWidth`, 1120). Pass `Infinity` to disable. */
  maxWidth?: number;
  /** Responsive horizontal padding: 16 on phones, 24 on tablet / desktop. */
  padded?: boolean;
  /** Fill the parent's height (use for non-scrolling screens). */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Centres content and caps its width on wide screens; full-width on phones. */
export function ResponsiveContainer({ children, maxWidth = contentMaxWidth, padded, fill, style, testID }: ResponsiveContainerProps) {
  const { isPhone } = useBreakpoint();
  return (
    <View
      testID={testID}
      style={[
        { width: '100%', alignSelf: 'center' },
        Number.isFinite(maxWidth) ? { maxWidth } : null,
        padded ? { paddingHorizontal: isPhone ? spacing.lg : spacing.xxl } : null,
        fill ? { flex: 1 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
