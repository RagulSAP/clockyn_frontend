import React, { useEffect, useState } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, radii, useTheme } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { haptic } from './internal/haptics';
import { Touchable } from './internal/Touchable';
import { nativeDriver } from './internal/web';

export type SegmentOption<T> = { label: string; value: T; icon?: IconName; disabled?: boolean };

export type SegmentedControlProps<T> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const PAD = 4;

/** Equal-width pill switcher with a sliding thumb. */
export function SegmentedControl<T>({ options, value, onChange, size = 'md', style, testID }: SegmentedControlProps<T>) {
  const { colors, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [anim] = useState(() => new Animated.Value(index));
  const segW = options.length ? (width - PAD * 2) / options.length : 0;

  useEffect(() => {
    Animated.timing(anim, { toValue: index, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [index, anim]);

  const h = size === 'sm' ? 36 : 44;
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', padding: PAD, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, alignSelf: 'stretch' }, style]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: PAD,
            left: PAD,
            width: segW,
            height: h,
            borderRadius: radii.pill,
            backgroundColor: isDark ? colors.borderStrong : colors.surface,
            transform: [{ translateX: Animated.multiply(anim, segW) }],
            ...elevation.sm(colors.shadow),
          }}
        />
      ) : null}
      {options.map((o, i) => {
        const selected = i === index;
        return (
          <Touchable
            key={`${String(o.value)}-${i}`}
            onPress={() => {
              if (o.disabled || selected) return;
              haptic('selection');
              onChange(o.value);
            }}
            disabled={o.disabled}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, checked: selected, disabled: !!o.disabled }}
            radius={radii.pill}
            pressedStyle={{ opacity: 0.7 }}
            style={{ flex: 1, height: h, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.pill, opacity: o.disabled ? 0.45 : 1 }}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={selected ? 'primary' : 'textMuted'} /> : null}
            <Text variant="callout" weight={selected ? 'semibold' : 'medium'} color={selected ? 'primary' : 'textSecondary'} numberOfLines={1}>
              {o.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}
