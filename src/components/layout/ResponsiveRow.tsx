import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/theme';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export type ResponsiveColumns = { phone?: number; tablet?: number; desktop?: number };

export type ResponsiveRowProps = {
  children?: React.ReactNode;
  /** Columns per breakpoint (a number applies to all). Default: 1 phone / 2 tablet / 3 desktop. */
  columns?: number | ResponsiveColumns;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Wrapping grid: children flow into 1..n equal columns depending on the viewport. */
export function ResponsiveRow({ children, columns, gap = spacing.md, style, testID }: ResponsiveRowProps) {
  const { isPhone, isTablet } = useBreakpoint();
  const cfg: Required<ResponsiveColumns> =
    typeof columns === 'number'
      ? { phone: columns, tablet: columns, desktop: columns }
      : { phone: columns?.phone ?? 1, tablet: columns?.tablet ?? 2, desktop: columns?.desktop ?? 3 };
  const n = Math.max(1, isPhone ? cfg.phone : isTablet ? cfg.tablet : cfg.desktop);
  const items = React.Children.toArray(children);

  return (
    <View testID={testID} style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2, marginVertical: -gap / 2 }, style]}>
      {items.map((child, i) => (
        <View key={(React.isValidElement(child) && child.key) || i} style={{ width: `${100 / n}%`, padding: gap / 2 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
