import React, { useEffect } from 'react';
import { Animated, Easing, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { nativeDriver } from './internal/web';

/** One shared pulse drives every skeleton on screen (cheap even for long lists). */
const pulse = new Animated.Value(0);
let refs = 0;
let loop: Animated.CompositeAnimation | null = null;

function acquire() {
  refs += 1;
  if (refs === 1) {
    loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
  }
}
function release() {
  refs = Math.max(0, refs - 1);
  if (refs === 0) {
    loop?.stop();
    loop = null;
    pulse.setValue(0);
  }
}

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Shimmering placeholder block. */
export function Skeleton({ width = '100%', height = 14, radius = radii.xs + 2, circle, style, testID }: SkeletonProps) {
  const { colors } = useTheme();
  useEffect(() => {
    acquire();
    return release;
  }, []);
  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: circle ? height : width,
          height,
          borderRadius: circle ? height / 2 : radius,
          backgroundColor: colors.skeleton,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
        style,
      ]}
    />
  );
}

export type SkeletonListProps = {
  count?: number;
  /** `row`: avatar + two lines. `card`: tall card block. `line`: single text line. */
  variant?: 'row' | 'card' | 'line';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SkeletonList({ count = 5, variant = 'row', style, testID }: SkeletonListProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessibilityRole="progressbar" accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={[{ gap: spacing.md }, style]}>
      {Array.from({ length: count }, (_, i) =>
        variant === 'card' ? (
          <View key={i} style={{ padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, gap: spacing.md }}>
            <Skeleton width="45%" height={16} />
            <Skeleton height={12} />
            <Skeleton width="70%" height={12} />
          </View>
        ) : variant === 'line' ? (
          <Skeleton key={i} width={i % 3 === 2 ? '60%' : '100%'} />
        ) : (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}>
            <Skeleton circle height={44} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="80%" height={11} />
            </View>
          </View>
        ),
      )}
    </View>
  );
}
