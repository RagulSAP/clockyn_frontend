import React, { useEffect, useRef } from 'react';
import { ScrollView, View, type ScrollViewInstance, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { CountBadge } from './Badge';
import { Text } from './Text';
import { haptic } from './internal/haptics';
import { Touchable } from './internal/Touchable';

export type TabItem = { key: string; label: string; badge?: number };

export type TabsProps = {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Scrollable pill tabs. The active tab scrolls into view. */
export function Tabs({ tabs, active, onChange, style, testID }: TabsProps) {
  const { colors } = useTheme();
  const scroller = useRef<ScrollViewInstance>(null);
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const viewport = useRef(0);

  useEffect(() => {
    const l = layouts.current[active];
    if (!l || !viewport.current) return;
    scroller.current?.scrollTo({ x: Math.max(0, l.x - (viewport.current - l.width) / 2), animated: true });
  }, [active]);

  return (
    <ScrollView
      ref={scroller}
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e: LayoutChangeEvent) => {
        viewport.current = e.nativeEvent.layout.width;
      }}
      accessibilityRole="tablist"
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: 2 }}
    >
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <Touchable
            key={t.key}
            onPress={() => {
              if (selected) return;
              haptic('selection');
              onChange(t.key);
            }}
            onLayout={(e: LayoutChangeEvent) => {
              layouts.current[t.key] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
            }}
            accessibilityRole="tab"
            accessibilityLabel={t.badge ? `${t.label}, ${t.badge}` : t.label}
            accessibilityState={{ selected }}
            radius={radii.pill}
            hoverStyle={{ backgroundColor: selected ? colors.primary : colors.border }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              height: 38,
              paddingHorizontal: spacing.lg,
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.primary : colors.surfaceMuted,
            }}
          >
            <Text variant="callout" weight="semibold" color={selected ? 'onPrimary' : 'textSecondary'}>
              {t.label}
            </Text>
            {t.badge ? (
              <View>
                <CountBadge count={t.badge} tone={selected ? 'neutral' : 'primary'} />
              </View>
            ) : null}
          </Touchable>
        );
      })}
    </ScrollView>
  );
}
